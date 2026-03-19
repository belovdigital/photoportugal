#!/bin/bash
# Cleanup old image cache files (older than 30 days)
# Run via cron: 0 3 * * 0 /var/www/photoportugal/scripts/cleanup-cache.sh
# (Every Sunday at 3am)

CACHE_DIR="${UPLOAD_DIR:-/var/www/photoportugal/uploads}/.cache"

if [ -d "$CACHE_DIR" ]; then
  DELETED=$(find "$CACHE_DIR" -type f -mtime +30 -delete -print | wc -l)
  echo "$(date): Cleaned $DELETED cached images older than 30 days from $CACHE_DIR"
else
  echo "$(date): Cache directory $CACHE_DIR does not exist"
fi
