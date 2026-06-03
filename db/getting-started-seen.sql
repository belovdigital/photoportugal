-- Tracks whether an approved photographer has visited the getting-started
-- guide. Used to auto-redirect newly approved photographers there on
-- their first dashboard load, then never again. NULL = still owed the
-- onboarding flow.

ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS getting_started_seen_at TIMESTAMPTZ;
