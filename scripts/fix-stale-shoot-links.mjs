// Rewrite blog links that point at a shoot type which now only redirects.
//
// /photoshoots/wedding and /photoshoots/business consolidated into the
// /weddings and /for-business landings (next.config.ts). Post bodies kept
// linking the old paths, so every one of those links cost a redirect hop and
// Search Console filed them under "Page with redirect" — 22 posts on Portugal,
// 27 on Spain, 27 on Italy as of 2026-08-10.
//
// The replacement is deliberately locale-independent: post bodies carry
// canonical English paths and the i18n <Link> localises them at render time,
// so "/weddings" becomes /de/hochzeiten or /it/matrimoni on its own.
//
// The repo batch files were fixed in the same change; this only catches rows
// that predate them or were never re-inserted.
//
// Usage, from a deployed colour directory on the market's own box:
//   cd /var/www/photoitaly-blue && node scripts/fix-stale-shoot-links.mjs --dry-run
//   cd /var/www/photoitaly-blue && node scripts/fix-stale-shoot-links.mjs
import fs from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");

const ENV_FILE = process.env.ENV_FILE || "/var/www/photoportugal/.env";
const url = fs.readFileSync(ENV_FILE, "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!url) {
  console.error(`no DATABASE_URL in ${ENV_FILE} — set ENV_FILE for this market`);
  process.exit(1);
}

const REPLACEMENTS = [
  ["](/photoshoots/wedding)", "](/weddings)"],
  ["](/photoshoots/business)", "](/for-business)"],
];

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows: before } = await client.query(
    `SELECT slug, locale,
            (length(content) - length(replace(content, $1, ''))) / length($1) AS wedding_links,
            (length(content) - length(replace(content, $2, ''))) / length($2) AS business_links
       FROM blog_posts
      WHERE content LIKE '%' || $1 || '%' OR content LIKE '%' || $2 || '%'
      ORDER BY locale, slug`,
    [REPLACEMENTS[0][0], REPLACEMENTS[1][0]]
  );

  if (!before.length) {
    console.log("nothing to do — no post links either consolidated shoot type");
    process.exit(0);
  }

  const totalLinks = before.reduce((n, r) => n + Number(r.wedding_links) + Number(r.business_links), 0);
  console.log(`${before.length} posts, ${totalLinks} links to rewrite:`);
  for (const r of before) {
    const parts = [];
    if (Number(r.wedding_links)) parts.push(`${r.wedding_links}x wedding`);
    if (Number(r.business_links)) parts.push(`${r.business_links}x business`);
    console.log(`  [${r.locale}] ${r.slug} — ${parts.join(", ")}`);
  }

  if (DRY) {
    console.log("\n--dry-run: nothing written");
    process.exit(0);
  }

  const { rowCount } = await client.query(
    `UPDATE blog_posts
        SET content = replace(replace(content, $1, $2), $3, $4)
      WHERE content LIKE '%' || $1 || '%' OR content LIKE '%' || $3 || '%'`,
    [REPLACEMENTS[0][0], REPLACEMENTS[0][1], REPLACEMENTS[1][0], REPLACEMENTS[1][1]]
  );

  const { rows: after } = await client.query(
    `SELECT count(*)::int AS n FROM blog_posts
      WHERE content LIKE '%' || $1 || '%' OR content LIKE '%' || $2 || '%'`,
    [REPLACEMENTS[0][0], REPLACEMENTS[1][0]]
  );

  console.log(`\nupdated ${rowCount} posts; ${after[0].n} still matching (expected 0)`);
  if (after[0].n !== 0) process.exitCode = 1;
} finally {
  await client.end();
}
