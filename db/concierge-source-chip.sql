-- Track which pre-prompt chip (if any) seeded the chat. Helps us see
-- which Lens chips on the homepage / location pages actually convert
-- to matches and contact-capture vs which are dead weight. NULL when
-- the visitor typed free-text or opened the drawer cold.
ALTER TABLE concierge_chats
  ADD COLUMN IF NOT EXISTS source_chip text;

COMMENT ON COLUMN concierge_chats.source_chip IS
  'Verbatim chip text the visitor clicked to start the chat (from ConciergeInvitePlaque). NULL when chat started via free-text input.';
