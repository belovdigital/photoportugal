-- Logs the LLM-generated reply chips we offered to the photographer plus
-- whether they actually used one. We need BOTH positive (chip clicked) and
-- negative (none-of-these-fit pressed) data points to evaluate suggestion
-- quality and tune the prompt over time.

CREATE TABLE IF NOT EXISTS chat_chip_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID REFERENCES photographer_profiles(id) ON DELETE SET NULL,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_message_text TEXT,
  chips_offered TEXT[] NOT NULL,
  chip_chosen TEXT,                       -- NULL = miss ("none fit"); else the chip text the photographer used
  outcome TEXT NOT NULL,                  -- 'hit' | 'miss'
  intent_snapshot JSONB,                  -- the AI-extracted intent at time of suggestion
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chip_feedback_recent
  ON chat_chip_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chip_feedback_photographer
  ON chat_chip_feedback (photographer_id, created_at DESC);
