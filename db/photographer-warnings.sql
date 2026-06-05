-- photographer_warnings — manual warnings issued by admins against
-- photographers for incidents (unresponsiveness, no-show, quality,
-- conduct, etc). Internal-only audit trail; not exposed to
-- photographers in V1. Lifecycle: active → resolved | overturned.

CREATE TABLE IF NOT EXISTS photographer_warnings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id        UUID NOT NULL
                           REFERENCES photographer_profiles(id) ON DELETE CASCADE,

  category               VARCHAR(40) NOT NULL CHECK (category IN (
                           'no-show',
                           'late-delivery',
                           'unresponsive',
                           'quality',
                           'billing',
                           'conduct',
                           'policy',
                           'safety',
                           'misrepresentation',
                           'availability-conflict',
                           'other'
                         )),
  severity               VARCHAR(10) NOT NULL DEFAULT 'minor' CHECK (severity IN (
                           'info', 'minor', 'major', 'critical'
                         )),
  title                  VARCHAR(200) NOT NULL,
  comment                TEXT NOT NULL CHECK (length(comment) BETWEEN 5 AND 4000),

  -- Time the incident happened (user-supplied) vs when the warning
  -- was logged (auto). Both required for accurate audit trail.
  incident_date          DATE NOT NULL,
  issued_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Admin who issued the warning. Admins authenticate via JWT cookie
  -- (no users row), so we store email + display-name snapshots
  -- instead of a FK. Snapshot survives staff turnover.
  issued_by_email        VARCHAR(255) NOT NULL,
  issued_by_name         VARCHAR(120),

  -- Optional cross-references — anchor the warning to a concrete
  -- booking and / or the client who reported the incident. ON DELETE
  -- SET NULL preserves the warning record if the booking is hard-
  -- deleted later.
  related_booking_id     UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reporter_email         VARCHAR(255),

  -- Lifecycle. 'active' = open, 'resolved' = photographer fixed /
  -- complaint stale, 'overturned' = admin decided the warning was
  -- issued in error.
  status                 VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
                           'active', 'resolved', 'overturned'
                         )),
  resolution_note        TEXT,
  resolved_at            TIMESTAMPTZ,
  resolved_by_email      VARCHAR(255),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Incident has to have happened on or before the day we log it.
  CHECK (incident_date <= (issued_at AT TIME ZONE 'UTC')::date)
);

-- "Open queue" — drives the Warnings tab when filtered to active.
CREATE INDEX IF NOT EXISTS idx_warnings_open_queue
  ON photographer_warnings (severity, issued_at DESC)
  WHERE status = 'active';

-- "Warnings on photographer X" — drives the per-photographer view
-- and the AdminPhotographersList badge count.
CREATE INDEX IF NOT EXISTS idx_warnings_by_photographer
  ON photographer_warnings (photographer_id, issued_at DESC);

-- "Warning attached to booking Y" — surfaces in AdminBookingsList
-- if we later wire it in.
CREATE INDEX IF NOT EXISTS idx_warnings_by_booking
  ON photographer_warnings (related_booking_id)
  WHERE related_booking_id IS NOT NULL;

-- Touch updated_at on UPDATE.
CREATE OR REPLACE FUNCTION touch_warnings_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS warnings_touch_updated_at ON photographer_warnings;
CREATE TRIGGER warnings_touch_updated_at BEFORE UPDATE ON photographer_warnings
  FOR EACH ROW EXECUTE FUNCTION touch_warnings_updated_at();

-- Aggregate view — drives the warning count chip in
-- AdminPhotographersList and the open-count sidebar badge in
-- AdminDashboard. Cheap to query thanks to the partial index.
CREATE OR REPLACE VIEW v_photographer_warning_counts AS
SELECT
  photographer_id,
  COUNT(*) FILTER (WHERE status = 'active')                                 AS open_count,
  COUNT(*) FILTER (WHERE status = 'active' AND severity = 'critical')       AS critical_open_count,
  COUNT(*) FILTER (WHERE status = 'active' AND severity = 'major')          AS major_open_count,
  MAX(issued_at) FILTER (WHERE status = 'active')                           AS last_warning_at
FROM photographer_warnings
GROUP BY photographer_id;
