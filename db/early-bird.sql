-- Early Bird tier system for photographer onboarding
-- Tiers: founding (first 10), early (next 50), first100 (next 100)

ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS is_founding BOOLEAN DEFAULT FALSE;
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS early_bird_tier VARCHAR(20); -- 'founding', 'early50', 'first100'
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS early_bird_expires_at TIMESTAMPTZ; -- NULL = never expires (founding)
