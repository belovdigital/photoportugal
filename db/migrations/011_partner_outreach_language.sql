-- Language of the outreach letter (2026-08-13).
--
-- The list is Portuguese lodging businesses, so the letter is Portuguese; the
-- English version stays for the internationally-run companies (villa
-- aggregators, UK-managed agencies) whose whole site is in English.
--
-- NULL means "this market's default", which keeps Spain and Italy honest: they
-- have no local copy yet, so their rows resolve to English rather than
-- silently going out in Portuguese.
-- Safe to run multiple times.

ALTER TABLE partner_outreach ADD COLUMN IF NOT EXISTS language VARCHAR(5);

INSERT INTO schema_migrations (version) VALUES ('011_partner_outreach_language.sql')
ON CONFLICT DO NOTHING;
