-- Add price column to match_request_photographers
-- This stores the per-photographer price set by admin when sending matches
ALTER TABLE match_request_photographers ADD COLUMN IF NOT EXISTS price INTEGER;
