-- Gift bookings: the buyer (client_id) pays for a session that someone
-- else (gift_recipient_user_id) will attend and receive the delivery.
--
-- Flow:
--   1. Buyer ticks "this is a gift", enters recipient name + email +
--      WhatsApp + reveal mode ("send card now" OR "N days before shoot").
--   2. API looks up users by recipient email. If found → link.
--      If not → create a dormant user (password_hash IS NULL, role=client).
--   3. Cron processes rows where gift_reveal_at <= NOW() and not yet sent,
--      emails the recipient a magic-link to /gift/claim?token=...
--   4. Recipient claims → sets a password if dormant → signs in → can
--      view booking + accept delivery + leave review.
--
-- Photographer sees a "🎁 gift booking" tag and gift_recipient_phone
-- (WhatsApp) only after gift_reveal_at; the contact stays hidden before
-- to preserve the surprise.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gift_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS gift_recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS gift_recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS gift_recipient_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS gift_reveal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gift_reveal_sent_at TIMESTAMPTZ;

-- Cron picks up rows ready for reveal in O(1) via this partial index.
CREATE INDEX IF NOT EXISTS idx_bookings_gift_reveal_pending
  ON bookings (gift_reveal_at)
  WHERE is_gift = TRUE AND gift_reveal_sent_at IS NULL AND gift_reveal_at IS NOT NULL;

-- Looking up "is the booking I'm viewing a gift for me?" lands here.
CREATE INDEX IF NOT EXISTS idx_bookings_gift_recipient_user
  ON bookings (gift_recipient_user_id)
  WHERE gift_recipient_user_id IS NOT NULL;
