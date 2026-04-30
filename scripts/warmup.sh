#!/usr/bin/env bash
# Post-deploy warmup — pings critical routes so first real visitor doesn't pay
# the cold-compile cost. Runs in background, ignores failures, completes in ~10s.
# Called automatically from deploy.sh after blue/green switch.

set -u
BASE="https://photoportugal.com"

URLS=(
  "/"
  "/pt"
  "/de"
  "/photographers"
  "/pt/photographers"
  "/de/photographers"
  "/concierge"
  "/de/concierge"
  "/photoshoots"
  "/locations/lisbon"
  "/locations/sintra"
  "/locations/algarve"
  "/api/photographers?location=lisbon"
)

echo "[warmup] firing $(echo "${URLS[@]}" | wc -w) requests..."
for path in "${URLS[@]}"; do
  curl -s -o /dev/null -w "[warmup] %{http_code} %{time_total}s ${path}\n" -m 30 "${BASE}${path}" &
done
wait
echo "[warmup] done"
