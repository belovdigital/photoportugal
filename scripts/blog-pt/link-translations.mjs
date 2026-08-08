// Group the Portuguese market's blog posts by topic, so hreflang can point each
// language version at the others.
//
// The groups are declared here rather than guessed from the text: a guess that
// pairs the wrong two posts tells Google two different articles are the same
// page, which is worse than leaving them unlinked.
//
// Usage, from a deployed colour directory on the Portuguese box:
//   node scripts/blog-pt/link-translations.mjs [--dry-run]
import fs from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const ENV_FILE = process.env.ENV_FILE || "/var/www/photoportugal/.env";
const url = fs.readFileSync(ENV_FILE, "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim();

// group key -> the slugs that are the same article in different languages
const GROUPS = {
  "photo-spots-lisbon": ["best-photo-spots-lisbon", "melhores-spots-fotos-lisboa", "beste-fotospots-lissabon", "mejores-lugares-fotos-lisboa", "meilleurs-spots-photo-lisbonne"],
  "algarve-guide": ["algarve-photoshoot-guide", "fotoshooting-algarve-planen", "planificar-sesion-fotos-algarve", "planifier-seance-photo-algarve"],
  "sintra-wedding-photographer": ["hochzeitsfotograf-sintra-guide", "fotografo-bodas-sintra-guia", "photographe-mariage-sintra-guide"],
  "photo-spots-algarve": ["best-photo-spots-algarve", "melhores-spots-fotos-algarve"],
  "shoot-cost": ["photoshoot-cost-portugal", "custo-sessao-fotografica-portugal"],
  "couples-lisbon": ["couples-photoshoot-lisbon-ideas", "sessao-fotografica-casal-lisboa"],
  "family-porto": ["family-photoshoot-porto", "sessao-fotografica-familia-porto-portugueses"],
  "elope-portugal": ["how-to-elope-in-portugal", "elopement-portugal-guia"],
  "family-algarve": ["family-photoshoot-algarve", "sesion-fotos-familia-algarve-residentes-espana"],
};

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: all } = await client.query("SELECT slug, locale FROM blog_posts WHERE is_published = TRUE");
const known = new Set(all.map((r) => r.slug));

let missing = 0;
for (const [group, slugs] of Object.entries(GROUPS)) {
  for (const s of slugs) {
    if (!known.has(s)) { console.error(`  MISSING in db: ${group} -> ${s}`); missing++; }
  }
  const locales = slugs.map((s) => all.find((r) => r.slug === s)?.locale).filter(Boolean);
  if (new Set(locales).size !== locales.length) {
    console.error(`  DUPLICATE LOCALE in group ${group}: ${locales.join(",")}`);
    missing++;
  }
}
if (missing) {
  console.error(`refusing to write — ${missing} problems above`);
  process.exit(1);
}

const grouped = Object.values(GROUPS).flat();
const ungrouped = all.filter((r) => !grouped.includes(r.slug));
console.log(`${Object.keys(GROUPS).length} groups covering ${grouped.length} posts; ${ungrouped.length} standalone`);
for (const r of ungrouped) console.log(`  standalone: ${r.locale}  /${r.slug}`);

if (DRY) process.exit(0);

for (const [group, slugs] of Object.entries(GROUPS)) {
  const r = await client.query("UPDATE blog_posts SET translation_group = $1 WHERE slug = ANY($2)", [group, slugs]);
  console.log(`  ${group}: ${r.rowCount}`);
}
const { rows } = await client.query(
  "SELECT count(*)::int AS n FROM blog_posts WHERE translation_group IS NOT NULL",
);
console.log("posts grouped:", rows[0].n);
await client.end();
