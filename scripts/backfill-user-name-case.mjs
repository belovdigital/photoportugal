// Fix the casing of names that were saved before capitalizeName() guarded the
// write paths — "kim zenglein" in the admin, in the booking, in Telegram.
//
//   node scripts/backfill-user-name-case.mjs          # dry run, prints the diff
//   node scripts/backfill-user-name-case.mjs --apply  # writes, after a JSON backup
//
// Run from the app directory on each market box (it reads .env there).
//
// capitalizeName only ever changes letter case and collapses whitespace — no
// character a person typed is dropped, and a name spelled with deliberate
// inner capitals (McDonald, DesaiPatel) or in a non-Latin script is returned
// untouched. That matters here: this table is people's identity.

import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

// Compile the shared helper rather than keeping a second copy of the rules.
// --skipLibCheck because an unrelated .d.ts in node_modules (mapbox-gl
// referencing tweakpane) makes tsc exit non-zero even though it emits fine.
const outDir = mkdtempSync(join(tmpdir(), "namecase-"));
execSync(
  `npx tsc src/lib/format-name.ts --outDir ${outDir} --module esnext --target es2022 --moduleResolution bundler --skipLibCheck`,
  { stdio: "inherit" },
);
const { capitalizeName } = await import(join(outDir, "format-name.js"));

const COLS = ["name", "first_name", "last_name"];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT id, email, ${COLS.join(", ")} FROM users ORDER BY created_at`,
);

const changes = [];
for (const row of rows) {
  const patch = {};
  for (const col of COLS) {
    const before = row[col];
    if (!before) continue;
    const after = capitalizeName(before);
    if (after !== before) patch[col] = { before, after };
  }
  if (Object.keys(patch).length) changes.push({ id: row.id, email: row.email, patch });
}

console.log(`${rows.length} users, ${changes.length} to change`);
for (const { email, patch } of changes) {
  for (const [col, { before, after }] of Object.entries(patch)) {
    console.log(`  ${(email || "").padEnd(34)} ${col.padEnd(11)} ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
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

const backupPath = `user-names-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(backupPath, JSON.stringify(changes, null, 2));
console.log(`\nBackup written to ${backupPath}`);

let updated = 0;
for (const { id, patch } of changes) {
  const cols = Object.keys(patch);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const values = cols.map((c) => patch[c].after);
  await client.query(`UPDATE users SET ${sets} WHERE id = $${cols.length + 1}`, [...values, id]);
  updated++;
}

console.log(`Updated ${updated} users.`);
await client.end();
