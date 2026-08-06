-- Paid extra photos (2026-08-05). Step one: the money path only, no UI.
--
-- Shape copied from `tips`: a pending row written before the redirect, flipped
-- to paid by the Stripe webhook, with the photographer's share pushed out as a
-- separate Connect transfer. Differences that matter:
--   * one row PER PHOTO, so a refund or a dispute can be reasoned about per
--     item and the money record survives the photo itself;
--   * repeat purchases are allowed — do NOT copy tips' one-paid-per-booking
--     unique index. The uniqueness here is per photo;
--   * no foreign key to delivery_photos. The 180-day cleanup deletes those
--     rows, and a cascade would erase the record that money changed hands.
--     The photo id is kept as a plain uuid plus a filename snapshot.
CREATE TABLE IF NOT EXISTS delivery_extra_purchases (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id                 UUID NOT NULL,
  booking_id               UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  delivery_photo_id        UUID NOT NULL,
  photo_filename           TEXT,
  client_id                UUID REFERENCES users(id),
  photographer_id          UUID REFERENCES photographer_profiles(id),
  amount_cents             INTEGER NOT NULL,
  platform_fee_cents       INTEGER NOT NULL,
  payout_cents             INTEGER NOT NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
  transferred              BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at                  TIMESTAMPTZ,
  CONSTRAINT delivery_extra_purchases_amount_split
    CHECK (amount_cents = platform_fee_cents + payout_cents)
);

-- A photo can be sold once. Pending rows are free to pile up (abandoned
-- checkouts); only a paid one blocks a second sale.
CREATE UNIQUE INDEX IF NOT EXISTS idx_extra_purchase_one_paid_per_photo
  ON delivery_extra_purchases (delivery_photo_id) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_extra_purchase_booking ON delivery_extra_purchases (booking_id);
CREATE INDEX IF NOT EXISTS idx_extra_purchase_order ON delivery_extra_purchases (order_id);
CREATE INDEX IF NOT EXISTS idx_extra_purchase_untransferred
  ON delivery_extra_purchases (paid_at) WHERE status = 'paid' AND transferred = FALSE;

-- Bought, as opposed to promised. Deliberately NOT is_included: that column
-- means "part of what the booking promised" and is what the delivery guard
-- counts and what the frozen main archive was built from. A purchase must not
-- rewrite the promise retroactively.
ALTER TABLE delivery_photos
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_delivery_photos_purchased
  ON delivery_photos (booking_id) WHERE purchased_at IS NOT NULL;
