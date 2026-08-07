#!/usr/bin/env bash
#
# Backup watchdog — every market, checked from every box.
#
# A backup job that quietly stops running is the same disaster as one that was
# never written: you find out on the day you need it. Spain ran for a week with
# no dump and nothing anywhere said so, because the only signal was a healthy
# log file on a different server.
#
# So this does not check "did MY backup run". It lists every market's bucket in
# R2 and shouts about any that is stale — which means Portugal notices when
# Spain stops, and Spain notices when Portugal stops. Losing a box therefore
# cannot also lose the alarm about that box.
#
# INSTALL (per market, once)
#   0 9 * * * /usr/local/bin/check-backups.sh /var/www/<app>/.env >> /var/log/db-backup.log 2>&1
#
# Runs at 09:00, six hours after the 03:00 backup, so a late or slow dump is
# not reported as a missing one.

set -uo pipefail

ENV_FILE="${1:-}"
if [ -z "$ENV_FILE" ]; then
  for candidate in /var/www/photoportugal/.env /var/www/photospain/.env; do
    [ -f "$candidate" ] && ENV_FILE="$candidate" && break
  done
fi
[ -f "$ENV_FILE" ] || { echo "[check-backups] FATAL: no .env found" >&2; exit 1; }

getenv() {
  local line; line="$(grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null || true)"
  [ -z "$line" ] && return 0
  local val="${line#*=}"
  if [[ "$val" == \"*\" ]]; then val="${val:1:${#val}-2}"
  elif [[ "$val" == \'*\' ]]; then val="${val:1:${#val}-2}"; fi
  printf '%s' "$val"
}

R2_ACCOUNT_ID="$(getenv R2_ACCOUNT_ID)"; R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-0cea0c23984642ede738bd16609d2e6b}"
R2_KEY="$(getenv DB_BACKUP_R2_ACCESS_KEY_ID)"; R2_KEY="${R2_KEY:-$(getenv R2_ACCESS_KEY_ID)}"
R2_SECRET="$(getenv DB_BACKUP_R2_SECRET_ACCESS_KEY)"; R2_SECRET="${R2_SECRET:-$(getenv R2_SECRET_ACCESS_KEY)}"
TG_TOKEN="$(getenv TELEGRAM_BOT_TOKEN)"
TG_CHAT="$(getenv TELEGRAM_CHAT_ID)"
[ -n "$R2_KEY" ] && [ -n "$R2_SECRET" ] || { echo "[check-backups] FATAL: no R2 credentials" >&2; exit 1; }

# Generated per run, for the same reason as in backup-db.sh: an inline
# connection string mis-parses the "://" in the endpoint.
RCLONE_CONF="$(mktemp)"; chmod 600 "$RCLONE_CONF"
trap 'rm -f "$RCLONE_CONF"' EXIT
cat > "$RCLONE_CONF" <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_KEY}
secret_access_key = ${R2_SECRET}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
region = auto
no_check_bucket = true
EOF
R2C=(rclone --config "$RCLONE_CONF" --s3-disable-checksum)

# Every market this account backs up. A bucket that has never been created is
# itself the finding — that is the state Spain was in.
BUCKET="$(getenv DB_BACKUP_BUCKET)"; BUCKET="${BUCKET:-norteirabackups}"
MARKETS="photoportugal photospain photoitalia"
MAX_AGE_HOURS=26

problems=""
report=""
for market in $MARKETS; do
  bucket="${BUCKET}/${market}"
  newest="$("${R2C[@]}" lsf "r2:${bucket}" --include '*.sql.gz' 2>/dev/null | sort | tail -1)"

  if [ -z "$newest" ]; then
    # Not every market exists yet; only complain about one whose bucket is
    # there but empty, or which we know should be running.
    if "${R2C[@]}" lsd "r2:${BUCKET}" 2>/dev/null | grep -q " ${market}$"; then
      problems="${problems}
• <b>${market}</b>: бакет есть, но он ПУСТОЙ"
    fi
    continue
  fi

  # Filenames carry a UTC stamp: <market>_YYYYmmdd_HHMMSS.sql.gz. Reading the
  # name rather than the object mtime keeps this honest about when the data was
  # captured, not when it happened to be copied.
  stamp="$(printf '%s' "$newest" | sed -E 's/.*_([0-9]{8})_([0-9]{6})\.sql\.gz/\1 \2/')"
  d="${stamp%% *}"; t="${stamp##* }"
  epoch="$(date -u -d "${d:0:4}-${d:4:2}-${d:6:2} ${t:0:2}:${t:2:2}:${t:4:2}" +%s 2>/dev/null || echo 0)"
  now="$(date -u +%s)"
  age_h=$(( (now - epoch) / 3600 ))

  size="$("${R2C[@]}" size "r2:${bucket}" --include "$newest" --json 2>/dev/null | grep -oE '"bytes":[0-9]+' | cut -d: -f2)"
  size="${size:-0}"

  if [ "$epoch" -eq 0 ]; then
    problems="${problems}
• <b>${market}</b>: не разобрал дату в «${newest}»"
  elif [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then
    problems="${problems}
• <b>${market}</b>: последний бэкап ${age_h}ч назад (${newest})"
  elif [ "$size" -lt 100000 ]; then
    problems="${problems}
• <b>${market}</b>: последний бэкап всего ${size} байт"
  else
    report="${report}
• ${market}: ${age_h}ч назад, $(( size / 1024 / 1024 )) МБ"
  fi
done

if [ -n "$problems" ]; then
  echo "[check-backups] PROBLEMS:${problems}" >&2
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    curl -sS --max-time 20 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT}" -d "parse_mode=HTML" \
      --data-urlencode "text=🛑 <b>Бэкапы баз: проблема</b>${problems}

Проверено с $(hostname)" >/dev/null || true
  fi
  exit 1
fi

if [ -z "$report" ]; then
  # An all-clear from a check that found nothing is worse than no check at all.
  echo "[check-backups] found no backups at all — that is a finding, not an all-clear" >&2
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    curl -sS --max-time 20 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT}" -d "parse_mode=HTML" \
      --data-urlencode "text=🛑 <b>Бэкапы баз: не найдено НИ ОДНОГО</b>

Проверено с $(hostname), бакет ${BUCKET}" >/dev/null || true
  fi
  exit 1
fi

printf '[%s] all backups fresh:%s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$report"
