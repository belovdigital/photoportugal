-- Calendar sync: photographers connect their personal calendars (Google,
-- Apple/Outlook/anything iCal-compliant via webcal://) so dates already
-- booked there can't be double-booked through Photo Portugal.
--
-- v1 design:
--   * Read-only — we never write to the photographer's calendar.
--   * Two connection types: 'google' (OAuth) and 'ical' (subscription URL).
--   * Multi-calendar via either:
--      - Google: one connection per Google account, with `selected_calendar_ids`
--        listing which of that account's calendars to honour as busy.
--      - iCal: one connection per URL — if a photographer wants to merge
--        personal + work feeds, they add two URLs.
--   * Busy windows live in their own table and are rebuilt on each sync.
--     We don't store event titles/attendees — only [start, end) ranges.

CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('google', 'ical')),

  -- Human-readable label shown in the dashboard. Photographer can rename.
  display_name TEXT NOT NULL,

  -- ===== Google fields =====
  google_email TEXT,
  google_refresh_token TEXT,        -- long-lived, never returned to client
  google_access_token TEXT,         -- short-lived, refreshed on demand
  google_access_token_expires_at TIMESTAMPTZ,
  -- Calendar IDs from this Google account that should count as "busy".
  -- Empty/NULL means "all primary" until the user picks via the UI.
  selected_calendar_ids TEXT[],

  -- ===== iCal fields =====
  ical_url TEXT,

  -- ===== Common =====
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  last_sync_event_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (type = 'google' AND google_refresh_token IS NOT NULL AND ical_url IS NULL)
    OR
    (type = 'ical' AND ical_url IS NOT NULL AND google_refresh_token IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_photographer
  ON calendar_connections(photographer_id) WHERE is_active = TRUE;

-- Prevent the same photographer from adding the same iCal URL twice
-- (Google de-dupes naturally on email).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_calendar_connections_ical_url
  ON calendar_connections(photographer_id, ical_url)
  WHERE type = 'ical' AND ical_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_calendar_connections_google_email
  ON calendar_connections(photographer_id, google_email)
  WHERE type = 'google' AND google_email IS NOT NULL;

-- Cached busy windows from the last sync. Rebuilt fully on each sync —
-- we don't try to do incremental diffs. Photographers' calendars rarely
-- have so many events that a full rebuild is expensive.
CREATE TABLE IF NOT EXISTS calendar_busy_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  -- Source UID lets us de-dup recurring events when an iCal feed expands
  -- a single VEVENT into multiple instances (we expand to RDATE/RRULE on
  -- the client side); for Google the event id serves the same purpose.
  source_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (ends_at > starts_at)
);

-- Range queries: "is the photographer busy between [X, Y)?" — covers most
-- conflict checks at booking time.
CREATE INDEX IF NOT EXISTS idx_busy_slots_photographer_range
  ON calendar_busy_slots(photographer_id, starts_at, ends_at);

-- Cleanup: drop slots ending in the past after each sync; this index
-- speeds the DELETE.
CREATE INDEX IF NOT EXISTS idx_busy_slots_ends_at
  ON calendar_busy_slots(ends_at);
