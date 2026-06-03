-- Gift cards: pre-paid Photo Portugal sessions in two standard tiers.
-- Buyer picks a tier (Express €290 or Full €490), pays via Stripe, the
-- recipient gets an email + SMS with a magic-link to claim. After claim
-- the recipient browses participating photographers and books — the
-- gift card covers the entire session price, no payment step.
--
-- Tier pricing is platform-wide and fixed. Photographer payout is fixed
-- per tier (€210 Express / €360 Full) — independent of their plan
-- commission — so platform margin is roughly uniform (~27%).
--
-- Flow states:
--   purchased  → Stripe paid, email/SMS not yet sent (transient, <1 min)
--   sent       → recipient was emailed; awaiting claim
--   claimed    → recipient signed in (dormant-user pattern); awaiting booking
--   redeemed   → booking created; gift card consumed
--   expired    → 12 months elapsed without redemption (silent forfeit)
--
-- Cancel-restore: if a photographer cancels a gift-redeemed booking,
-- the card flips back to `claimed` and expires_at extends by 30 days.

-- ── Two new columns on existing tables ─────────────────────────────

ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS accepts_gift_cards BOOLEAN DEFAULT TRUE;

-- packages.tier identifies the auto-created standard tier package for
-- each participating photographer. A photographer may have many normal
-- packages plus exactly one row per tier.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gift_card_tier') THEN
    CREATE TYPE gift_card_tier AS ENUM ('express', 'full');
  END IF;
END$$;

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS tier gift_card_tier;

CREATE UNIQUE INDEX IF NOT EXISTS idx_packages_one_tier_per_photographer
  ON packages (photographer_id, tier)
  WHERE tier IS NOT NULL;

-- ── gift_cards table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  tier gift_card_tier NOT NULL,
  amount numeric(10,2) NOT NULL,        -- what buyer paid (€290 or €490)
  photographer_payout numeric(10,2) NOT NULL,  -- what photographer gets (€210 or €360)
  status text NOT NULL DEFAULT 'purchased'
    CHECK (status IN ('purchased','sent','claimed','redeemed','expired','refunded')),

  -- Buyer side
  buyer_user_id uuid REFERENCES users(id),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,

  -- Recipient side
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  recipient_phone text,                 -- optional, for SMS notification
  recipient_user_id uuid REFERENCES users(id),  -- dormant or existing user
  personal_message text,                -- optional note from buyer

  -- Redemption
  booking_id uuid REFERENCES bookings(id),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,                  -- when notification fired
  claimed_at timestamptz,               -- when recipient first signed in
  redeemed_at timestamptz,              -- when booking was created
  expires_at timestamptz NOT NULL,      -- 12 months from purchase (initial)
  expiry_warning_30d_sent boolean DEFAULT FALSE,
  expiry_warning_7d_sent boolean DEFAULT FALSE,
  expiry_warning_1d_sent boolean DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_user ON gift_cards (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards (status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards (code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_pending_expiry
  ON gift_cards (expires_at)
  WHERE status IN ('sent','claimed');

-- ── Recipient mode state on users ─────────────────────────────────
-- When a recipient claims a gift card, we set active_gift_card_id on
-- their user row so all gift-aware pages know to render gift-mode.
-- Cleared on redemption or when they sign out.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_gift_card_id uuid REFERENCES gift_cards(id);

CREATE INDEX IF NOT EXISTS idx_users_active_gift_card
  ON users (active_gift_card_id)
  WHERE active_gift_card_id IS NOT NULL;

-- ── Backfill: standard tier packages for every approved, active
-- photographer who currently has no tier packages. Default opt-in
-- means the column already defaulted to TRUE for them.

INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, delivery_days, tier, is_popular, is_public)
SELECT
  pp.id,
  'Express Gift Session',
  'A 1-hour photo session — perfect for solo portraits, branding, or a casual couple shoot. Includes 30 edited photos delivered within 7 days.',
  60,
  30,
  290,        -- price field stores buyer-facing price for display consistency
  7,
  'express'::gift_card_tier,
  FALSE,
  FALSE       -- not publicly browseable; only shown to gift-card recipients
FROM photographer_profiles pp
JOIN users u ON u.id = pp.user_id
WHERE pp.is_approved = TRUE
  AND COALESCE(u.is_banned, FALSE) = FALSE
  AND COALESCE(pp.is_test, FALSE) = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM packages p WHERE p.photographer_id = pp.id AND p.tier = 'express'
  );

INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, delivery_days, tier, is_popular, is_public)
SELECT
  pp.id,
  'Full Gift Session',
  'A 2-hour photo session across up to 2 locations, with one outfit change. Includes 60 edited photos delivered within 7 days — ideal for engagements, anniversaries, or family shoots.',
  120,
  60,
  490,
  7,
  'full'::gift_card_tier,
  FALSE,
  FALSE
FROM photographer_profiles pp
JOIN users u ON u.id = pp.user_id
WHERE pp.is_approved = TRUE
  AND COALESCE(u.is_banned, FALSE) = FALSE
  AND COALESCE(pp.is_test, FALSE) = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM packages p WHERE p.photographer_id = pp.id AND p.tier = 'full'
  );
