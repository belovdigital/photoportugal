-- Provenance for harvested outreach leads (2026-08-13).
--
-- scripts/harvest-partner-leads.mjs pulls lodging businesses out of
-- OpenStreetMap. osm_ref keeps the element they came from ("node/123456"), so a
-- row can be traced back, re-checked against a later OSM extract, or dropped
-- wholesale if the source turns out to be wrong. Rows added by hand leave it
-- NULL, which is also how the board tells the two apart.
-- Safe to run multiple times.

ALTER TABLE partner_outreach ADD COLUMN IF NOT EXISTS osm_ref VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_partner_outreach_osm ON partner_outreach (osm_ref) WHERE osm_ref IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('010_partner_outreach_osm_ref.sql')
ON CONFLICT DO NOTHING;
