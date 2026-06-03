-- Kate's "can we share your photos on social?" email is sent ~48h after
-- the client accepts delivery. We need a per-booking timestamp so the
-- cron doesn't re-send to the same client every run.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS social_permission_email_sent_at TIMESTAMPTZ;

-- Cron lookup: accepted deliveries that are old enough to warrant the
-- ask but haven't been emailed yet.
CREATE INDEX IF NOT EXISTS idx_bookings_social_permission_pending
  ON bookings (delivery_accepted_at)
  WHERE delivery_accepted_at IS NOT NULL
    AND social_permission_email_sent_at IS NULL;
