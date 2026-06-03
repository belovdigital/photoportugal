-- Attribute each booking to the AI Concierge chat that produced it
-- (when applicable). Lets the new-inquiry email to the photographer
-- include the visitor's first user message, so the photographer's
-- first reply can be contextual ("I see you're looking for a beach
-- sunset shoot — here's how I'd plan it") instead of generic.
--
-- Nullable: most bookings come from /photographers catalog, not from
-- the concierge. NULL means "no chat attribution available".

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS concierge_chat_id UUID REFERENCES concierge_chats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_concierge_chat
  ON bookings (concierge_chat_id) WHERE concierge_chat_id IS NOT NULL;
