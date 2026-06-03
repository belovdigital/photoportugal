-- Phase 1 of the photographer↔client chat translation feature.
-- Adds columns on `messages` to cache an AI-generated translation of the
-- original `text` (so each row is translated at most once). The original
-- `text` is preserved unchanged.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS detected_language TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS translated_text TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS translated_to_lang TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS translation_skip_reason TEXT;

-- Used to find rows that still need translating (NULL detected_language).
CREATE INDEX IF NOT EXISTS idx_messages_untranslated
  ON messages (created_at DESC)
  WHERE detected_language IS NULL AND text IS NOT NULL;
