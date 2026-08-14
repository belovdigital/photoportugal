#!/usr/bin/env bash
#
# Local half of the deploy: ships the working tree to <app>-incoming/ and
# triggers the server's own deploy script.
#
# There are TWO files called deploy.sh and they are not the same thing:
#
#   scripts/deploy.sh      (this file, on the Mac)  — rsync + trigger
#   /var/www/deploy.sh     (on each server)         — blue/green switch,
#                                                     flock, build, health check
#
# This one does not build, restart, or switch anything. It only puts code in
# -incoming/ and calls the server one, which owns everything after that.
#
# Usage:
#   scripts/deploy.sh pt              # one market
#   scripts/deploy.sh all             # es → it → pt, in that order
#   scripts/deploy.sh pt --dry-run    # show what rsync would change, ship nothing
#   scripts/deploy.sh pt --yes        # skip the confirmation prompt
#
# The market is always explicit — there is no default, because guessing which
# production box to overwrite is not a recoverable mistake.

set -euo pipefail

# --- markets --------------------------------------------------------------
# macOS ships bash 3.2, which has no associative arrays — hence the case.
# host|app|domain — see docs/MARKETS.md §2
market_spec() {
  case "$1" in
    pt) echo "hetzner-pp|photoportugal|photoportugal.com" ;;
    es) echo "hetzner-ps|photospain|photospain.co" ;;
    it) echo "hetzner-pi|photoitaly|photoitaly.co" ;;
    *)  return 1 ;;
  esac
}
# ES and IT go first: they carry less traffic, so a bad build is noticed on a
# small market before it reaches PT.
ALL_ORDER="es it pt"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- args -----------------------------------------------------------------
TARGET="${1:-}"
shift || true

DRY_RUN=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y)  ASSUME_YES=true ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

usage() {
  echo "usage: scripts/deploy.sh <pt|es|it|all> [--dry-run] [--yes]" >&2
  exit 2
}

[ -n "$TARGET" ] || usage
if [ "$TARGET" != "all" ] && ! market_spec "$TARGET" >/dev/null; then
  echo "unknown market: $TARGET" >&2
  usage
fi

if [ "$TARGET" = "all" ]; then
  QUEUE="$ALL_ORDER"
else
  QUEUE="$TARGET"
fi

# --- confirmation ---------------------------------------------------------
# Without a terminal (agent, cron, CI) --yes is mandatory. Deploying should be
# a thing someone chose to do, not a thing that happened.
if [ "$DRY_RUN" = false ] && [ "$ASSUME_YES" = false ]; then
  if [ ! -t 0 ]; then
    echo "refusing to deploy non-interactively without --yes" >&2
    exit 1
  fi
  echo "About to deploy $(cd "$REPO_ROOT" && git rev-parse --short HEAD) to: $QUEUE"
  if ! (cd "$REPO_ROOT" && git diff --quiet && git diff --cached --quiet); then
    echo "note: working tree has uncommitted changes — they WILL be shipped."
  fi
  read -r -p "Type the word 'deploy' to continue: " reply
  [ "$reply" = "deploy" ] || { echo "aborted."; exit 1; }
fi

# --- the rsync ------------------------------------------------------------
# Every exclude here has a reason; .env.local has an incident. Next loads
# .env.local BEFORE .env, so one stale file from the Mac silently replaces
# production config — on 2026-08-09 it took the DB out on all three markets at
# once. Do not trim this list.
RSYNC_EXCLUDES=(
  --exclude=node_modules
  --exclude=.next
  --exclude=.git
  --exclude=.env
  --exclude=.env.local
  --exclude=uploads
  --exclude=google-credentials.json
  --exclude=tsconfig.tsbuildinfo
)

ship() {
  local market="$1"
  local host app domain
  IFS='|' read -r host app domain <<< "$(market_spec "$market")"

  echo
  echo "=== $(echo "$market" | tr '[:lower:]' '[:upper:]') — $domain ($host) ==="

  local rsync_flags=(-az --delete "${RSYNC_EXCLUDES[@]}")
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] changes that would be sent to $app-incoming/:"
    rsync "${rsync_flags[@]}" --dry-run --itemize-changes \
      "$REPO_ROOT/" "$host:/var/www/$app-incoming/"
    return 0
  fi

  echo "[1/3] rsync → $app-incoming/"
  rsync "${rsync_flags[@]}" "$REPO_ROOT/" "$host:/var/www/$app-incoming/"

  # Cheap insurance against the incident above: the exclude also hides the file
  # from --delete, so a copy that landed before the exclude existed would just
  # sit there. Check rather than assume.
  echo "[2/3] checking no .env.local reached the server"
  if ssh "$host" "test -e /var/www/$app-incoming/.env.local"; then
    echo "ABORT: /var/www/$app-incoming/.env.local exists — remove it before deploying." >&2
    return 1
  fi

  # The server script holds an flock. If it says a deploy is already running,
  # that is the answer: wait. Never clear the lock.
  echo "[3/3] running /var/www/deploy.sh on $host"
  ssh "$host" 'bash /var/www/deploy.sh'
}

# A plain string, not an array: bash 3.2 errors on ${#arr[@]} for an empty
# array under `set -u`.
FAILED=""
for market in $QUEUE; do
  if ! ship "$market"; then
    FAILED="$market"
    # Stop the chain: if ES is broken, IT and PT should not get the same build.
    echo "deploy failed for $market — not continuing to the rest." >&2
    break
  fi
done

echo
if [ -n "$FAILED" ]; then
  echo "FAILED: $FAILED"
  exit 1
fi
if [ "$DRY_RUN" = true ]; then
  echo "dry run complete — nothing was shipped."
else
  echo "done: $QUEUE"
fi
