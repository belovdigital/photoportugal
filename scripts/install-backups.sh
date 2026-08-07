#!/usr/bin/env bash
#
# Wire a market into backups. Run once per new country, on its box.
#
#   bash /var/www/<app>-incoming/scripts/install-backups.sh /var/www/<app>/.env
#
# Spain was lost because backups were three steps someone had to remember from
# another server's setup, and nobody did. Three steps you have to remember is a
# step you will skip; this is the same work as one command that refuses to lie
# about whether it worked.
#
# It is idempotent — safe to re-run, and worth re-running to check a market.
#
# The cron entries point at symlinks into the -incoming tree, which rsync keeps
# current, so updating the scripts is a normal deploy and never a second visit
# here.

set -uo pipefail

ENV_FILE="${1:-}"
if [ -z "$ENV_FILE" ]; then
  for c in /var/www/photoportugal/.env /var/www/photospain/.env /var/www/photoitalia/.env; do
    [ -f "$c" ] && ENV_FILE="$c" && break
  done
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ .env не найден. Укажи путь: install-backups.sh /var/www/<app>/.env" >&2
  exit 1
fi

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
  pt) APP="photoportugal"; MARKET="photoportugal" ;;
  es) APP="photospain";    MARKET="photospain" ;;
  it) APP="photoitalia";   MARKET="photoitalia" ;;
  *)
    echo "✗ COUNTRY=$COUNTRY не описан." >&2
    echo "  Добавь страну в ТРЁХ местах, иначе её дамп уедет в чужую папку:" >&2
    echo "    1. case в scripts/backup-db.sh" >&2
    echo "    2. MARKETS в scripts/check-backups.sh" >&2
    echo "    3. case здесь, в scripts/install-backups.sh" >&2
    exit 1 ;;
esac

echo "Рынок: $MARKET (COUNTRY=$COUNTRY), .env: $ENV_FILE"
echo

# --- what must be in .env before any of this means anything ------------------
MISSING=""
for k in DATABASE_URL DB_BACKUP_R2_ACCESS_KEY_ID DB_BACKUP_R2_SECRET_ACCESS_KEY \
         DB_BACKUP_BUCKET GDRIVE_TOKEN ENV_BACKUP_PASSPHRASE; do
  [ -z "$(getenv "$k")" ] && MISSING="${MISSING} $k"
done
if [ -n "$MISSING" ]; then
  echo "✗ В $ENV_FILE не хватает:"
  for k in $MISSING; do echo "    $k"; done
  echo
  echo "  Скопируй эти строки из .env работающей страны — они общие для всех"
  echo "  рынков. ENV_BACKUP_PASSPHRASE обязана совпадать, иначе зашифрованные"
  echo "  .env разных стран будут открываться разными фразами."
  exit 1
fi
echo "✓ .env: все нужные ключи на месте"

for t in rclone pg_dump openssl; do
  command -v "$t" >/dev/null || { echo "✗ не установлен: $t"; exit 1; }
done
echo "✓ rclone, pg_dump, openssl установлены"

# --- symlinks ----------------------------------------------------------------
SRC="/var/www/${APP}-incoming/scripts"
if [ ! -f "${SRC}/backup-db.sh" ] || [ ! -f "${SRC}/check-backups.sh" ]; then
  echo "✗ Не нахожу скрипты в ${SRC}" >&2
  echo "  Сделай rsync репозитория в /var/www/${APP}-incoming/ и повтори." >&2
  echo "  Симлинк обязан указывать в развёрнутое дерево: если он будет вести" >&2
  echo "  во временный каталог, бэкап тихо умрёт вместе с ним." >&2
  exit 1
fi
for s in backup-db.sh check-backups.sh; do
  ln -sfn "${SRC}/${s}" "/usr/local/bin/${s}"
  chmod +x "${SRC}/${s}" 2>/dev/null || true
  [ -x "/usr/local/bin/${s}" ] || { echo "✗ /usr/local/bin/${s} не исполняется" >&2; exit 1; }
done
echo "✓ скрипты: /usr/local/bin -> ${SRC}"

# --- cron --------------------------------------------------------------------
# Rewritten rather than appended, so re-running cannot end up with the job
# scheduled twice.
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'backup-db.sh' | grep -v 'check-backups.sh' > "$TMP" || true
echo "0 3 * * * /usr/local/bin/backup-db.sh ${ENV_FILE} >> /var/log/db-backup.log 2>&1" >> "$TMP"
echo "0 9 * * * /usr/local/bin/check-backups.sh ${ENV_FILE} >> /var/log/db-backup.log 2>&1" >> "$TMP"
crontab "$TMP" && rm -f "$TMP"
echo "✓ крон: дамп в 03:00, проверка в 09:00"

# --- prove it, do not promise it ---------------------------------------------
echo
echo "Пробный прогон — если он не пройдёт, бэкапа нет, что бы ни говорило выше:"
if /usr/local/bin/backup-db.sh "$ENV_FILE"; then
  echo
  echo "✓ ГОТОВО. $MARKET бэкапится."
else
  echo
  echo "✗ Пробный бэкап НЕ прошёл. Крон стоит, но работать он не будет — чини сейчас." >&2
  exit 1
fi
