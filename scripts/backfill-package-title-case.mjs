// Title-case existing package names (and their translations).
//
// New and edited packages get title case at write time now
// (src/lib/format-package-name.ts). This walks the rows that were saved
// before that and applies the same transform — same source file, compiled
// on the fly, so the two can never drift apart.
//
//   node scripts/backfill-package-title-case.mjs          # dry run, prints the diff
//   node scripts/backfill-package-title-case.mjs --apply  # writes, after a JSON backup
//
// Run it from the app directory on each market box (it reads .env there).

import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

// Compile the shared helper rather than keeping a second copy of the rules.
// --skipLibCheck because a stray unrelated .d.ts in node_modules (mapbox-gl
// referencing tweakpane) makes tsc exit non-zero even though it emits fine.
const outDir = mkdtempSync(join(tmpdir(), "pkgcase-"));
execSync(
  `npx tsc src/lib/format-package-name.ts --outDir ${outDir} --module esnext --target es2022 --moduleResolution bundler --skipLibCheck`,
  { stdio: "inherit" },
);
const { titleCasePackageName } = await import(join(outDir, "format-package-name.js"));

const LOCALE_COLS = ["name_pt", "name_de", "name_es", "name_fr", "name_it"];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, ${LOCALE_COLS.join(", ")} FROM packages ORDER BY photographer_id, sort_order`,
);

const changes = [];
for (const row of rows) {
  const patch = {};
  for (const col of ["name", ...LOCALE_COLS]) {
    const before = row[col];
    if (!before) continue;
    const after = titleCasePackageName(before);
    if (after !== before) patch[col] = { before, after };
  }
  if (Object.keys(patch).length) changes.push({ id: row.id, patch });
}

console.log(`${rows.length} packages, ${changes.length} to change`);
for (const { id, patch } of changes) {
  for (const [col, { before, after }] of Object.entries(patch)) {
    console.log(`  ${id.slice(0, 8)} ${col.padEnd(8)} ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
  await client.end();
  process.exit(0);
}

if (changes.length === 0) {
  await client.end();
  process.exit(0);
}

// The old values live on disk before anything is written, so a bad transform
// is one script away from being undone.
const backupPath = `package-names-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(backupPath, JSON.stringify(changes, null, 2));
console.log(`\nBackup written to ${backupPath}`);

let updated = 0;
for (const { id, patch } of changes) {
  const cols = Object.keys(patch);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const values = cols.map((c) => patch[c].after);
  await client.query(`UPDATE packages SET ${sets} WHERE id = $${cols.length + 1}`, [...values, id]);
  updated++;
}

console.log(`Updated ${updated} packages.`);
await client.end();
