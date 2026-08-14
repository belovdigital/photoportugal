-- Remove the per-row fee columns from migration 012, now that every reader has
-- moved to stripe_payment_fees (migration 013).
--
-- Run this AFTER the code that reads the side table is deployed, not with 013.
-- Whichever of the two shapes the running code expects, the other is the one
-- that exists — doing both in one step blanks the revenue figures for the
-- length of a deploy.
--
-- The point of removing them is that they were never safe to write: a column on
-- bookings means UPDATE bookings, which fires the trigger that rewrites
-- updated_at, which is what the auto-accept, the auto-refund and the client's
-- delivery countdown all key off. Leaving the columns in place leaves that
-- footgun loaded for the next person who sees a convenient empty column.

DROP INDEX IF EXISTS idx_bookings_stripe_fee_missing;

ALTER TABLE bookings                 DROP COLUMN IF EXISTS stripe_fee_cents;
ALTER TABLE delivery_extra_purchases DROP COLUMN IF EXISTS stripe_fee_cents;
ALTER TABLE tips                     DROP COLUMN IF EXISTS stripe_fee_cents;
