-- Persist the real Stripe Checkout amounts after discounts.
-- Safe to run multiple times.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_amount_subtotal_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_amount_paid_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_amount_discount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_currency VARCHAR(10),
  ADD COLUMN IF NOT EXISTS stripe_promo_code TEXT,
  ADD COLUMN IF NOT EXISTS stripe_coupon_name TEXT,
  ADD COLUMN IF NOT EXISTS stripe_coupon_percent_off NUMERIC;

COMMENT ON COLUMN bookings.stripe_amount_subtotal_cents IS 'Stripe Checkout subtotal before discounts, in minor currency units.';
COMMENT ON COLUMN bookings.stripe_amount_paid_cents IS 'Actual amount paid in Stripe Checkout after discounts/taxes, in minor currency units.';
COMMENT ON COLUMN bookings.stripe_amount_discount_cents IS 'Total Stripe Checkout discount amount, in minor currency units.';
COMMENT ON COLUMN bookings.stripe_promo_code IS 'Customer-entered Stripe promotion code, when available.';
