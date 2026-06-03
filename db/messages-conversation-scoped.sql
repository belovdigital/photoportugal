-- Decouple messages from bookings — actual schema change.
--
-- Before: messages had booking_id NOT NULL. Chat threads were merged in
-- queries (e.g. /api/messages/route.ts wraps the booking_id in an IN
-- subquery), but the column-level link to a specific booking row was
-- the source of repeated bugs:
--   - "Action needed" widget showed false "client is waiting" because
--     the photographer's reply was attached to a sibling booking's id
--   - SSE stream only emitted messages tied to the open booking_id
--   - mark-as-read missed sibling-booking messages
--
-- After: messages carry client_id + photographer_id directly. booking_id
-- stays as optional context for system messages (DELIVERY:, DATE_PROPOSAL:,
-- cancellation cards) that semantically belong to one booking. For normal
-- chat messages booking_id is informational only — the conversation key
-- is the (client_id, photographer_id) pair.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS photographer_id uuid REFERENCES photographer_profiles(id);

-- Backfill from existing booking links. Single UPDATE — fast on small
-- tables; if messages grows past a few million we'd batch this.
UPDATE messages m
   SET client_id = b.client_id,
       photographer_id = b.photographer_id
  FROM bookings b
 WHERE m.booking_id = b.id
   AND (m.client_id IS NULL OR m.photographer_id IS NULL);

-- Indexes for the new query shape (the hot one: "all messages between
-- this pair, ordered by created_at"). The composite index also covers
-- per-client and per-photographer lookups since either prefix is fine.
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (client_id, photographer_id, created_at)
  WHERE client_id IS NOT NULL AND photographer_id IS NOT NULL;

-- Unread-count covering index: filter on (photographer_id, client_id, sender_id)
-- + read_at IS NULL is the conversation-list aggregate path.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (photographer_id, client_id, read_at)
  WHERE read_at IS NULL;
