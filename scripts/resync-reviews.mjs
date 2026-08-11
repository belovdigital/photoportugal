#!/usr/bin/env node
/**
 * Re-sync already-imported reviews from their source JSON: text, every locale
 * column, and created_at. Matches on (photographer_id, client_name_override),
 * so it updates in place instead of the importer's insert path — re-importing
 * would dedupe on `text` and, now that the text has changed, would happily
 * create a second copy of every row.
 *
 * Usage: node resync-reviews.mjs <env_path> <photographer_id> <reviews.json> [--dry-run]
 */
import fs from "fs";
import pg from "pg";

const [, , envPath, photographerId, jsonPath, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");
if (!envPath || !photographerId || !jsonPath) {
  console.error("Usage: node resync-reviews.mjs <env_path> <photographer_id> <reviews.json> [--dry-run]");
  process.exit(1);
}

for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (!m) continue;
  let val = m[2];
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = val;
}

const reviews = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Refuse to guess: every row must match exactly one review by author name.
const plan = [];
for (const r of reviews) {
  const rows = await pool.query(
    `SELECT id FROM reviews WHERE photographer_id = $1 AND client_name_override IS NOT DISTINCT FROM $2`,
    [photographerId, r.authorName]
  );
  if (rows.rowCount !== 1) {
    console.error(`${r.authorName}: matched ${rows.rowCount} rows — aborting`);
    process.exit(1);
  }
  plan.push({ id: rows.rows[0].id, r });
}
console.log(`matched ${plan.length}/${reviews.length} reviews`);

let n = 0;
for (const { id, r } of plan) {
  if (DRY) {
    console.log(`  [dry] ${r.authorName} -> ${r.createdAt.slice(0, 10)} (${r.text.length}ch)`);
    n++;
    continue;
  }
  await pool.query(
    `UPDATE reviews SET text = $2, text_es = $3, text_de = $4, text_fr = $5,
                        created_at = $6, translations_updated_at = NOW(), translations_dirty = FALSE
     WHERE id = $1`,
    [id, r.text, r.translations.es, r.translations.de, r.translations.fr, r.createdAt]
  );
  console.log(`  updated ${r.authorName} -> ${r.createdAt.slice(0, 10)}`);
  n++;
}

console.log(`\nDone. ${DRY ? "would update" : "updated"} ${n} rows`);
await pool.end();
