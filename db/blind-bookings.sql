-- Blind booking — "we book a photographer for you" flow.
--
-- Concierge AI offers a fixed-price booking before the client picks a
-- photographer. Booking enters status='unmatched' with photographer_id
-- NULL; admin manually assigns from /admin → Unmatched tab; assigning
-- flips status to 'confirmed' and captures the Stripe auth-hold. If no
-- admin assignment happens within auto_refund_at, the void-cron cancels
-- the PaymentIntent and emails the client to rebook.

-- 1. New 'unmatched' value on the booking_status enum.
--    Must run in its own (auto-)transaction — PG forbids referencing a
--    new enum value in the same tx it was added in.
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'unmatched';

BEGIN;

-- 2. photographer_id nullable — exists for unassigned blind bookings.
--    FK stays: when set, must reference an existing photographer_profile.
ALTER TABLE bookings ALTER COLUMN photographer_id DROP NOT NULL;

-- 3. Admin assignment tracking + blind flag + auto-refund deadline.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS assigned_by    UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes    TEXT,
  ADD COLUMN IF NOT EXISTS blind_booking  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_refund_at TIMESTAMPTZ;

-- 4. Partial index — only the unmatched rows the void-cron actually scans.
CREATE INDEX IF NOT EXISTS idx_bookings_auto_refund
  ON bookings (auto_refund_at)
  WHERE auto_refund_at IS NOT NULL AND status = 'unmatched';

-- 5. Partial index — drives the admin "Unmatched" tab queue.
CREATE INDEX IF NOT EXISTS idx_bookings_unmatched
  ON bookings (created_at DESC)
  WHERE status = 'unmatched';

-- 6. Region pricing table — pre-computed median €/hour per region+occasion.
--    Server reads this when Concierge emits offer_blind_booking; LLM
--    never sees prices, so the source of truth lives here.
CREATE TABLE IF NOT EXISTS region_pricing (
  id               SERIAL PRIMARY KEY,
  region           VARCHAR(50)  NOT NULL,
  occasion         VARCHAR(50)  NOT NULL,
  duration_minutes INTEGER      NOT NULL,
  price_eur        INTEGER      NOT NULL,
  sample_size      INTEGER      NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (region, occasion, duration_minutes)
);

CREATE INDEX IF NOT EXISTS idx_region_pricing_lookup
  ON region_pricing (region, occasion, duration_minutes);

COMMIT;
