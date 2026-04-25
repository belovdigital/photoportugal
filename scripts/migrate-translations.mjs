// Add translated content columns to photographer_profiles, packages, reviews.
// Each entity gets _pt, _de, _es, _fr columns; the original column remains the canonical (EN by convention).
// Reads fall back to original when locale column is NULL.

import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; }),
);

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const SQL = `
-- photographer_profiles: tagline + bio in 4 extra locales (PT, DE, ES, FR)
ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS tagline_pt VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tagline_de VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tagline_es VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tagline_fr VARCHAR(500),
  ADD COLUMN IF NOT EXISTS bio_pt TEXT,
  ADD COLUMN IF NOT EXISTS bio_de TEXT,
  ADD COLUMN IF NOT EXISTS bio_es TEXT,
  ADD COLUMN IF NOT EXISTS bio_fr TEXT,
  ADD COLUMN IF NOT EXISTS translations_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translations_dirty BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pp_translations_dirty
  ON photographer_profiles (translations_dirty) WHERE translations_dirty = TRUE;

-- packages: name + description in 4 extra locales
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS name_pt VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_de VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_es VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_fr VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description_pt TEXT,
  ADD COLUMN IF NOT EXISTS description_de TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS description_fr TEXT,
  ADD COLUMN IF NOT EXISTS translations_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translations_dirty BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pkg_translations_dirty
  ON packages (translations_dirty) WHERE translations_dirty = TRUE;

-- reviews: title + text in 4 extra locales (with show_translated user toggle handled in UI)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS title_pt VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title_de VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title_es VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title_fr VARCHAR(255),
  ADD COLUMN IF NOT EXISTS text_pt TEXT,
  ADD COLUMN IF NOT EXISTS text_de TEXT,
  ADD COLUMN IF NOT EXISTS text_es TEXT,
  ADD COLUMN IF NOT EXISTS text_fr TEXT,
  ADD COLUMN IF NOT EXISTS source_locale VARCHAR(5),
  ADD COLUMN IF NOT EXISTS translations_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translations_dirty BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_rev_translations_dirty
  ON reviews (translations_dirty) WHERE translations_dirty = TRUE;
`;

await client.query(SQL);
console.log("✓ migration applied — translation columns added");

// Status report
const r1 = await client.query("SELECT COUNT(*) FROM photographer_profiles WHERE bio IS NOT NULL OR tagline IS NOT NULL");
const r2 = await client.query("SELECT COUNT(*) FROM packages");
const r3 = await client.query("SELECT COUNT(*) FROM reviews WHERE text IS NOT NULL OR title IS NOT NULL");
console.log(`\nContent to translate (currently dirty=TRUE):`);
console.log(`  photographer_profiles: ${r1.rows[0].count}`);
console.log(`  packages: ${r2.rows[0].count}`);
console.log(`  reviews: ${r3.rows[0].count}`);

await client.end();
