#!/bin/bash
# Idempotent installer for Photo Portugal server-side health monitoring.
# Run as root on the production VPS:
#   sudo bash scripts/setup-monitoring.sh
#
# Installs:
#   /usr/local/bin/pp-alert.sh      — Telegram-only alert sender (Alerts topic, id=220)
#   /usr/local/bin/pp-monitor.sh    — runs all health checks
#   /etc/systemd/system/pp-monitor.{service,timer} — fires every 30s
#
# Reads SMTP/Telegram creds from /var/www/photoportugal/.env at runtime, so
# no secrets in the repo.
#
# Coverage:
#   - Next.js front (200 on active blue/green port)
#   - WebSocket handshake (101 on /ws via nginx)
#   - Postgres (SELECT 1 under 3s)
#   - PM2 process status (any not online)
#   - Disk space on /var (>90% full)
#   - Memory (any pm2 process > 1GB RSS)
#   - 5xx error rate (>5 unique fingerprints in last 5min from error_logs)
#
# Throttle: alert fires after 2 consecutive failures (~30-60s). 5-min cooldown.
# Recovery alert when a previously-failing check passes.
#
# Re-run any time — it overwrites scripts and reloads systemd. Existing fail
# state in /var/run/pp-monitor/ is preserved.

set -euo pipefail

if [ "$(id -u)" != "0" ]; then
  echo "Must run as root (sudo)" >&2
  exit 1
fi

ENV_FILE=/var/www/photoportugal/.env
if [ ! -f "$ENV_FILE" ]; then
  echo "Expected $ENV_FILE not found. Run only on the prod VPS." >&2
  exit 1
fi

# ============================================================
# 1. /usr/local/bin/pp-alert.sh
# ============================================================
cat > /usr/local/bin/pp-alert.sh <<'ALERT'
#!/bin/bash
# Send a message to the Photo Portugal Telegram Alerts topic (forum thread 220).
# Usage: pp-alert.sh "<title>" "<body>"
TITLE="$1"
BODY="$2"
ENV=/var/www/photoportugal/.env

TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" "$ENV" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")
CHAT=$(grep "^TELEGRAM_CHAT_ID=" "$ENV" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")
THREAD=220  # Alerts topic id (see src/lib/telegram.ts TOPIC_THREAD_IDS)

if [ -z "$TOKEN" ] || [ -z "$CHAT" ]; then
  echo "[pp-alert] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" >&2
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
  --data-urlencode "chat_id=$CHAT" \
  --data-urlencode "message_thread_id=$THREAD" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "disable_web_page_preview=true" \
  --data-urlencode "text=$(printf "<b>%s</b>\n\n%s" "$TITLE" "$BODY")" \
  | head -c 200
ALERT
chmod +x /usr/local/bin/pp-alert.sh

# ============================================================
# 2. /usr/local/bin/pp-monitor.sh
# ============================================================
cat > /usr/local/bin/pp-monitor.sh <<'MONITOR'
#!/bin/bash
# Photo Portugal server-side health monitor. Fired every 30s by systemd.
STATE_DIR=/var/run/pp-monitor
mkdir -p "$STATE_DIR"
ALERT_COOLDOWN=300

check() {
  local NAME="$1"
  local PASS="$2"
  local TITLE="$3"
  local BODY="$4"
  local FAIL_FILE="$STATE_DIR/$NAME.fail"
  local ALERT_FILE="$STATE_DIR/$NAME.last-alert"

  if [ "$PASS" = "1" ]; then
    if [ -f "$FAIL_FILE" ] && [ "$(cat "$FAIL_FILE")" -ge 2 ]; then
      local DOWN=$(($(cat "$FAIL_FILE") * 30))
      /usr/local/bin/pp-alert.sh "✅ RECOVERED: $NAME" "Was failing for ~${DOWN}s. Now back to normal." || true
    fi
    rm -f "$FAIL_FILE" "$ALERT_FILE"
    return
  fi

  local COUNT=0
  [ -f "$FAIL_FILE" ] && COUNT=$(cat "$FAIL_FILE")
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$FAIL_FILE"

  [ "$COUNT" -lt 2 ] && return

  local NOW=$(date +%s)
  local LAST=0
  [ -f "$ALERT_FILE" ] && LAST=$(cat "$ALERT_FILE")
  [ $((NOW - LAST)) -lt $ALERT_COOLDOWN ] && return

  /usr/local/bin/pp-alert.sh "🔴 $TITLE" "$BODY

Failing for $COUNT consecutive checks (~$((COUNT*30))s)." || true
  echo "$NOW" > "$ALERT_FILE"
}

# 1. Next.js front
ACTIVE=$(cat /var/www/photoportugal-active 2>/dev/null || echo unknown)
PORT=3000
[ "$ACTIVE" = "green" ] && PORT=3001
NEXTJS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/" 2>/dev/null)
[ -z "$NEXTJS_CODE" ] && NEXTJS_CODE=000
if [ "$NEXTJS_CODE" = "200" ]; then
  check "nextjs" 1 "" ""
else
  check "nextjs" 0 "Next.js DOWN" "Active: $ACTIVE (port $PORT). HTTP code: $NEXTJS_CODE (expected 200). Fix: pm2 restart photoportugal-$ACTIVE"
fi

# 2. WebSocket handshake
WS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --http1.1 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --max-time 5 https://photoportugal.com/ws 2>/dev/null)
[ -z "$WS_CODE" ] && WS_CODE=000
if [ "$WS_CODE" = "101" ]; then
  check "ws" 1 "" ""
else
  NGINX_TARGET=$(grep -A 4 'location /ws' /etc/nginx/sites-enabled/photoportugal | grep proxy_pass | head -1 | xargs)
  PM2_WS=$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    ws = [p for p in data if p['name'] == 'photoportugal-ws']
    print(ws[0]['pm2_env']['status'] if ws else 'not running')
except Exception:
    print('unknown')
" 2>/dev/null)
  check "ws" 0 "WebSocket DOWN" "Got HTTP $WS_CODE (expected 101). pm2 ws: $PM2_WS. Nginx /ws: $NGINX_TARGET. Fix: pm2 restart photoportugal-ws"
fi

# 3. Postgres
PG_OK=$(timeout 3 sudo -u postgres psql photoportugal -tAc "SELECT 1" 2>/dev/null | tr -d '[:space:]')
if [ "$PG_OK" = "1" ]; then
  check "postgres" 1 "" ""
else
  check "postgres" 0 "Postgres DOWN" "psql SELECT 1 on photoportugal failed (timeout 3s). Fix: systemctl restart postgresql"
fi

# 4. pm2 processes
PM2_BAD=$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    bad = [(p['name'], p['pm2_env']['status'], p['pm2_env'].get('restart_time', 0))
           for p in data
           if p['name'].startswith('photoportugal')
           and p['pm2_env']['status'] not in ('online', 'launching')]
    print('; '.join(f\"{n} ({s}, restarts={r})\" for n,s,r in bad))
except Exception:
    pass
" 2>/dev/null)
if [ -z "$PM2_BAD" ]; then
  check "pm2" 1 "" ""
else
  check "pm2" 0 "PM2 process crashed" "Not online: $PM2_BAD. Fix: pm2 restart <name>"
fi

# 5. Disk space on /var
DISK_USE=$(df --output=pcent /var 2>/dev/null | tail -1 | tr -dc 0-9)
DISK_USE=${DISK_USE:-0}
if [ "$DISK_USE" -lt 90 ]; then
  check "disk" 1 "" ""
else
  AVAIL=$(df -h /var | tail -1 | awk '{print $4}')
  check "disk" 0 "Low disk space on /var" "/var is ${DISK_USE}% full (~${AVAIL} available). Cleanup old PM2 logs, .next/cache, or grow volume."
fi

# 6. Memory — pm2 process over 1GB
HIGH_MEM=$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    hits = [(p['name'], p['monit'].get('memory', 0))
            for p in data
            if p['name'].startswith('photoportugal') and p['monit'].get('memory', 0) > 1024*1024*1024]
    print('; '.join(f\"{n}={int(m/1024/1024)}MB\" for n,m in hits))
except Exception:
    pass
" 2>/dev/null)
if [ -z "$HIGH_MEM" ]; then
  check "memory" 1 "" ""
else
  check "memory" 0 "High memory" "Process(es) over 1GB: $HIGH_MEM. Possible memory leak — consider pm2 restart."
fi

# 7. 5xx spike — >5 unique fingerprints in 5min
ERR_COUNT=$(timeout 3 sudo -u postgres psql photoportugal -tAc "SELECT COUNT(DISTINCT fingerprint) FROM error_logs WHERE last_seen > NOW() - INTERVAL '5 minutes' AND resolved_at IS NULL" 2>/dev/null | tr -d '[:space:]')
ERR_COUNT=${ERR_COUNT:-0}
if [ "$ERR_COUNT" -lt 5 ]; then
  check "5xx_spike" 1 "" ""
else
  RECENT=$(timeout 3 sudo -u postgres psql photoportugal -tAc "SELECT path || ' — ' || error_class FROM error_logs WHERE last_seen > NOW() - INTERVAL '5 minutes' AND resolved_at IS NULL ORDER BY occurrence_count DESC LIMIT 3" 2>/dev/null | tr '\n' ';')
  check "5xx_spike" 0 "5xx error spike" "$ERR_COUNT unique 5xx fingerprints in last 5 min. Top: $RECENT"
fi

exit 0
MONITOR
chmod +x /usr/local/bin/pp-monitor.sh

# ============================================================
# 3. systemd unit + timer
# ============================================================
cat > /etc/systemd/system/pp-monitor.service <<'SERVICE'
[Unit]
Description=Photo Portugal server-side health monitor
After=network.target postgresql.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pp-monitor.sh
TimeoutStartSec=20s
SERVICE

cat > /etc/systemd/system/pp-monitor.timer <<'TIMER'
[Unit]
Description=Run Photo Portugal health monitor every 30s

[Timer]
OnBootSec=30s
OnUnitActiveSec=30s
AccuracySec=1s

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now pp-monitor.timer

# Disable any old single-purpose timers that this supersedes.
if systemctl list-unit-files ws-healthcheck.timer >/dev/null 2>&1; then
  systemctl disable --now ws-healthcheck.timer 2>/dev/null || true
  rm -f /etc/systemd/system/ws-healthcheck.timer /etc/systemd/system/ws-healthcheck.service
  rm -f /usr/local/bin/ws-healthcheck.sh /usr/local/bin/ws-send-alert.sh
  systemctl daemon-reload
fi

echo
echo "=== Setup complete ==="
echo "Timer status:"
systemctl status pp-monitor.timer --no-pager | head -6
echo
echo "Test run:"
/usr/local/bin/pp-monitor.sh
echo "(empty = all healthy)"
ls /var/run/pp-monitor 2>/dev/null || true

echo
echo "To send a test alert manually:"
echo "  /usr/local/bin/pp-alert.sh \"📡 Test alert\" \"Manual ping from \$(hostname)\""
echo
echo "Logs:"
echo "  journalctl -u pp-monitor.service -n 20"
echo "  systemctl list-timers pp-monitor.timer"
