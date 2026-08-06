-- Photographer's gift: N of the paid extras, free (2026-08-06).
--
-- The photographer grants the slots; the client picks which photos to spend
-- them on. Redemptions are NOT a counter here — they are zero-amount paid
-- rows in delivery_extra_purchases (amount 0/0/0, status 'paid'), so the
-- redemption path writes nothing to bookings (the updated_at trigger there
-- feeds the 14-day auto-accept) and every downstream rule — one paid row per
-- photo, purchased_at, the archive, the cleanup — treats a gifted photo
-- exactly like a bought one.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS extras_gift_slots INTEGER NOT NULL DEFAULT 0;
