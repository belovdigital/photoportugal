-- Photographer analytics, phase 2 (2026-07-13).
-- Adds: booking-form-open tracking, profile-change annotations,
-- concierge exclusion ("missed matches") logging, weekly digest marker.
-- See db/photographer-analytics.sql for phase 1.

-- 1. New client event type: client opened the booking form / booking
--    page for this photographer. Sits between profile view and inquiry
--    in the funnel (abandoned-form visibility).
ALTER TABLE photographer_events DROP CONSTRAINT IF EXISTS photographer_events_event_type_check;
ALTER TABLE photographer_events ADD CONSTRAINT photographer_events_event_type_check
  CHECK (event_type IN ('card_impression', 'card_click', 'photo_open', 'book_open'));

ALTER TABLE photographer_daily_stats ADD COLUMN IF NOT EXISTS book_opens INTEGER NOT NULL DEFAULT 0;

-- 2. Missed concierge matches by reason: {"language": 12, "availability": 3}
ALTER TABLE photographer_daily_stats ADD COLUMN IF NOT EXISTS missed_matches JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Profile-change log → chart annotations ("changed cover → CTR moved").
--    Written best-effort from dashboard mutation APIs; field is open-coded
--    (cover, avatar, bio, tagline, languages, shoot_types, packages,
--    portfolio, pricing, locations).
CREATE TABLE IF NOT EXISTS photographer_profile_changes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  field           VARCHAR(40) NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_changes_photographer
  ON photographer_profile_changes (photographer_id, occurred_at DESC);

-- 4. Concierge exclusions (raw). One row per (chat, photographer, reason)
--    when a photographer matched the request broadly but was dropped by a
--    later gate. Rolled up into photographer_daily_stats.missed_matches;
--    pruned with the same retention as photographer_events.
CREATE TABLE IF NOT EXISTS concierge_exclusion_events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id         UUID NOT NULL,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  reason          VARCHAR(40) NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- One row per (chat, photographer, reason) — multi-turn chats re-rank on
-- every turn; without this the same miss would count once per turn.
CREATE UNIQUE INDEX IF NOT EXISTS idx_concierge_exclusions_unique
  ON concierge_exclusion_events (chat_id, photographer_id, reason);
CREATE INDEX IF NOT EXISTS idx_concierge_exclusions_photographer
  ON concierge_exclusion_events (photographer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_exclusions_occurred
  ON concierge_exclusion_events (occurred_at);

-- 5. Weekly digest bookkeeping (cron sends Mondays; marker prevents
--    double-sends on cron retries).
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS weekly_digest_sent_at TIMESTAMPTZ;
