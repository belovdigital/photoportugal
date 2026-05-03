-- Photographer hierarchical location coverage.
-- Safe migration: this table preserves the photographer's explicit region /
-- island / city choices while the legacy photographer_locations table remains
-- the public compatibility surface.

CREATE TABLE IF NOT EXISTS photographer_location_coverage (
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  node_slug VARCHAR(100) NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'dashboard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photographer_id, node_slug)
);

CREATE INDEX IF NOT EXISTS idx_photographer_location_coverage_node
  ON photographer_location_coverage(node_slug);

-- Backfill existing flat selections as explicit leaf coverage nodes.
INSERT INTO photographer_location_coverage (photographer_id, node_slug, source)
SELECT photographer_id, location_slug, 'legacy-backfill'
FROM photographer_locations
ON CONFLICT DO NOTHING;
