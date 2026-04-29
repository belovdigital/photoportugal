#!/bin/bash
# Pre-warm Cloudflare's edge cache for /cdn-cgi/image/... URLs.
# Run from the server so the warm-up hits the Frankfurt PoP that most EU
# visitors land on. Other PoPs warm up naturally as traffic arrives.
#
# Strategy: hit the high-traffic pages, scrape every /cdn-cgi/image/... URL
# from the HTML, then fetch each one in parallel. After this completes, those
# transformed variants are cached on the local edge until evicted (immutable).

set -u
BASE="https://photoportugal.com"

PAGES=(
  /
  /pt /de /es /fr
  /photographers
  /lp
  /lp/lisbon /lp/porto /lp/sintra /lp/algarve /lp/cascais
  /locations/lisbon /locations/porto /locations/sintra /locations/cascais /locations/algarve
  /photoshoots/couples /photoshoots/family /photoshoots/proposal /photoshoots/elopement /photoshoots/solo
)

# Pull every approved photographer's slug so we hit each individual profile too —
# their portfolio thumbnails are the bulk of unique transformations.
SLUGS=$(sudo -u postgres psql photoportugal -tAc \
  "SELECT slug FROM photographer_profiles WHERE is_approved = TRUE")
for s in $SLUGS; do
  PAGES+=("/photographers/$s")
done

echo "Crawling ${#PAGES[@]} pages..."
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# 1) Collect all /cdn-cgi/image/... URLs
> "$TMPDIR/urls.txt"
for p in "${PAGES[@]}"; do
  curl -sL "$BASE$p" \
    | grep -oE '/cdn-cgi/image/[^"]+' \
    >> "$TMPDIR/urls.txt" 2>/dev/null
done
sort -u "$TMPDIR/urls.txt" -o "$TMPDIR/urls.txt"
TOTAL=$(wc -l < "$TMPDIR/urls.txt")
echo "Collected $TOTAL unique image URLs."

# 2) Warm them up in parallel batches.
START=$(date +%s)
COUNT=0
while IFS= read -r url; do
  curl -sIo /dev/null "$BASE$url" &
  COUNT=$((COUNT + 1))
  # 30 parallel; sleep briefly to let some finish before queueing more.
  if (( COUNT % 30 == 0 )); then
    wait
    echo "  warmed $COUNT/$TOTAL"
  fi
done < "$TMPDIR/urls.txt"
wait
ELAPSED=$(($(date +%s) - START))
echo "Done in ${ELAPSED}s. Now sampling cache status..."

# 3) Verify a few URLs are HIT
HEAD_SAMPLE=$(head -5 "$TMPDIR/urls.txt")
for url in $HEAD_SAMPLE; do
  STATUS=$(curl -sI "$BASE$url" | grep -i 'cf-cache-status' | tr -d '\r' | awk '{print $2}')
  echo "  $STATUS"
done
