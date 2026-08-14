-- What Stripe charged us to take the client's money.
--
-- Revenue is "client paid minus photographer payout", and Stripe's cut was
-- never any part of it: the money left the balance without appearing in a
-- number anyone reads. On 2026-08-14 that was €855 of fees against €4,739 of
-- reported revenue — 18% of the platform's earnings, invisible on every screen.
-- It is also nearer 2.7% of turnover than the 1.5% the pricing assumes, because
-- most clients pay with non-EEA cards.
--
-- Stored per row rather than summed live from balance transactions, for two
-- reasons. The KPI card and the revenue chart must agree bucket by bucket, and
-- only a per-row number can be grouped by day. And walking every balance
-- transaction on each admin page load stops working somewhere around the first
-- few thousand payments.
--
-- Nullable on purpose: NULL means "not known yet", which is a real state. A
-- blind booking is authorised days before it is captured, and no fee exists
-- until capture. Revenue treats NULL as zero, so a fee that has not landed yet
-- overstates revenue slightly rather than erasing the booking.
--
-- Stripe does NOT return its fee when a charge is refunded, so this column
-- stays put when money goes back to the client. That is the correct
-- accounting: we really did pay it.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_fee_cents INTEGER;

ALTER TABLE delivery_extra_purchases
  ADD COLUMN IF NOT EXISTS stripe_fee_cents INTEGER;

-- Tips are 100% pass-through to the photographer, so their fee is a pure cost
-- with no revenue to net it against. Recorded so the loss is at least countable
-- rather than silently eaten.
ALTER TABLE tips
  ADD COLUMN IF NOT EXISTS stripe_fee_cents INTEGER;

-- The sweep that fills stragglers looks for rows that are paid, have a payment
-- intent, and no fee recorded yet.
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_fee_missing
  ON bookings (created_at)
  WHERE payment_status = 'paid'
    AND stripe_payment_intent_id IS NOT NULL
    AND stripe_fee_cents IS NULL;
