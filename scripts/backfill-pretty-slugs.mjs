#!/usr/bin/env node
/**
 * Backfill pretty slugs for photographers stuck on auto-generated
 * `p-xxxxxxxx` slugs. Generates a readable slug from their name,
 * picks unique candidate (appending -2/-3 on collision), and inserts
 * the old slug into `slug_redirects` so Google's existing index and
 * any external links keep working via 301.
 *
 * Skips:
 *  - Names that produce an empty slug after ASCII normalisation
 *    (e.g. Cyrillic-only). They keep the auto slug.
 *  - Reserved slugs that collide with app routes.
 */
import { Pool } from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);

const pool = new Pool(
  env.DATABASE_URL
    ? { connectionString: env.DATABASE_URL }
    : {
        host: env.PG_HOST || "localhost",
        port: Number(env.PG_PORT || 5432),
        database: env.PG_DATABASE || "photoportugal",
        user: env.PG_USER || "postgres",
        password: env.PG_PASSWORD,
      }
);

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RESERVED = new Set([
  "admin", "dashboard", "api", "auth", "join", "pricing", "blog",
  "faq", "about", "contact", "location", "search", "concierge",
  "find-photographer", "how-it-works", "for-photographers", "delivery",
  "book", "checkout", "auth", "signin", "signup", "logout",
]);

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { rows } = await pool.query(
    `SELECT pp.id, pp.slug, u.name
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.slug ~ '^p-[a-z0-9]+$'
      ORDER BY pp.created_at`
  );

  console.log(`Found ${rows.length} photographers with auto slugs${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log("");

  const planned = [];
  const skipped = [];

  for (const row of rows) {
    const base = slugify(row.name);
    if (!base || base.length < 3) {
      skipped.push({ name: row.name, slug: row.slug, reason: "empty after normalisation" });
      continue;
    }
    if (RESERVED.has(base)) {
      skipped.push({ name: row.name, slug: row.slug, reason: `reserved word "${base}"` });
      continue;
    }

    let candidate = base;
    let suffix = 1;
    while (true) {
      const taken = await pool.query(
        `SELECT 1 FROM photographer_profiles WHERE slug = $1 AND id != $2
         UNION
         SELECT 1 FROM slug_redirects WHERE old_slug = $1`,
        [candidate, row.id]
      );
      if (taken.rows.length === 0) break;
      suffix++;
      candidate = `${base}-${suffix}`;
      if (suffix > 20) {
        candidate = null;
        break;
      }
    }

    if (!candidate) {
      skipped.push({ name: row.name, slug: row.slug, reason: "couldn't find unique slug after 20 tries" });
      continue;
    }

    planned.push({ id: row.id, name: row.name, oldSlug: row.slug, newSlug: candidate });
  }

  console.log(`PLANNED (${planned.length}):`);
  for (const p of planned) {
    console.log(`  ${p.name.padEnd(35)} ${p.oldSlug.padEnd(15)} → ${p.newSlug}`);
  }
  console.log("");
  console.log(`SKIPPED (${skipped.length}):`);
  for (const s of skipped) {
    console.log(`  ${s.name.padEnd(35)} ${s.slug.padEnd(15)} reason: ${s.reason}`);
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — no changes made.");
    await pool.end();
    return;
  }

  console.log("\nApplying...");
  for (const p of planned) {
    await pool.query("BEGIN");
    try {
      await pool.query(
        "INSERT INTO slug_redirects (old_slug, photographer_id) VALUES ($1, $2) ON CONFLICT (old_slug) DO NOTHING",
        [p.oldSlug, p.id]
      );
      await pool.query("UPDATE photographer_profiles SET slug = $1 WHERE id = $2", [p.newSlug, p.id]);
      await pool.query("DELETE FROM slug_redirects WHERE old_slug = $1", [p.newSlug]);
      await pool.query("COMMIT");
      console.log(`  ✓ ${p.name}: ${p.oldSlug} → ${p.newSlug}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`  ✗ ${p.name}: ${err.message}`);
    }
  }

  await pool.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
