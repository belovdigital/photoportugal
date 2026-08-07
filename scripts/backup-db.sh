#!/usr/bin/env bash
#
# Nightly database backup — one per market, off the box it protects.
#
# WHY THIS LIVES IN THE REPO
#
# Until 2026-08-07 the only backup was a hand-written /var/backups/backup.sh on
# the Portugal server, created 2026-04-04. It was never in git. The deploy
# pipeline copies the repository, so when Spain was provisioned on 2026-07-31
# there was nothing to carry the backup across — Spain ran for a week with no
# dump anywhere. On 2026-08-07 the Spain server was rebuilt by mistake and the
# entire market's database was lost: no snapshot, no Hetzner backup window, no
# off-box copy.
#
# So: every market gets this by construction, because it ships with the code.
# Adding a third country requires nothing but the cron line in §Install below.
#
# WHERE IT GOES
#
# Cloudflare R2, one private bucket per market. R2 rather than the box's own
# disk (a rebuild wipes that — exactly what happened), rather than Hetzner
# snapshots (none were enabled, and they die with the account), and rather than
# the other market's server (that couples the two and dies if you lose the
# wrong box). The R2 credentials already exist in every market's .env because
# the app stores delivery photos there, so there is no new account to provision
# and nothing extra to forget.
#
# A SEPARATE bucket from the delivery files — that one is bound to
# files.<domain> and is publicly readable. Database dumps must never land in it.
# The backup bucket has no custom domain and no public development URL, which
# is what "private" means in R2; it is reachable only with an S3 key.
#
# One bucket, one folder per market (norteirabackups/photoportugal/...), so a
# single R2 token covers every country and a third market needs no Cloudflare
# work at all. Credentials come from DB_BACKUP_R2_* in .env when present, so
# the backup key can be scoped to this bucket alone rather than reusing the
# delivery-bucket key.
#
# Google Drive stays as a second copy where an rclone gdrive remote exists
# (Portugal has one, working since April). Two independent providers is
# cheap insurance; neither is the only one.
#
# INSTALL (per market, once)
#
#   ln -sf /var/www/<app>-blue/scripts/backup-db.sh /usr/local/bin/backup-db.sh
#   crontab -e:
#     0 3 * * * /usr/local/bin/backup-db.sh /var/www/<app>/.env >> /var/log/db-backup.log 2>&1
#
# The symlink deliberately points at a colour directory that always exists;
# the script only reads the .env path it is given, so blue/green does not
# matter to it.

set -euo pipefail

ENV_FILE="${1:-}"
if [ -z "$ENV_FILE" ]; then
  for candidate in /var/www/photoportugal/.env /var/www/photospain/.env; do
    [ -f "$candidate" ] && ENV_FILE="$candidate" && break
  done
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "[backup] FATAL: no .env found (pass its path as the first argument)" >&2
  exit 1
fi

# Read the env by hand rather than `source`-ing it. Values here contain #, $ and
# quotes (the Stripe keys and the cron secret in particular), and sourcing would
# either execute them or truncate at the first #.
getenv() {
  local key="$1"
  local line
  line="$(grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null || true)"
  [ -z "$line" ] && return 0
  local val="${line#*=}"
  # strip one layer of matching quotes, nothing else
  if [[ "$val" == \"*\" ]]; then val="${val:1:${#val}-2}"
  elif [[ "$val" == \'*\' ]]; then val="${val:1:${#val}-2}"; fi
  printf '%s' "$val"
}

DATABASE_URL="$(getenv DATABASE_URL)"
COUNTRY="$(getenv COUNTRY)"; COUNTRY="${COUNTRY:-pt}"
R2_ACCOUNT_ID="$(getenv R2_ACCOUNT_ID)"; R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-0cea0c23984642ede738bd16609d2e6b}"
# A key scoped to the backup bucket if one is configured, else the app's key.
R2_KEY="$(getenv DB_BACKUP_R2_ACCESS_KEY_ID)"; R2_KEY="${R2_KEY:-$(getenv R2_ACCESS_KEY_ID)}"
R2_SECRET="$(getenv DB_BACKUP_R2_SECRET_ACCESS_KEY)"; R2_SECRET="${R2_SECRET:-$(getenv R2_SECRET_ACCESS_KEY)}"
TG_TOKEN="$(getenv TELEGRAM_BOT_TOKEN)"
TG_CHAT="$(getenv TELEGRAM_CHAT_ID)"
# Optional: lets a brand-new box reach Google Drive with nothing configured on
# it. Copy these four lines from a working market's .env and the backup works
# on first boot — no `rclone config` session, no state to forget.
GD_CLIENT_ID="$(getenv GDRIVE_CLIENT_ID)"
GD_CLIENT_SECRET="$(getenv GDRIVE_CLIENT_SECRET)"
GD_TOKEN="$(getenv GDRIVE_TOKEN)"
GD_ROOT="$(getenv GDRIVE_ROOT_FOLDER_ID)"

case "$COUNTRY" in
  es) MARKET="photospain";   LABEL="ES" ;;
  it) MARKET="photoitalia";  LABEL="IT" ;;
  *)  MARKET="photoportugal"; LABEL="PT" ;;
esac

BUCKET="$(getenv DB_BACKUP_BUCKET)"; BUCKET="${BUCKET:-norteirabackups}"
R2_PATH="${BUCKET}/${MARKET}"
LOCAL_DIR="/var/backups/${MARKET}"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
FILE="${LOCAL_DIR}/${MARKET}_${STAMP}.sql.gz"

# Silence is the failure mode that lost Spain, so every exit path that is not a
# verified upload shouts. Telegram first because that is what actually gets read.
alert() {
  local msg="$1"
  echo "[backup][$LABEL] $msg" >&2
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    curl -sS --max-time 20 -X POST \
      "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT}" \
      -d "parse_mode=HTML" \
      --data-urlencode "text=🛑 <b>[${LABEL}] Бэкап базы не сделан</b>

${msg}

Сервер: $(hostname)" \
      >/dev/null || true
  fi
}
trap 'alert "Скрипт упал на строке $LINENO. Смотри /var/log/db-backup.log"' ERR

[ -z "$DATABASE_URL" ] && { alert "В $ENV_FILE нет DATABASE_URL"; exit 1; }
[ -z "$R2_KEY" ] || [ -z "$R2_SECRET" ] && { alert "В $ENV_FILE нет ключей R2 — выгружать некуда"; exit 1; }
command -v rclone >/dev/null || { alert "rclone не установлен"; exit 1; }
command -v pg_dump >/dev/null || { alert "pg_dump не установлен"; exit 1; }

mkdir -p "$LOCAL_DIR"

# --- dump ------------------------------------------------------------------
# pg_dump reads the URL directly, so no password ever reaches the process list.
pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$FILE"

SIZE_BYTES="$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE")"

# A dump that shrank is the classic silent corruption: the command "succeeded",
# the file exists, and it restores an empty database. What "too small" means
# depends on the market, so the useful comparison is against yesterday rather
# than a number picked once — a young country is legitimately tiny, and a big
# one halving overnight is alarming even at 200MB.
MIN_BYTES="$(getenv MIN_BACKUP_BYTES)"; MIN_BYTES="${MIN_BYTES:-15000}"
if [ "$SIZE_BYTES" -lt "$MIN_BYTES" ]; then
  alert "Дамп подозрительно мал: ${SIZE_BYTES} байт (порог ${MIN_BYTES}). Не выгружаю, чтобы не затереть хорошие копии."
  exit 1
fi

PREV="$(ls -t "${LOCAL_DIR}"/*.sql.gz 2>/dev/null | sed -n '2p' || true)"
if [ -n "$PREV" ]; then
  PREV_BYTES="$(stat -c%s "$PREV" 2>/dev/null || stat -f%z "$PREV" || echo 0)"
  if [ "$PREV_BYTES" -gt 0 ] && [ "$((SIZE_BYTES * 2))" -lt "$PREV_BYTES" ]; then
    alert "Дамп вдвое меньше вчерашнего: ${SIZE_BYTES} против ${PREV_BYTES} байт. Не выгружаю — проверь базу."
    exit 1
  fi
fi

# --- upload ----------------------------------------------------------------
# The config is GENERATED from .env on every run rather than kept as a file
# somebody has to remember to create — that hand-made state is exactly what a
# rebuild wipes and what a new market never gets. It is written to a private
# temp file because rclone's inline connection strings cannot carry an endpoint
# containing "://" without being mis-parsed as a hostname.
RCLONE_CONF="$(mktemp)"
chmod 600 "$RCLONE_CONF"
cleanup() { rm -f "$RCLONE_CONF"; }
trap 'cleanup; alert "Скрипт упал на строке $LINENO. Смотри /var/log/db-backup.log"' ERR
cat > "$RCLONE_CONF" <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_KEY}
secret_access_key = ${R2_SECRET}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
region = auto
# The backup key is scoped to this one bucket, so rclone's habit of checking
# (and trying to create) the bucket before writing gets a 403. Skip it.
no_check_bucket = true
EOF
# Google Drive: prefer credentials from .env so a fresh box needs no setup,
# and fall back to whatever the machine already has configured (Portugal has
# had a working gdrive remote since April).
GD_REMOTE=""
if [ -n "$GD_TOKEN" ]; then
  {
    echo "[gdrive]"
    echo "type = drive"
    echo "scope = drive"
    [ -n "$GD_CLIENT_ID" ] && echo "client_id = ${GD_CLIENT_ID}"
    [ -n "$GD_CLIENT_SECRET" ] && echo "client_secret = ${GD_CLIENT_SECRET}"
    echo "token = ${GD_TOKEN}"
    [ -n "$GD_ROOT" ] && echo "root_folder_id = ${GD_ROOT}"
  } >> "$RCLONE_CONF"
  GD_REMOTE="gdrive"
  GDC=(rclone --config "$RCLONE_CONF")
elif rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
  GD_REMOTE="gdrive"
  GDC=(rclone)
fi

R2C=(rclone --config "$RCLONE_CONF" --s3-disable-checksum)

# Two independent destinations. The rule is not "R2 must work" but "at least
# one off-box copy must exist AND read back as a real dump" — a backup you have
# not read back is a hypothesis, and one that lives only on the box it protects
# is not a backup at all.
UPLOADED=""
DEGRADED=""

verify_r2() {
  local head
  head="$("${R2C[@]}" cat "r2:${R2_PATH}/${REMOTE_NAME}" 2>/dev/null | gunzip 2>/dev/null | sed -n '1,40p' || true)"
  printf '%s' "$head" | grep -q "PostgreSQL database dump"
}

REMOTE_NAME="$(basename "$FILE")"

# Streamed with rcat rather than copied. Every R2 upload path here ends in a
# 501 on a trailing call rclone makes and R2 does not implement — but `copy`
# treats that as a failed transfer and REMOVES the object it just wrote, while
# `rcat` leaves it in place. The bytes were always arriving intact; only copy's
# own cleanup was taking them away again. The read-back below is what decides.
cat "$FILE" | "${R2C[@]}" rcat "r2:${R2_PATH}/${REMOTE_NAME}" >/dev/null 2>&1 || true
if verify_r2; then
  UPLOADED="${UPLOADED} r2:${R2_PATH}/"
else
  DEGRADED="${DEGRADED}
• R2: файл не читается обратно из ${R2_PATH}"
fi

# One folder per market. Everything used to land in the Drive root, which is
# fine with one country and unreadable with three.
if [ -n "$GD_REMOTE" ]; then
  if "${GDC[@]}" copy "$FILE" "gdrive:${MARKET}/" --log-level ERROR 2>/dev/null && \
     [ -n "$("${GDC[@]}" cat "gdrive:${MARKET}/${REMOTE_NAME}" 2>/dev/null | gunzip 2>/dev/null | sed -n '1,40p' | grep "PostgreSQL database dump" || true)" ]; then
    UPLOADED="${UPLOADED} gdrive:${MARKET}/"
  else
    DEGRADED="${DEGRADED}
• Google Drive: копия не ушла или не читается обратно"
  fi
else
  DEGRADED="${DEGRADED}
• Google Drive: нет ни remote на сервере, ни GDRIVE_* в .env"
fi

if [ -z "$UPLOADED" ]; then
  alert "Ни одна копия НЕ ушла с сервера. База есть только на диске, который переустановка сотрёт.${DEGRADED}"
  exit 1
fi

if [ -n "$DEGRADED" ]; then
  # One copy is not two. This is a working backup with a missing leg, and the
  # missing leg is how you end up with nothing.
  echo "[backup][$LABEL] DEGRADED — только:${UPLOADED}" >&2
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    curl -sS --max-time 20 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT}" -d "parse_mode=HTML" \
      --data-urlencode "text=⚠️ <b>[${LABEL}] Бэкап сделан, но копия одна</b>

Ушло:${UPLOADED}
${DEGRADED}" >/dev/null || true
  fi
fi

# --- retention -------------------------------------------------------------
find "$LOCAL_DIR" -name '*.sql.gz' -mtime +14 -delete 2>/dev/null || true
# NOT --min-age. R2 answers 501 to the call rclone uses to stamp an object's
# modification time, so objects arrive with no modtime and --min-age reads them
# as older than any threshold — it deleted each backup seconds after uploading
# it, which is how this bucket sat at 0 B. The timestamp in the filename is the
# only date here that is actually trustworthy.
CUTOFF="$(date -u -d '90 days ago' +%Y%m%d 2>/dev/null || true)"
if [ -n "$CUTOFF" ]; then
  "${R2C[@]}" lsf "r2:${R2_PATH}" --include '*.sql.gz' 2>/dev/null | while read -r old_name; do
    old_date="$(printf '%s' "$old_name" | sed -nE 's/.*_([0-9]{8})_[0-9]{6}\.sql\.gz/\1/p')"
    [ -z "$old_date" ] && continue
    if [ "$old_date" -lt "$CUTOFF" ]; then
      "${R2C[@]}" deletefile "r2:${R2_PATH}/${old_name}" --log-level ERROR 2>/dev/null || true
    fi
  done
fi
if [ -n "$GD_REMOTE" ]; then
  "${GDC[@]}" delete "gdrive:${MARKET}" --min-age 90d --include '*.sql.gz' --log-level ERROR 2>/dev/null || true
fi

trap - ERR
cleanup
HUMAN_SIZE="$(du -h "$FILE" | cut -f1)"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')][$LABEL] OK ${REMOTE_NAME} ${HUMAN_SIZE} ->${UPLOADED} (verified)"
