-- Concierge: capture phone number for WhatsApp lead path.
-- Used by /api/concierge/whatsapp when a visitor picks WhatsApp instead
-- of email after matches are shown. We store the raw number (no
-- normalisation here — keep what they typed), with country hint when
-- available from visitor_sessions.
ALTER TABLE concierge_chats ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE concierge_chats ADD COLUMN IF NOT EXISTS phone_captured_at timestamp with time zone;
COMMENT ON COLUMN concierge_chats.phone IS 'Visitor phone for WhatsApp follow-up. Captured via the post-match CTA, not normalised.';
COMMENT ON COLUMN concierge_chats.phone_captured_at IS 'When the phone was first saved. NULL until visitor opts in.';
