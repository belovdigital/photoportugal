-- Client "accept your delivery" reminder tracking (5d + 12d stages).
-- Clients who never press "Accept delivery" freeze the escrow — the
-- photographer stays unpaid. Stamped by /api/cron/reminders §3d.
-- Safe to run multiple times.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS delivery_accept_reminder_5d_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_accept_reminder_12d_sent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN bookings.delivery_accept_reminder_5d_sent IS 'Client accept-delivery nudge ~5 days after delivery (cron reminders §3d)';
COMMENT ON COLUMN bookings.delivery_accept_reminder_12d_sent IS 'Final client accept-delivery nudge ~12 days after delivery (cron reminders §3d)';
