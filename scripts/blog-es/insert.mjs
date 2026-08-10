// Insert Photo Spain blog posts from a batch file into the Spanish database.
// Same guard rails as scripts/blog-it/insert.mjs — the batch files in the repo
// are the source of truth, so a lost database costs a re-insert, not an
// excavation of chat transcripts (which is how Spain's 112 posts came back
// after the 2026-08-07 box wipe).
//
// Usage, from a deployed colour directory on the Spanish box:
//   node scripts/blog-es/insert.mjs batch-01.mjs [--dry-run]
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const [, , file, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");
if (!file) {
  console.error("usage: node scripts/blog-es/insert.mjs <batch-file.mjs> [--dry-run]");
  process.exit(1);
}

const ENV_FILE = process.env.ENV_FILE || "/var/www/photospain/.env";
const url = fs.readFileSync(ENV_FILE, "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!url) {
  console.error(`no DATABASE_URL in ${ENV_FILE}`);
  process.exit(1);
}

const here = path.dirname(new URL(import.meta.url).pathname);
const { POSTS } = await import(path.resolve(here, file));

const LOCALES = new Set(["en", "es", "de", "fr"]);
const CATEGORIES = new Set([
  "locations", "pricing", "elopements", "weddings", "couples", "family",
  "planning", "proposals", "solo", "comparisons", "business",
]);
const LOCATION_SLUGS = new Set([
  "barcelona", "sitges", "girona", "costa-brava", "madrid", "toledo", "segovia",
  "seville", "granada", "malaga", "marbella", "ronda", "cordoba", "cadiz",
  "mallorca", "ibiza", "menorca", "tenerife", "gran-canaria", "lanzarote",
  "valencia", "san-sebastian", "bilbao", "santiago-de-compostela",
]);
const SHOOT_TYPES = new Set([
  "couples", "family", "proposal", "engagement", "honeymoon", "solo", "elopement",
  "wedding", "maternity", "friends", "anniversary", "birthday", "kids-birthday",
  "studio-portrait", "content-creator", "fashion", "business",
]);

const problems = [];
const seen = new Set();
for (const p of POSTS) {
  const at = `${p.slug || "(no slug)"}`;
  if (!p.slug || seen.has(p.slug)) problems.push(`${at}: missing or duplicate slug`);
  seen.add(p.slug);
  if (!LOCALES.has(p.locale)) problems.push(`${at}: unknown locale ${p.locale}`);
  if (!CATEGORIES.has(p.category)) problems.push(`${at}: unknown category ${p.category}`);
  if (!p.content || p.content.length < 1500) problems.push(`${at}: body suspiciously short`);
  if ((p.meta_title || "").length > 60) problems.push(`${at}: meta_title ${p.meta_title.length} chars`);
  for (const m of p.content.matchAll(/\]\(\/locations\/([a-z0-9-]+)\)/g)) {
    if (!LOCATION_SLUGS.has(m[1])) problems.push(`${at}: links /locations/${m[1]} which does not exist`);
  }
  for (const m of p.content.matchAll(/\]\(\/photoshoots\/([a-z0-9-]+)\)/g)) {
    if (!SHOOT_TYPES.has(m[1])) problems.push(`${at}: links /photoshoots/${m[1]} which does not exist`);
  }
  // These two shoot types consolidated into their own landings and now only
  // redirect (next.config.ts). Linking them from a post costs a hop and shows
  // up in Search Console as "Page with redirect".
  for (const m of p.content.matchAll(/\]\(\/photoshoots\/(wedding|business)\)/g)) {
    problems.push(`${at}: links /photoshoots/${m[1]} which only redirects — use ${m[1] === "wedding" ? "/weddings" : "/for-business"}`);
  }
  for (const word of ["Photo Portugal", "Photo Italy", "photoportugal.com", "photoitaly.co"]) {
    if (p.content.includes(word)) problems.push(`${at}: mentions ${word}`);
  }
}

if (problems.length) {
  console.error(`refusing to insert — ${problems.length} problems:`);
  for (const x of problems) console.error("  " + x);
  process.exit(1);
}
console.log(`${POSTS.length} posts pass validation`);
if (DRY) process.exit(0);

const client = new pg.Client({ connectionString: url });
await client.connect();
for (const p of POSTS) {
  const r = await client.query(
    `INSERT INTO blog_posts
       (slug, title, excerpt, content, meta_title, meta_description, target_keywords,
        author, is_published, published_at, category, locale)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Photo Spain',TRUE,COALESCE($10::timestamptz, NOW()),$8,$9)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, content = EXCLUDED.content,
       meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
       target_keywords = EXCLUDED.target_keywords, category = EXCLUDED.category,
       locale = EXCLUDED.locale, is_published = TRUE, updated_at = NOW()
     RETURNING slug, locale, category, length(content) AS chars`,
    [p.slug, p.title, p.excerpt, p.content, p.meta_title, p.meta_description,
     p.target_keywords, p.category, p.locale, p.published_at || null],
  );
  const row = r.rows[0];
  console.log(`  ${row.locale}  ${row.category.padEnd(10)} ${String(row.chars).padStart(6)} chars  /${row.slug}`);
}
const { rows } = await client.query(
  `SELECT locale, count(*)::int AS n FROM blog_posts WHERE is_published GROUP BY locale ORDER BY locale`,
);
console.log("\nblog now:", rows.map((r) => `${r.locale}:${r.n}`).join("  "));
await client.end();
