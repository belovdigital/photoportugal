-- Per-recommendation telemetry for the AI concierge.
--
-- Goal: answer "which photographer was shown, why, and what happened next?"
-- One row per (chat, photographer) recommendation. A single chat can produce
-- N rows over its lifetime (3 matches × multiple turns = up to ~9 rows).
--
-- This is the foundation for fair-discovery (newcomer boost) experiments:
-- without per-recommendation tracking we can't tell if the boost helps or
-- hurts conversion. So this table comes BEFORE any ranker changes.
--
-- Strategy values are open-coded text (not an enum) so we can add new
-- buckets later without ALTER TYPE rituals:
--   - best_fit       : top-of-ranker, expected default
--   - fresh_fit      : newcomer boost slot (session_count <= 2)
--   - featured_fit   : paid-featured surfaced because also matches
--   - local_fit      : exact-city/island match overrides higher-tier
--   - llm_pick       : LLM chose a photographer outside the ranker's top
--                      (we still log so we can compare LLM vs server picks)
-- traffic_segment values mirror our ε-tiers:
--   - paid_ads       : visitor came in via Google Ads (gclid/utm cpc)
--   - organic        : SEO / direct
--   - returning      : signed-in returning user

CREATE TABLE IF NOT EXISTS concierge_recommendation_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id                 UUID NOT NULL REFERENCES concierge_chats(id) ON DELETE CASCADE,
  photographer_id         UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  rank                    SMALLINT NOT NULL,
  strategy                TEXT NOT NULL,
  fit_score               REAL,
  session_count_at_time   INT,
  review_count_at_time    INT,
  is_featured_at_time     BOOLEAN,
  is_verified_at_time     BOOLEAN,
  traffic_segment         TEXT,
  shown_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Downstream conversion signals — written by separate endpoints once
  -- the events happen. Nullable until then so we can do funnel queries
  -- with simple COALESCE / IS NOT NULL.
  clicked_profile_at      TIMESTAMPTZ,
  message_started_at      TIMESTAMPTZ,
  booking_created_at      TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_concierge_rec_chat
  ON concierge_recommendation_events (chat_id);
CREATE INDEX IF NOT EXISTS idx_concierge_rec_photographer
  ON concierge_recommendation_events (photographer_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_rec_strategy
  ON concierge_recommendation_events (strategy, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_rec_shown
  ON concierge_recommendation_events (shown_at DESC);
