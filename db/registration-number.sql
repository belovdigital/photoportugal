-- Add sequential registration number for photographers
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS registration_number INTEGER;

-- Set Katya (Ekaterina Belova) as founding #1
UPDATE photographer_profiles
SET is_founding = TRUE, early_bird_tier = 'founding', registration_number = 1
WHERE display_name ILIKE '%Ekaterina%' OR display_name ILIKE '%Kate%Belo%';

-- Set test photographers registration_number = 0 (excluded from count)
UPDATE photographer_profiles
SET registration_number = 0
WHERE registration_number IS NULL AND NOT (display_name ILIKE '%Ekaterina%' OR display_name ILIKE '%Kate%Belo%');
