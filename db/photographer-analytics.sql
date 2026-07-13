-- Photographer-facing analytics (2026-07-13).
--
-- Requested by photographers: "who saw my card but didn't click",
-- "who visited but didn't message", visitor intent mix, countries,
-- new vs returning, per-photo interest. Design notes:
--
--   * photographer_events is the RAW ingest table for the three new
--     client-side events (card_impression / card_click / photo_open).
--     It is pruned after ~120 days — everything the dashboard reads
--     comes from the daily rollups below.
--   * photographer_daily_stats is the only table the dashboard API
--     scans. One row per photographer per Europe/Lisbon calendar day,
--     recomputed idempotently by /api/cron/photographer-stats (the
--     cron recomputes a trailing window, so late payments / late GSC
--     data self-heal).
--   * Profile views are NOT a new event: they are extracted from
--     visitor_sessions.pageviews (tracked since launch), which is why
--     the rollup can backfill months of history on day one.
--   * NO money columns here by design. Earnings live in the payouts
--     screen; this table must never grow gross/fee amounts.

CREATE TABLE IF NOT EXISTS photographer_events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  visitor_id      VARCHAR(36) NOT NULL,
  event_type      VARCHAR(20) NOT NULL CHECK (event_type IN ('card_impression', 'card_click', 'photo_open')),
  -- Where the card was seen: catalog | location | shoot_type | home |
  -- blog | spot | concierge | profile | other. Open-coded text so new
  -- surfaces don't need DDL.
  surface         VARCHAR(30),
  -- portfolio_items.id for photo_open. Plain UUID (no FK): raw events
  -- are ephemeral and validated against portfolio_items at rollup time.
  item_id         UUID,
  position        SMALLINT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photographer_events_occurred
  ON photographer_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_photographer_events_photographer
  ON photographer_events (photographer_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS photographer_daily_stats (
  photographer_id       UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  -- Profile page (from visitor_sessions.pageviews; bots and the
  -- photographer's own sessions excluded)
  profile_views         INTEGER NOT NULL DEFAULT 0,
  unique_visitors       INTEGER NOT NULL DEFAULT 0,
  -- Unique visitors who had already viewed THIS profile on an earlier
  -- day (via photographer_visitor_first_seen)
  returning_visitors    INTEGER NOT NULL DEFAULT 0,
  -- Card events (from photographer_events; collected since 2026-07-13)
  card_impressions      INTEGER NOT NULL DEFAULT 0,
  card_clicks           INTEGER NOT NULL DEFAULT 0,
  photo_opens           INTEGER NOT NULL DEFAULT 0,
  -- Concierge funnel (from concierge_recommendation_events)
  concierge_impressions INTEGER NOT NULL DEFAULT 0,
  concierge_clicks      INTEGER NOT NULL DEFAULT 0,
  -- Google Search Console for the profile URL (all locale variants
  -- summed). NULL = no data pulled for that day (GSC lags ~3 days).
  gsc_impressions       INTEGER,
  gsc_clicks            INTEGER,
  gsc_position          REAL,
  -- Demand funnel (bookings table; inquiry/chat-first rows included).
  -- paid_bookings is COHORT-based: bookings created that day that are
  -- currently paid — late payments appear when the cron recomputes.
  inquiries             INTEGER NOT NULL DEFAULT 0,
  paid_bookings         INTEGER NOT NULL DEFAULT 0,
  -- JSONB breakdowns over that day's profile-viewing sessions:
  --   countries: {"US": 4, "DE": 2}       (ISO-3166 alpha-2)
  --   devices:   {"mobile": 5, "desktop": 2, "tablet": 1}
  --   sources:   {"google_ads": 2, "google": 1, "direct": 3, ...}
  --   intents:   {"couples": 3, "family": 1, "unknown": 6}  (unique visitors)
  --   surfaces:  {"catalog": 120, "location": 40}           (card impressions)
  countries             JSONB NOT NULL DEFAULT '{}'::jsonb,
  devices               JSONB NOT NULL DEFAULT '{}'::jsonb,
  sources               JSONB NOT NULL DEFAULT '{}'::jsonb,
  intents               JSONB NOT NULL DEFAULT '{}'::jsonb,
  surfaces              JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (photographer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_photographer_daily_stats_date
  ON photographer_daily_stats (date);

-- Per-photo daily opens for the "which photos pull interest" block.
-- FK cascade: when a photographer deletes a portfolio photo its stats
-- rows go with it (the dashboard joins portfolio_items anyway).
CREATE TABLE IF NOT EXISTS portfolio_item_daily_stats (
  item_id         UUID NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  opens           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_item_daily_stats_photographer
  ON portfolio_item_daily_stats (photographer_id, date);

-- First day each visitor viewed each profile — powers the returning
-- share. Insert-only (ON CONFLICT DO NOTHING keeps the earliest day,
-- which also makes rollup re-runs idempotent).
CREATE TABLE IF NOT EXISTS photographer_visitor_first_seen (
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  visitor_id      VARCHAR(36) NOT NULL,
  first_date      DATE NOT NULL,
  PRIMARY KEY (photographer_id, visitor_id)
);
