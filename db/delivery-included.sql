-- "Included in the delivery" flag (2026-08-05).
--
-- Until now every consumer of delivery_photos read `WHERE booking_id = $1`
-- unfiltered, so whatever a photographer uploaded WAS the delivery. Splitting
-- those into two sets is the groundwork for letting the client choose which
-- photos they get, and for charging for the ones beyond the promise.
--
-- DEFAULT TRUE and NOT NULL on purpose: every existing row, and every row
-- created before any UI can toggle this, stays part of the delivery. This
-- migration and the queries that read it are therefore a no-op on deploy —
-- which is the point. The behaviour changes only when something starts
-- setting the flag to FALSE.
ALTER TABLE delivery_photos
  ADD COLUMN IF NOT EXISTS is_included BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_delivery_photos_booking_included
  ON delivery_photos (booking_id) WHERE is_included = TRUE;
