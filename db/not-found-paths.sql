-- 404 path aggregator. One row per unique path; hit counter is bumped
-- via UPSERT on every 404 render. Keeps the table small even under bot
-- traffic.
--
-- Why aggregate rather than log-per-hit:
--   At thousands of bot probes a day, per-hit logging blows up disk
--   for zero analytic value. Aggregating is enough to answer "what's
--   the busiest broken URL and how recent is it."
--
-- Cleanup: a daily cron deletes any row not seen in the last 30 days,
-- regardless of hit count. By the time a path has been silent for a
-- month it's either a one-off typo, a bot probe that moved on, or a
-- link the admin already fixed. Admin can mark a row `ignored=TRUE`
-- to keep it forever (useful for chronic patterns we want to track).

CREATE TABLE IF NOT EXISTS not_found_paths (
  path             TEXT PRIMARY KEY,
  hits             INT NOT NULL DEFAULT 1,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_referrer    TEXT,
  last_user_agent  TEXT,
  -- Admin can flag a path as "we don't care" — keeps it out of the
  -- top-list without losing the hit count (useful for chronic bot probes).
  ignored          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Admin can pre-compute or pin a suggested redirect target. Null
  -- means "no suggestion yet" or "suggestion was rejected."
  suggested_target TEXT
);

CREATE INDEX IF NOT EXISTS idx_not_found_paths_last_seen
  ON not_found_paths (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_not_found_paths_hits
  ON not_found_paths (hits DESC) WHERE NOT ignored;

-- pg_trgm is used by the suggestion engine to fuzzy-match unknown
-- paths against existing slugs. Safe to enable repeatedly.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
