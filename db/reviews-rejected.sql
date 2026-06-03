-- Soft-reject for reviews — admin can mark a review as "decided no"
-- without permanently deleting the row. Distinct from is_approved=FALSE
-- (which is the default "pending" state) and from DELETE (which loses
-- the row entirely).
--
-- Use cases:
--   - clearly fake / spammy review the admin doesn't want to surface
--   - off-topic complaints that belong in support, not reviews
--   - bot-submitted entries we want to keep for audit but never publish
--
-- The "pending" admin filter excludes rejected rows so the moderation
-- queue only shows reviews still awaiting a decision.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reviews_rejected_at
  ON reviews (rejected_at)
  WHERE rejected_at IS NOT NULL;
