// Prove that every image the site actually renders has all of its rungs.
//
// This is the gate the srcset switch must pass. On 2026-08-10 the ladder went
// live after a backfill that had been run one prefix at a time, `covers/` was
// missed, and because a 404 srcset candidate renders nothing at all, every
// photographer card on Portugal went blank. A completed backfill is not the
// same claim as a verified one — this makes the second claim.
//
// It crawls the pages that carry photos, pulls every R2 image URL out of the
// rendered HTML, and HEADs each rung. Anything missing is printed and the exit
// code is non-zero, so it can gate a deploy.
//
// Usage:
//   node scripts/check-image-variants.mjs https://photoportugal.com
//   node scripts/check-image-variants.mjs https://photoitaly.co --pages /,/photographers

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: node scripts/check-image-variants.mjs <origin> [--pages /a,/b]");
  process.exit(1);
}
const pagesArg = process.argv.includes("--pages") ? process.argv[process.argv.indexOf("--pages") + 1] : null;

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const H = { "User-Agent": UA, "Accept-Language": "en" };

// Mirrors src/lib/image-variants.ts. Kept in step by this script failing loudly
// if a rung it expects is absent — if the ladder there changes, change it here.
const WIDTHS_BY_PREFIX = {
  "avatars/": [160, 400, 800],
  "portfolio/": [400, 800, 1600],
  "covers/": [400, 800, 1600],
};

function widthsFor(key) {
  if (/_(\d+)\.webp$/.test(key)) return null;
  if (/(^|\/)thumb_/.test(key)) return null;
  if (!/\.(jpe?g|png|webp)$/i.test(key)) return null;
  const prefix = Object.keys(WIDTHS_BY_PREFIX).find((p) => key.startsWith(p));
  return prefix ? WIDTHS_BY_PREFIX[prefix] : null;
}

const variantUrl = (url, w) => url.replace(/\.[^.?]+(?=($|\?))/, `_${w}.webp`);

// Pages worth crawling: the ones that render photographer photography. A
// location page is included because it pulls the widest mix of them.
async function defaultPages() {
  const pages = ["/", "/photographers"];
  try {
    const xml = await (await fetch(`${BASE}/sitemap.xml`, { headers: H })).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const firstLocation = locs.find((u) => /\/locations\/[a-z-]+$/.test(u));
    const firstProfile = locs.find((u) => /\/photographers\/[a-z0-9-]+$/.test(u));
    for (const u of [firstLocation, firstProfile]) if (u) pages.push(new URL(u).pathname);
  } catch {}
  return pages;
}

const pages = pagesArg ? pagesArg.split(",") : await defaultPages();
const filesHost = new URL(BASE).host.replace(/^(www\.)?/, "files.");

const seen = new Set();
for (const path of pages) {
  let html;
  try {
    html = await (await fetch(`${BASE}${path}`, { headers: H })).text();
  } catch (e) {
    console.error(`  could not fetch ${path}: ${e.message}`);
    continue;
  }
  for (const m of html.matchAll(new RegExp(`https://${filesHost.replace(/\./g, "\\.")}/[^"'\\\\ )]+`, "g"))) {
    const url = m[0].replace(/\\+$/, "");
    const key = url.slice(`https://${filesHost}/`.length).split("?")[0];
    if (widthsFor(key)) seen.add(url.split("?")[0]);
  }
  console.log(`  ${path.padEnd(28)} ${seen.size} distinct originals so far`);
}

if (!seen.size) {
  console.log("\nno R2 images found on those pages — nothing to verify");
  process.exit(0);
}

const missing = [];
let checked = 0;
const queue = [...seen];
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      const key = url.slice(`https://${filesHost}/`.length);
      for (const w of widthsFor(key)) {
        const res = await fetch(variantUrl(url, w), { method: "HEAD", headers: H }).catch(() => null);
        if (!res || !res.ok) missing.push(`${variantUrl(url, w)} -> ${res ? res.status : "ERR"}`);
      }
      checked++;
    }
  })
);

console.log(`\nchecked ${checked} originals × their rungs`);
if (missing.length) {
  console.log(`MISSING ${missing.length} rung(s) — do NOT enable srcset for this market:`);
  for (const m of missing.slice(0, 25)) console.log("  " + m);
  if (missing.length > 25) console.log(`  ... and ${missing.length - 25} more`);
  process.exit(1);
}
console.log("every rung present — safe to serve");
