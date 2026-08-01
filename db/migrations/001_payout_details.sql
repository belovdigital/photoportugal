-- Bank payout details for markets without Stripe Connect.
--
-- Spain: the operating company is Portuguese and not registered in Spain, so
-- Connect onboarding is unavailable to Spanish photographers. They are paid by
-- transfer after funds clear, and these columns hold what that transfer needs.
--
-- Portugal is unaffected: the columns stay NULL and every Connect code path is
-- untouched (see src/lib/payout.ts, which switches on the country pack).
--
-- IBAN is personal data. It must never appear in a general profile SELECT —
-- only the owning photographer and the admin payout queue may read it.

ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS payout_iban text;
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS payout_holder text;
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS payout_tax_id text;
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS payout_details_updated_at timestamptz;

-- Ledger of hand-made transfers, so the admin queue knows what is still owed.
CREATE TABLE IF NOT EXISTS manual_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  status varchar(20) NOT NULL DEFAULT 'pending', -- pending | paid | failed
  reference text,                                -- bank transfer reference
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_manual_payouts_photographer ON manual_payouts(photographer_id);
CREATE INDEX IF NOT EXISTS idx_manual_payouts_status ON manual_payouts(status);
