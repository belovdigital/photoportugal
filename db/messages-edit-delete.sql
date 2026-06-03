-- Edit/delete support for chat messages.
--
-- Policy:
--   - sender can edit or delete within 15 minutes of created_at
--   - blocked once the OTHER party has read it (read_at IS NOT NULL)
--   - blocked for is_system=TRUE messages (booking cards, date proposals,
--     delivery, review request, payment system events — these are data,
--     not chat)
--   - blocked when there's an open dispute on the booking — preserves
--     evidence for admin resolution
--   - delete is SOFT (deleted_at + tombstone in UI). Text stays in DB
--     for admin/dispute lookup.
--   - first edit copies the current text into original_text so we keep
--     the audit trail even across multiple edits

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_text TEXT;

-- Light index for admin lookups of deleted/edited messages by date.
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON messages (deleted_at)
  WHERE deleted_at IS NOT NULL;
