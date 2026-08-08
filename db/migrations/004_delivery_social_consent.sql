-- Client's permission to use a few photos from their delivery on the
-- platform's own social accounts, captured at the moment they accept.
--
-- Stored per booking, with the timestamp, because that is the only record of
-- WHEN it was given and against which delivery. A consent nobody can date is
-- not a consent anyone can rely on later.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS social_consent boolean;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS social_consent_at timestamptz;

INSERT INTO schema_migrations (version) VALUES ('004_delivery_social_consent.sql')
ON CONFLICT DO NOTHING;
