#!/usr/bin/env node
/**
 * Schema migration runner.
 *
 * Applies every `db/migrations/NNN_*.sql` that is not yet recorded in the
 * `schema_migrations` table, in filename order, each inside a transaction.
 * Already-applied files are skipped, so running it twice is a no-op.
 *
 * Why this exists: `db/schema.sql` fell 32 tables behind reality because
 * changes were applied by hand, one ad-hoc file at a time, with no record of
 * what had run where. With two countries on one codebase that drift becomes a
 * production incident rather than an inconvenience.
 *
 *   node scripts/migrate.mjs           # apply pending
 *   node scripts/migrate.mjs --status  # list without applying
 *
 * Reads DATABASE_URL from the environment.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const statusOnly = process.argv.includes("--status");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (statusOnly) {
    for (const f of files) console.log(`${applied.has(f) ? "applied" : "PENDING"}  ${f}`);
    return;
  }

  if (pending.length === 0) {
    console.log("Nothing to apply — schema is up to date.");
    return;
  }

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied  ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      // Stop on the first failure: continuing would apply migrations out of
      // order and leave the schema in a state no environment can reproduce.
      console.error(`FAILED   ${file}\n${err.message}`);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
