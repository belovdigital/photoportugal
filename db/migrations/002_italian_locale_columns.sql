-- Italian translations for the locale-suffixed content columns.
--
-- Every page that renders a photographer's bio, a package name or a review in a
-- non-English locale builds its column name from the locale:
--   COALESCE(p.bio_${locale}, p.bio)
-- so a locale is only usable once its columns exist. Italian was missing, which
-- is why `it` had to stay out of the "translatable locales" set in 17 files and
-- the Italian site read English bios on its own market.
--
-- Applied to ALL THREE databases, not just Italy: the code is shared, and a
-- schema that differs per market is how a deploy takes down the country nobody
-- was testing. Nullable on purpose — COALESCE falls back to the base column
-- until a translation exists.
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS bio_it text;
ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS tagline_it text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS name_it text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS description_it text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS text_it text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title_it text;

INSERT INTO schema_migrations (version) VALUES ('002_italian_locale_columns.sql')
ON CONFLICT DO NOTHING;
