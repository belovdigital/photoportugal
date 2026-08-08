#!/usr/bin/env bash
#
# Second copy of a market's photographs, into the locked backup bucket.
#
# The files were never at risk from the thing that killed Spain's database:
# they live in R2, not on the box, and the rebuild on 2026-08-07 did not touch
# them. What they have no protection from is a mistake inside R2 itself —
# "Empty bucket" sits two menu items from "Bucket Lock Rules", and one click
# there takes every photograph the platform has ever delivered.
#
# So: copy, never sync. `sync` mirrors deletions, which would faithfully
# reproduce the disaster in the backup a minute later. `copy` only ever adds,
# which is also the only thing the 30-day bucket lock permits.
#
#   norteirabackups/files/<market>/...
#
# Two credentials are needed and they are deliberately different: the market's
# own key can read its photographs but cannot write to the backup bucket, and
# the backup key can write there but cannot touch the live files. Neither key
# alone can both read the originals and overwrite the copies.
#
# INSTALL (per market, daily)
#   0 4 * * * /usr/local/bin/backup-files.sh /var/www/<app>/.env >> /var/log/db-backup.log 2>&1
#
# The first run moves everything and took three hours on Portugal's 121GB;
# later runs list what is already there and transfer only what is new.
#
# Daily rather than weekly: three new photographs appeared in the three hours
# after the first copy finished, so a week between runs is a week of fresh
# deliveries with one copy. Listing 26000 objects a day costs cents a month —
# far less than the gap it closes.

set -uo pipefail

ENV_FILE="${1:-}"
if [ -z "$ENV_FILE" ]; then
  for c in /var/www/photoportugal/.env /var/www/photospain/.env /var/www/photoitaly/.env; do
    [ -f "$c" ] && ENV_FILE="$c" && break
  done
fi
[ -f "$ENV_FILE" ] || { echo "✗ .env не найден" >&2; exit 1; }

getenv() {
  local line; line="$(grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null || true)"
  [ -z "$line" ] && return 0
  local v="${line#*=}"
  if [[ "$v" == \"*\" ]]; then v="${v:1:${#v}-2}"
  elif [[ "$v" == \'*\' ]]; then v="${v:1:${#v}-2}"; fi
  printf '%s' "$v"
}

COUNTRY="$(getenv COUNTRY)"; COUNTRY="${COUNTRY:-pt}"
case "$COUNTRY" in
  pt) MARKET="photoportugal"; LABEL="PT" ;;
  es) MARKET="photospain";    LABEL="ES" ;;
  it) MARKET="photoitalia";   LABEL="IT" ;;
  *)  echo "✗ COUNTRY=$COUNTRY не описан — добавь страну, как в backup-db.sh" >&2; exit 1 ;;
esac

R2_ACCOUNT_ID="$(getenv R2_ACCOUNT_ID)"; R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-0cea0c23984642ede738bd16609d2e6b}"
SRC_KEY="$(getenv R2_ACCESS_KEY_ID)"
SRC_SECRET="$(getenv R2_SECRET_ACCESS_KEY)"
SRC_BUCKET="$(getenv R2_BUCKET)"; SRC_BUCKET="${SRC_BUCKET:-$(getenv AWS_S3_BUCKET)}"
DST_KEY="$(getenv DB_BACKUP_R2_ACCESS_KEY_ID)"
DST_SECRET="$(getenv DB_BACKUP_R2_SECRET_ACCESS_KEY)"
DST_BUCKET="$(getenv DB_BACKUP_BUCKET)"; DST_BUCKET="${DST_BUCKET:-norteirabackups}"
TG_TOKEN="$(getenv TELEGRAM_BOT_TOKEN)"
TG_CHAT="$(getenv TELEGRAM_CHAT_ID)"

alert() {
  echo "[backup-files][$LABEL] $1" >&2
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    curl -sS --max-time 20 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT}" -d "parse_mode=HTML" \
      --data-urlencode "text=🛑 <b>[${LABEL}] Копия файлов не сделана</b>

$1

Сервер: $(hostname)" >/dev/null || true
  fi
}

for v in SRC_KEY SRC_SECRET SRC_BUCKET DST_KEY DST_SECRET; do
  [ -z "${!v}" ] && { alert "В $ENV_FILE нет $v"; exit 1; }
done
command -v rclone >/dev/null || { alert "rclone не установлен"; exit 1; }

CONF="$(mktemp)"; chmod 600 "$CONF"
trap 'rm -f "$CONF"' EXIT
cat > "$CONF" <<EOF
[src]
type = s3
provider = Cloudflare
access_key_id = ${SRC_KEY}
secret_access_key = ${SRC_SECRET}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
region = auto
no_check_bucket = true

[dst]
type = s3
provider = Cloudflare
access_key_id = ${DST_KEY}
secret_access_key = ${DST_SECRET}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
region = auto
no_check_bucket = true
EOF
# --s3-no-head is load-bearing, not tuning. R2 answers 501 to the HEAD rclone
# makes to confirm an upload, and `copy` reads that as a failed transfer and
# deletes the object it just wrote — Spain copied 15 of 233 files until this
# was added, and every retry deleted as much as it wrote.
RC=(rclone --config "$CONF" --s3-disable-checksum --s3-no-head)

BEFORE="$("${RC[@]}" size "dst:${DST_BUCKET}/files/${MARKET}" --json 2>/dev/null | grep -oE '"count":[0-9]+' | cut -d: -f2)"
BEFORE="${BEFORE:-0}"

# --size-only because R2 will not give these objects a modification time (it
# answers 501 to the call that sets one), so a time-based comparison would
# re-upload all 26000 files every single week.
"${RC[@]}" copy "src:${SRC_BUCKET}" "dst:${DST_BUCKET}/files/${MARKET}" \
  --size-only --transfers 8 --checkers 16 --log-level ERROR 2>&1 | head -20

SRC_N="$("${RC[@]}" size "src:${SRC_BUCKET}" --json 2>/dev/null | grep -oE '"count":[0-9]+' | cut -d: -f2)"
DST_N="$("${RC[@]}" size "dst:${DST_BUCKET}/files/${MARKET}" --json 2>/dev/null | grep -oE '"count":[0-9]+' | cut -d: -f2)"
SRC_N="${SRC_N:-0}"; DST_N="${DST_N:-0}"

# The copy is only as good as what is actually on the other side, so the count
# is read back rather than inferred from rclone's exit code.
if [ "$DST_N" -lt "$SRC_N" ]; then
  alert "Скопировано не всё: в оригинале ${SRC_N} объектов, в копии ${DST_N}. Было ${BEFORE}."
  exit 1
fi

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')][$LABEL] файлы OK: ${DST_N} объектов в ${DST_BUCKET}/files/${MARKET} (было ${BEFORE}, в оригинале ${SRC_N})"
