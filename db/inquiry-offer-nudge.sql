-- 2026-07-12: inquiry offer-nudge flags.
--
-- Evidence (prod, 90d): 32 inquiries stuck >7 days; 31 of them had
-- photographer replies in chat but NO package and NO price attached —
-- the client had nothing to pay for, and the existing client-side
-- follow-ups ("reply to the photographer") couldn't help. New cron
-- section nudges the photographer to send a bookable custom package
-- 48h after their first reply, and alerts admin via Telegram on day 5.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_nudge_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_nudge_admin_alerted BOOLEAN DEFAULT FALSE;
