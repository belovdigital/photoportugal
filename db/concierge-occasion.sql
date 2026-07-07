-- Persist the inferred occasion (shoot-type slug) per concierge chat.
--
-- Until now the occasion a visitor wants (wedding, couples, proposal…) was
-- only ever present inside the messages JSONB — never a queryable column —
-- so "how many wedding concierge chats happened and how many converted?"
-- was unanswerable. The chat route now writes the server-resolved intent
-- occasion on every turn, and bookings.occasion is back-filled from it when
-- a concierge chat converts to a booking.
--
-- Safe to run repeatedly.
ALTER TABLE concierge_chats ADD COLUMN IF NOT EXISTS occasion VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_concierge_occasion
  ON concierge_chats(occasion) WHERE occasion IS NOT NULL;
