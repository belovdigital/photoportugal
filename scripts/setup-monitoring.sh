#!/bin/bash
# Idempotent installer for server-side health monitoring.
# Run as root on EITHER production VPS — Portugal or Spain:
#   sudo bash scripts/setup-monitoring.sh [--test-alert]
#
# The market is auto-detected from which /var/www/<app>/.env exists:
#   photoportugal -> prefix pp, domain from .env, db photoportugal
#   photospain    -> prefix ps, domain from .env, db photospain
#
# Installs:
#   /etc/default/<prefix>-monitor       — per-market settings (the ONLY per-box difference)
#   /usr/local/bin/<prefix>-alert.sh    — Telegram alert sender (alerts topic read from .env)
#   /usr/local/bin/<prefix>-monitor.sh  — runs all health checks
#   /etc/systemd/system/<prefix>-monitor.{service,timer} — fires every 30s
#
# Reads SMTP/Telegram creds from the market's .env at runtime, so no secrets
# in the repo. Telegram topic ids are per-group and NOT portable between
# markets — they come from TELEGRAM_TOPIC_IDS in .env (see src/lib/telegram.ts).
#
# Coverage:
#   - Next.js front (200 on active blue/green port)
#   - WebSocket handshake (101 on /ws via nginx)
#   - Postgres (SELECT 1 under 3s)
#   - PM2 process status (any not online)
#   - Disk space on /var (>90% full)
#   - Memory (any pm2 process > 1GB RSS)
#   - 5xx error rate (>5 unique fingerprints in last 5min from error_logs)
#   - The PEER market's /api/health, probed from outside (PT watches ES and
#     vice versa) — plus this box's own egress, so a broken local line is never
#     reported as the peer being down
#
# Throttle: alert fires after 3 consecutive failures (~90s), 4 (~2min) for the
# peer probe since it crosses the public internet. 5-min cooldown.
# Recovery alert when a previously-alerting check passes.
#
# ⚠️ The WebSocket check hits the ORIGIN (--resolve <domain>:443:127.0.0.1),
# not the public Cloudflare address, and reads the status line with -D -
# instead of -w %{http_code}. Both learned the hard way on 2026-08-05:
#   1. ~15-20% of upgrade requests routed through Cloudflare never deliver the
#      101 back within the 5s timeout, while nginx logs 101 for every single
#      one of them. That produced ~10 false "WebSocket DOWN" pages since May,
#      each followed by RECOVERED ~30s later.
#   2. curl keeps the tunnel open after a 101, so -w %{http_code} is only
#      written if the transfer ends before --max-time — a coin flip that
#      reports 000 on a perfectly healthy socket.
# The trade-off is deliberate: this verifies nginx + ws-server, NOT whether
# Cloudflare/DNS can reach us. External reachability needs an off-box prober.
#
# Re-run any time — it overwrites scripts and reloads systemd. Existing fail
# state in /var/run/<prefix>-monitor/ is preserved.

set -euo pipefail

if [ "$(id -u)" != "0" ]; then
  echo "Must run as root (sudo)" >&2
  exit 1
fi

# ============================================================
# 0. Detect the market
# ============================================================
# PEER_* is the OTHER market: each box probes its peer from the outside, which
# is the one thing a box can never check about itself. Hardcoded because we
# cannot read the peer's .env from here.
if [ -f /var/www/photoportugal/.env ]; then
  APP=photoportugal; PREFIX=pp; LABEL=PT
  DEFAULT_DOMAIN=photoportugal.com; DEFAULT_DB=photoportugal
  ALERT_THREAD_FALLBACK=220   # PT group predates TELEGRAM_TOPIC_IDS
  PEER_LABEL=ES; PEER_DOMAIN=photospain.co
elif [ -f /var/www/photospain/.env ]; then
  APP=photospain; PREFIX=ps; LABEL=ES
  DEFAULT_DOMAIN=photospain.co; DEFAULT_DB=photospain
  ALERT_THREAD_FALLBACK=""
  PEER_LABEL=PT; PEER_DOMAIN=photoportugal.com
else
  echo "Neither /var/www/photoportugal/.env nor /var/www/photospain/.env found." >&2
  echo "Run only on a production VPS." >&2
  exit 1
fi

ENV_FILE=/var/www/$APP/.env

# Never let a missing key abort the install: with `set -euo pipefail` a grep
# that matches nothing kills the script silently. Every read is `|| true`.
read_env() {
  grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "'\"" || true
}

# PT predates NEXT_PUBLIC_BASE_URL and only has NEXTAUTH_URL/AUTH_URL.
DOMAIN=""
for KEY in NEXT_PUBLIC_BASE_URL NEXTAUTH_URL AUTH_URL; do
  RAW=$(read_env "$KEY")
  [ -z "$RAW" ] && continue
  DOMAIN=$(printf '%s' "$RAW" | sed -E 's#^https?://##; s#/.*$##')
  [ -n "$DOMAIN" ] && break
done
[ -z "$DOMAIN" ] && DOMAIN=$DEFAULT_DOMAIN

DB=$(read_env DATABASE_URL | sed -E 's#.*/([A-Za-z0-9_]+)(\?.*)?$#\1#')
[ -z "$DB" ] && DB=$DEFAULT_DB

echo "=== Installing $LABEL monitoring: app=$APP domain=$DOMAIN db=$DB prefix=$PREFIX ==="

# ============================================================
# 1. /etc/default/<prefix>-monitor — the only per-market file
# ============================================================
cat > "/etc/default/$PREFIX-monitor" <<CONF
# Written by scripts/setup-monitoring.sh — settings for $PREFIX-monitor ($LABEL).
MARKET_LABEL=$LABEL
APP=$APP
DOMAIN=$DOMAIN
DB=$DB
ENV_FILE=$ENV_FILE
NGINX_SITE=/etc/nginx/sites-enabled/$APP
ACTIVE_FILE=/var/www/$APP-active
STATE_DIR=/var/run/$PREFIX-monitor
ALERT_BIN=/usr/local/bin/$PREFIX-alert.sh
ALERT_THREAD_FALLBACK=$ALERT_THREAD_FALLBACK
FAIL_THRESHOLD=3
ALERT_COOLDOWN=300
CHECK_INTERVAL=30
# Cross-market prober: this box watches the peer market from outside.
PEER_LABEL=$PEER_LABEL
PEER_URL=https://$PEER_DOMAIN/api/health
CONTROL_URL=https://www.google.com/generate_204
CONTROL_EXPECT=204
PEER_FAIL_THRESHOLD=4
CONF

# ============================================================
# 2. /usr/local/bin/<prefix>-alert.sh
# ============================================================
cat > "/usr/local/bin/$PREFIX-alert.sh" <<'ALERT'
#!/bin/bash
# Send a message to this market's Telegram Alerts topic.
# Usage: <prefix>-alert.sh "<title>" "<body>"
CONF=__CONF__
. "$CONF"

TITLE="$1"
BODY="$2"

TOKEN=$(grep -m1 "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")
CHAT=$(grep -m1 "^TELEGRAM_CHAT_ID=" "$ENV_FILE" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")

if [ -z "$TOKEN" ] || [ -z "$CHAT" ]; then
  echo "[$MARKET_LABEL-alert] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in $ENV_FILE" >&2
  exit 1
fi

# Topic thread ids are per-group and NOT portable between markets — posting a
# PT thread id into the ES group 400s. Source of truth: TELEGRAM_TOPIC_IDS.
THREAD=$(python3 - "$ENV_FILE" "${ALERT_THREAD_FALLBACK:-}" <<'PY'
import json, sys
env, fallback = sys.argv[1], sys.argv[2]
raw = None
for line in open(env):
    if line.startswith("TELEGRAM_TOPIC_IDS="):
        raw = line.split("=", 1)[1].strip().strip("'\"")
try:
    print(json.loads(raw)["alerts"])
except Exception:
    print(fallback)
PY
)

ARGS=(--data-urlencode "chat_id=$CHAT"
      --data-urlencode "parse_mode=HTML"
      --data-urlencode "disable_web_page_preview=true")
[ -n "$THREAD" ] && ARGS+=(--data-urlencode "message_thread_id=$THREAD")

curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
  "${ARGS[@]}" \
  --data-urlencode "text=$(printf "<b>[%s] %s</b>\n\n%s" "$MARKET_LABEL" "$TITLE" "$BODY")" \
  | head -c 200
ALERT
sed -i "s|__CONF__|/etc/default/$PREFIX-monitor|" "/usr/local/bin/$PREFIX-alert.sh"
chmod +x "/usr/local/bin/$PREFIX-alert.sh"

# ============================================================
# 3. /usr/local/bin/<prefix>-monitor.sh
# ============================================================
cat > "/usr/local/bin/$PREFIX-monitor.sh" <<'MONITOR'
#!/bin/bash
# Server-side health monitor, fired every 30s by systemd. Identical on every
# box — everything market-specific lives in the config file below.
CONF=__CONF__
. "$CONF"

mkdir -p "$STATE_DIR"

check() {
  local NAME="$1"
  local PASS="$2"
  local TITLE="$3"
  local BODY="$4"
  local THRESH="${5:-$FAIL_THRESHOLD}"   # per-check override; peer probe is laxer
  local FAIL_FILE="$STATE_DIR/$NAME.fail"
  local ALERT_FILE="$STATE_DIR/$NAME.last-alert"

  if [ "$PASS" = "1" ]; then
    if [ -f "$FAIL_FILE" ] && [ "$(cat "$FAIL_FILE")" -ge "$THRESH" ]; then
      local DOWN=$(($(cat "$FAIL_FILE") * CHECK_INTERVAL))
      "$ALERT_BIN" "✅ RECOVERED: $NAME" "Was failing for ~${DOWN}s. Now back to normal." || true
    fi
    rm -f "$FAIL_FILE" "$ALERT_FILE"
    return
  fi

  local COUNT=0
  [ -f "$FAIL_FILE" ] && COUNT=$(cat "$FAIL_FILE")
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$FAIL_FILE"

  [ "$COUNT" -lt "$THRESH" ] && return

  local NOW=$(date +%s)
  local LAST=0
  [ -f "$ALERT_FILE" ] && LAST=$(cat "$ALERT_FILE")
  [ $((NOW - LAST)) -lt "$ALERT_COOLDOWN" ] && return

  "$ALERT_BIN" "🔴 $TITLE" "$BODY

Failing for $COUNT consecutive checks (~$((COUNT * CHECK_INTERVAL))s)." || true
  echo "$NOW" > "$ALERT_FILE"
}

# 1. Next.js front
ACTIVE=$(cat "$ACTIVE_FILE" 2>/dev/null || echo unknown)
PORT=3000
[ "$ACTIVE" = "green" ] && PORT=3001
NEXTJS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/" 2>/dev/null)
[ -z "$NEXTJS_CODE" ] && NEXTJS_CODE=000
if [ "$NEXTJS_CODE" = "200" ]; then
  check "nextjs" 1 "" ""
else
  check "nextjs" 0 "Next.js DOWN" "Active: $ACTIVE (port $PORT). HTTP code: $NEXTJS_CODE (expected 200). Fix: pm2 restart $APP-$ACTIVE"
fi

# 2. WebSocket handshake — against the origin, NOT through Cloudflare, and read
# from the status line: -w %{http_code} reports 000 on a healthy socket because
# curl holds the tunnel open past --max-time. See setup-monitoring.sh header.
# --max-time IS the runtime of this check: curl never returns early, it keeps
# the upgraded tunnel open. Measured time-to-first-byte on loopback is 20-65ms,
# so 2s leaves ~30-100x headroom, and a blip needs 3 consecutive misses (~90s)
# to page anyone.
WS_STATUS=$(curl -s -D - -o /dev/null --http1.1 \
  --resolve "$DOMAIN:443:127.0.0.1" \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --max-time 2 "https://$DOMAIN/ws" 2>/dev/null | head -1 | tr -d '\r')
case "$WS_STATUS" in
  *" 101"*)
    check "ws" 1 "" ""
    ;;
  *)
    NGINX_TARGET=$(grep -A 4 'location /ws' "$NGINX_SITE" | grep proxy_pass | head -1 | xargs)
    PM2_WS=$(pm2 jlist 2>/dev/null | APP="$APP" python3 -c "
import json, os, sys
try:
    data = json.load(sys.stdin)
    ws = [p for p in data if p['name'] == os.environ['APP'] + '-ws']
    print(ws[0]['pm2_env']['status'] if ws else 'not running')
except Exception:
    print('unknown')
" 2>/dev/null)
    check "ws" 0 "WebSocket DOWN" "Origin handshake returned: ${WS_STATUS:-no response} (expected 101 Switching Protocols). pm2 ws: $PM2_WS. Nginx /ws: $NGINX_TARGET. Fix: pm2 restart $APP-ws"
    ;;
esac

# 3. Postgres
PG_OK=$(timeout 3 sudo -u postgres psql "$DB" -tAc "SELECT 1" 2>/dev/null | tr -d '[:space:]')
if [ "$PG_OK" = "1" ]; then
  check "postgres" 1 "" ""
else
  check "postgres" 0 "Postgres DOWN" "psql SELECT 1 on $DB failed (timeout 3s). Fix: systemctl restart postgresql"
fi

# 4. pm2 processes
PM2_BAD=$(pm2 jlist 2>/dev/null | APP="$APP" python3 -c "
import json, os, sys
try:
    data = json.load(sys.stdin)
    app = os.environ['APP']
    bad = [(p['name'], p['pm2_env']['status'], p['pm2_env'].get('restart_time', 0))
           for p in data
           if p['name'].startswith(app)
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
HIGH_MEM=$(pm2 jlist 2>/dev/null | APP="$APP" python3 -c "
import json, os, sys
try:
    data = json.load(sys.stdin)
    app = os.environ['APP']
    hits = [(p['name'], p['monit'].get('memory', 0))
            for p in data
            if p['name'].startswith(app) and p['monit'].get('memory', 0) > 1024*1024*1024]
    print('; '.join(f\"{n}={int(m/1024/1024)}MB\" for n,m in hits))
except Exception:
    pass
" 2>/dev/null)
if [ -z "$HIGH_MEM" ]; then
  check "memory" 1 "" ""
else
  check "memory" 0 "High memory" "Process(es) over 1GB: $HIGH_MEM. Possible memory leak — consider pm2 restart."
fi

# 7. 5xx spike — >5 unique fingerprints in 5min. Fails open: if the query
# errors (no error_logs table yet on a fresh market), ERR_COUNT=0 and no alert.
ERR_COUNT=$(timeout 3 sudo -u postgres psql "$DB" -tAc "SELECT COUNT(DISTINCT fingerprint) FROM error_logs WHERE last_seen > NOW() - INTERVAL '5 minutes' AND resolved_at IS NULL" 2>/dev/null | tr -d '[:space:]')
ERR_COUNT=${ERR_COUNT:-0}
if [ "$ERR_COUNT" -lt 5 ]; then
  check "5xx_spike" 1 "" ""
else
  RECENT=$(timeout 3 sudo -u postgres psql "$DB" -tAc "SELECT path || ' — ' || error_class FROM error_logs WHERE last_seen > NOW() - INTERVAL '5 minutes' AND resolved_at IS NULL ORDER BY occurrence_count DESC LIMIT 3" 2>/dev/null | tr '\n' ';')
  check "5xx_spike" 0 "5xx error spike" "$ERR_COUNT unique 5xx fingerprints in last 5 min. Top: $RECENT"
fi

# 8. The peer market, probed from the outside — the one thing a box can never
# check about itself. PT watches ES and vice versa. The alert lands in THIS
# market's Telegram group on purpose: a box that is down cannot page anyone,
# so the healthy box has to do the talking. /api/health is the target because
# it exercises the whole chain (Cloudflare -> nginx -> Next -> Postgres) and
# `/` only answers 302 to the locale.
PEER_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PEER_URL" 2>/dev/null)
[ -z "$PEER_CODE" ] && PEER_CODE=000
if [ "$PEER_CODE" = "200" ]; then
  check "peer_$PEER_LABEL" 1 "" "" "$PEER_FAIL_THRESHOLD"
  check "egress" 1 "" ""
else
  # Never blame the peer before proving our own line works. The control host is
  # deliberately NOT behind Cloudflare, so a Cloudflare-wide outage still reads
  # as "peer unreachable" — which is exactly what visitors would experience.
  CTRL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CONTROL_URL" 2>/dev/null)
  [ -z "$CTRL_CODE" ] && CTRL_CODE=000
  if [ "$CTRL_CODE" = "$CONTROL_EXPECT" ]; then
    check "egress" 1 "" ""
    check "peer_$PEER_LABEL" 0 "$PEER_LABEL is unreachable from outside" \
"GET $PEER_URL returned $PEER_CODE (expected 200), probed from $(hostname) [$MARKET_LABEL].
Control probe $CONTROL_URL returned $CTRL_CODE, so this box's network is fine — $PEER_LABEL itself, its Cloudflare or its DNS is down. Nothing to restart here." \
      "$PEER_FAIL_THRESHOLD"
  else
    # Both failed: our own egress/DNS is the suspect, so the peer's state is
    # unknown. Leave the peer counter untouched instead of blaming it.
    check "egress" 0 "Outbound network broken on the $MARKET_LABEL box" \
"Neither $PEER_URL ($PEER_CODE) nor the neutral control $CONTROL_URL ($CTRL_CODE) answered from $(hostname).
DNS or egress here is broken; $PEER_LABEL status is unknown. This alert may not have reached Telegram either."
  fi
fi

exit 0
MONITOR
sed -i "s|__CONF__|/etc/default/$PREFIX-monitor|" "/usr/local/bin/$PREFIX-monitor.sh"
chmod +x "/usr/local/bin/$PREFIX-monitor.sh"

# ============================================================
# 4. systemd unit + timer
# ============================================================
cat > "/etc/systemd/system/$PREFIX-monitor.service" <<SERVICE
[Unit]
Description=$LABEL server-side health monitor ($APP)
After=network.target postgresql.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/$PREFIX-monitor.sh
TimeoutStartSec=20s
SERVICE

cat > "/etc/systemd/system/$PREFIX-monitor.timer" <<TIMER
[Unit]
Description=Run $LABEL health monitor every 30s

[Timer]
OnBootSec=30s
OnUnitActiveSec=30s
AccuracySec=1s

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now "$PREFIX-monitor.timer"

# Disable any old single-purpose timers that this supersedes.
if systemctl list-unit-files ws-healthcheck.timer >/dev/null 2>&1; then
  systemctl disable --now ws-healthcheck.timer 2>/dev/null || true
  rm -f /etc/systemd/system/ws-healthcheck.timer /etc/systemd/system/ws-healthcheck.service
  rm -f /usr/local/bin/ws-healthcheck.sh /usr/local/bin/ws-send-alert.sh
  systemctl daemon-reload
fi

echo
echo "=== Setup complete ($LABEL) ==="
echo "Timer status:"
systemctl status "$PREFIX-monitor.timer" --no-pager | head -6
echo
echo "Test run:"
"/usr/local/bin/$PREFIX-monitor.sh"
echo "(empty = all healthy)"
ls "/var/run/$PREFIX-monitor" 2>/dev/null || true

if [ "${1:-}" = "--test-alert" ]; then
  echo
  echo "Sending test alert to the $LABEL Telegram alerts topic:"
  "/usr/local/bin/$PREFIX-alert.sh" "📡 Test alert" "Manual ping from $(hostname) — monitoring installed."
  echo
fi

echo
echo "To send a test alert manually:"
echo "  /usr/local/bin/$PREFIX-alert.sh \"📡 Test alert\" \"Manual ping from \$(hostname)\""
echo
echo "Logs:"
echo "  journalctl -u $PREFIX-monitor.service -n 20"
echo "  systemctl list-timers $PREFIX-monitor.timer"
