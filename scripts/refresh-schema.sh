#!/usr/bin/env bash
# Regenerate db/schema.sql from the PT production database.
#
# PT is canonical: all three markets run the same migrations, so one schema
# describes them all. Run this after applying any migration — a schema file
# that trails prod is how queries against nonexistent columns get written
# (it sat 40+ tables behind for months and took /dashboard/profile down twice).
set -euo pipefail
cd "$(dirname "$0")/.."

{
  echo "-- db/schema.sql — generated from PT production on $(date -u +%Y-%m-%d)."
  echo "-- DO NOT EDIT BY HAND. Refresh: scripts/refresh-schema.sh"
  echo "-- Field semantics and the fields that lie: docs/DOMAIN.md"
  ssh hetzner-pp 'sudo -u postgres pg_dump --schema-only --no-owner --no-acl photoportugal'
} > db/schema.sql

echo "tables: $(grep -c '^CREATE TABLE' db/schema.sql)"
