-- Warn a photographer before their plan lapses, instead of silently moving
-- them to Free.
--
-- The early-bird expiry cron (api/cron/reminders, "Early Bird tier
-- expiration") flipped plan → 'free' with no email at all. For a Premium
-- holder that silently doubles the commission (10% → 20%), caps them to one
-- location and drops their custom slug. Seven photographers were due to hit
-- that in November 2026 with no warning.
--
-- One timestamp so the 14-day warning is sent once per expiry period. NULL
-- means "not warned yet"; the cron clears it again on downgrade so a future
-- paid plan starts clean.
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS plan_expiry_warned_at timestamptz;

INSERT INTO schema_migrations (version) VALUES ('005_plan_expiry_warning.sql')
ON CONFLICT DO NOTHING;
