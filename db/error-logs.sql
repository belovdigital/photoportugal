-- Error logs: every 5xx server error from API routes / pages.
-- Throttled email alerts to cto@thebelov.com. See src/lib/error-logger.ts.

CREATE TABLE IF NOT EXISTS error_logs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Throttling fingerprint: path + error class. Same fingerprint => merged into one row + count.
  fingerprint   TEXT         NOT NULL,

  -- Request context
  path          TEXT,
  method        TEXT,
  status_code   INT,

  -- Error content
  error_class   TEXT,        -- e.g. 'TypeError', 'pg_error_42703', 'Error'
  error_message TEXT,
  error_stack   TEXT,

  -- Who hit it (best effort — null for anonymous traffic)
  user_id       UUID,
  user_email    TEXT,
  user_role     TEXT,

  -- Request payload (truncated to 2KB to keep rows small)
  request_query TEXT,
  request_body  JSONB,
  user_agent    TEXT,
  ip            TEXT,
  referrer      TEXT,

  -- Email throttling state
  email_sent_at TIMESTAMPTZ,
  email_count   INT          NOT NULL DEFAULT 0,

  -- Aggregation counters
  occurrence_count INT       NOT NULL DEFAULT 1,
  first_seen    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Manual triage
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID,
  notes         TEXT
);

-- Fast lookup: "is there an unresolved row for this fingerprint in the last hour?"
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint_recent
  ON error_logs (fingerprint, last_seen DESC)
  WHERE resolved_at IS NULL;

-- Admin dashboard listing
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs (resolved_at) WHERE resolved_at IS NULL;
