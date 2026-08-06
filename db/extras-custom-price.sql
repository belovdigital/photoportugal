-- Photographers set their own price for extra photos (2026-08-06).
--
-- They set what THEY RECEIVE, not what the client pays. The client price is
-- derived (+25%, rounded up to the nearest 10 cents) so a photographer never
-- has to think about our cut to answer "how much do I get per photo".
--
-- Default 500 = €5.00 to the photographer, €6.30 to the client. The old flat
-- €2.90/€2.00 is deliberately NOT preserved: nothing has ever been sold at it
-- (delivery_extra_purchases is empty on both markets), so there is no history
-- to respect and no reason to carry two regimes.
ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS extra_photo_payout_cents INTEGER NOT NULL DEFAULT 500;

-- Snapshot on the booking, for the same reason total_price and service_fee are
-- snapshotted: a photographer raising their price must never change what a
-- client was already quoted on a gallery they are looking at. Written when the
-- booking is created; NULL on everything that predates this and resolved from
-- the profile in that case.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS extra_photo_payout_cents INTEGER,
  ADD COLUMN IF NOT EXISTS extra_photo_price_cents INTEGER;

COMMENT ON COLUMN photographer_profiles.extra_photo_payout_cents IS
  'What the photographer receives per extra photo sold. Client price is derived.';
COMMENT ON COLUMN bookings.extra_photo_payout_cents IS
  'Snapshot of the photographer rate at booking time. NULL = resolve from profile.';
COMMENT ON COLUMN bookings.extra_photo_price_cents IS
  'Snapshot of the client price at booking time. NULL = derive from the payout.';

-- Snapshot on INSERT rather than in the four route handlers that create
-- bookings (bookings, inquiries, match-request/choose, blind-booking/accept).
-- A trigger cannot be forgotten by the fifth one, and this table already uses
-- a BEFORE trigger for updated_at, so it is not a new idiom here.
--
-- Blind bookings have no photographer yet: the columns stay NULL and resolve
-- from the profile once one is assigned, which is the correct answer for a
-- booking whose photographer was unknown at the time.
CREATE OR REPLACE FUNCTION snapshot_extra_photo_price() RETURNS TRIGGER AS $$
DECLARE payout INTEGER;
BEGIN
  IF NEW.extra_photo_payout_cents IS NULL AND NEW.photographer_id IS NOT NULL THEN
    SELECT extra_photo_payout_cents INTO payout
      FROM photographer_profiles WHERE id = NEW.photographer_id;
    IF payout IS NOT NULL THEN
      NEW.extra_photo_payout_cents := payout;
      -- +25%, rounded UP to the nearest 10 cents. Mirrors
      -- clientExtraPriceCents() in src/lib/extras-pricing.ts; if one changes,
      -- the other must.
      NEW.extra_photo_price_cents := CEIL(ROUND(payout * 1.25) / 10.0) * 10;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_extra_photo_price ON bookings;
CREATE TRIGGER trg_snapshot_extra_photo_price
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION snapshot_extra_photo_price();
