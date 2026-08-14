-- Move Stripe's fee out of the money tables and into its own.
--
-- Migration 012 put stripe_fee_cents on bookings, and writing it meant
-- `UPDATE bookings`. That table carries a BEFORE UPDATE trigger which rewrites
-- updated_at unconditionally, and updated_at is not decorative here: the 14-day
-- auto-accept that releases a photographer's payout, the 21-day auto-refund,
-- the delivery countdown the client is shown, and the daily digest's 24-hour
-- window all key off it. The first backfill moved 65 of those clocks at once.
-- (The codebase already knew: delivery/[token]/extras/route.ts takes an
-- advisory lock specifically to avoid touching the bookings row for this
-- reason. 012 walked straight into it.)
--
-- Keying by PaymentIntent instead of by row also removes a second problem.
-- A basket of extra photos is many rows sharing one payment and one fee, so the
-- per-row column needed an anchor row holding the whole fee and siblings
-- holding an explicit 0 — an invariant nothing enforced. A primary key on the
-- payment id enforces one fee per payment by construction.

CREATE TABLE IF NOT EXISTS stripe_payment_fees (
  payment_intent_id TEXT PRIMARY KEY,
  fee_cents         INTEGER NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stripe_payment_fees IS
  'What Stripe charged to take one payment, from balance_transaction.fee. Read by the admin revenue KPI, the revenue chart and the daily digest. Deliberately NOT a column on bookings — see migration 013.';

-- Carry over whatever 012 already collected. MAX() per payment because the
-- extras layout stored the fee on one row and 0 on its siblings.
INSERT INTO stripe_payment_fees (payment_intent_id, fee_cents)
SELECT stripe_payment_intent_id, MAX(stripe_fee_cents)
  FROM bookings
 WHERE stripe_payment_intent_id IS NOT NULL AND stripe_fee_cents IS NOT NULL
 GROUP BY stripe_payment_intent_id
ON CONFLICT (payment_intent_id) DO NOTHING;

INSERT INTO stripe_payment_fees (payment_intent_id, fee_cents)
SELECT stripe_payment_intent_id, MAX(stripe_fee_cents)
  FROM delivery_extra_purchases
 WHERE stripe_payment_intent_id IS NOT NULL AND stripe_fee_cents IS NOT NULL
 GROUP BY stripe_payment_intent_id
ON CONFLICT (payment_intent_id) DO NOTHING;

INSERT INTO stripe_payment_fees (payment_intent_id, fee_cents)
SELECT stripe_payment_intent_id, MAX(stripe_fee_cents)
  FROM tips
 WHERE stripe_payment_intent_id IS NOT NULL AND stripe_fee_cents IS NOT NULL
 GROUP BY stripe_payment_intent_id
ON CONFLICT (payment_intent_id) DO NOTHING;

-- The columns 012 added are deliberately left in place here. Dropping them in
-- the same step as creating this table would blank the revenue figures for the
-- length of a deploy: whichever of the two the running code expects, the other
-- is the one that exists. Migration 014 drops them once the new code is live.
