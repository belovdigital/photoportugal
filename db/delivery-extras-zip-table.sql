-- The extras archive state moves OFF the bookings row (2026-08-05, same day).
--
-- bookings carries a BEFORE UPDATE trigger that stamps updated_at, and the
-- 14-day auto-accept — the cron that releases the photographer's payout for
-- the whole shoot — selects on that column. Writing extras_zip_ready to the
-- booking on every purchase therefore restarted the payout clock: a client
-- buying one EUR 2.90 photo every couple of weeks could defer hundreds of
-- euros indefinitely. A side table keeps the purchase path away from it.
CREATE TABLE IF NOT EXISTS delivery_extras_zip (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  zip_path   TEXT,
  zip_size   BIGINT,
  ready      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carry over anything the short-lived columns already held, then drop them.
INSERT INTO delivery_extras_zip (booking_id, zip_path, zip_size, ready)
SELECT id, extras_zip_path, extras_zip_size, COALESCE(extras_zip_ready, FALSE)
  FROM bookings
 WHERE extras_zip_path IS NOT NULL
ON CONFLICT (booking_id) DO NOTHING;

ALTER TABLE bookings
  DROP COLUMN IF EXISTS extras_zip_path,
  DROP COLUMN IF EXISTS extras_zip_size,
  DROP COLUMN IF EXISTS extras_zip_ready;
