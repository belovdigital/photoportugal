-- Photographer analytics, phase 3 (2026-08-03).
-- Fixes from the stats audit — see docs/STATS-PLAN.md.
--
-- Problem this table solves: "unique visitors" for a 30/90/180-day
-- window was the SUM of daily uniques, so a visitor who came back on
-- five days counted five times (measured: ~14% inflation over 90 days).
-- The daily rows cannot be de-duplicated after the fact, and raw
-- visitor_sessions are pruned at 30 days, so the visitor↔day pairs have
-- to be kept separately. Volume is tiny (~600 rows/month platform-wide).
--
-- Retention mirrors the analytics horizon, not the session retention:
-- these rows are the only lasting record of who came back.

CREATE TABLE IF NOT EXISTS photographer_visitor_days (
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  visitor_id      VARCHAR(36) NOT NULL,
  date            DATE NOT NULL,
  PRIMARY KEY (photographer_id, date, visitor_id)
);

-- Window queries are always (photographer, date range) → COUNT(DISTINCT).
CREATE INDEX IF NOT EXISTS idx_photographer_visitor_days_lookup
  ON photographer_visitor_days (photographer_id, date);
