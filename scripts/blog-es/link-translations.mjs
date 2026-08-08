// Group the Spanish market's blog posts by topic, so hreflang can point each
// language version at the others.
//
// The groups are declared here rather than guessed from the text: a guess that
// pairs the wrong two posts tells Google two different articles are the same
// page, which is worse than leaving them unlinked.
//
// Usage, from a deployed colour directory on the Spanish box:
//   node scripts/blog-es/link-translations.mjs [--dry-run]
import fs from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const ENV_FILE = process.env.ENV_FILE || "/var/www/photospain/.env";
const url = fs.readFileSync(ENV_FILE, "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim();

// group key -> the slugs that are the same article in different languages
const GROUPS = {
  "barcelona-vs-madrid": ["barcelona-or-madrid-for-a-photoshoot", "barcelona-o-madrid-para-una-sesion-de-fotos", "barcelona-oder-madrid-fotoshooting", "barcelone-ou-madrid-seance-photo"],
  "best-season": ["best-time-of-year-for-photos-in-spain", "mejor-epoca-del-ano-para-fotografiar-en-espana", "beste-reisezeit-fotos-spanien", "meilleure-periode-photos-espagne"],
  "best-hour": ["best-time-of-day-for-photos-in-spain", "mejor-hora-del-dia-para-fotografiar-en-espana"],
  "corporate": ["corporate-photography-in-spain-for-teams-and-events", "fotografia-corporativa-en-espana", "firmenfotos-spanien-guide", "photographie-entreprise-espagne"],
  "couples-expect": ["couples-photoshoot-in-spain-what-to-expect", "sesion-de-fotos-de-pareja-que-esperar", "paarshooting-spanien-was-erwartet-sie", "seance-photo-couple-espagne-a-quoi-sattendre"],
  "family-children": ["family-photoshoot-in-spain-with-young-children", "familienshooting-spanien-mit-kindern", "seance-photo-famille-espagne"],
  "book-ahead": ["how-far-in-advance-to-book-a-photographer-in-spain", "con-cuanta-antelacion-reservar-fotografo-en-espana"],
  "cordoba": ["photographing-cordoba", "sesion-de-fotos-en-cordoba-guia"],
  "granada": ["photographing-granada-alhambra-albaicin", "sesion-de-fotos-en-granada-guia"],
  "madrid": ["photographing-madrid-debod-retiro-old-centre", "sesion-de-fotos-en-madrid-guia", "fotoshooting-madrid-guide", "seance-photo-madrid-guide"],
  "malaga": ["photographing-malaga-and-the-costa-del-sol", "sesion-de-fotos-en-malaga-guia"],
  "san-sebastian": ["photographing-san-sebastian-and-the-basque-coast", "sesion-de-fotos-en-san-sebastian-guia", "fotoshooting-baskenland-guide"],
  "seville": ["photographing-seville", "sesion-de-fotos-en-sevilla-guia", "seance-photo-seville-guide"],
  "canaries": ["photographing-the-canary-islands", "fotografiar-en-canarias", "fotoshooting-kanaren-winter", "seance-photo-canaries-hiver"],
  "costa-brava": ["photographing-the-costa-brava", "sesion-de-fotos-en-la-costa-brava-guia", "fotoshooting-costa-brava-guide", "seance-photo-costa-brava-guide"],
  "valencia": ["photographing-valencia", "sesion-de-fotos-en-valencia-guia", "fotoshooting-valencia-guide", "seance-photo-valence-guide"],
  "barcelona": ["where-to-photograph-in-barcelona", "sesion-de-fotos-en-barcelona-guia", "fotoshooting-barcelona-guide", "seance-photo-barcelone-guide"],
  "proposal": ["planning-a-surprise-proposal-photoshoot-in-spain", "pedida-de-mano-sorpresa-en-espana", "heiratsantrag-spanien-planen", "demande-en-mariage-surprise-espagne"],
  "solo-travel": ["solo-travel-photoshoot-spain", "viajar-solo-y-hacerse-fotos", "alleine-reisen-fotos-spanien", "voyager-seul-se-faire-photographier"],
  "toledo-segovia": ["toledo-and-segovia-day-trips-from-madrid", "toledo-y-segovia-desde-madrid"],
  "price": ["what-a-photoshoot-in-spain-costs", "que-determina-el-precio-de-una-sesion-de-fotos", "was-kostet-fotoshooting-spanien", "combien-coute-seance-photo-espagne"],
  "after-shoot": ["what-happens-after-the-photoshoot", "que-pasa-despues-de-la-sesion-de-fotos"],
  "rain": ["what-happens-if-it-rains-on-your-photoshoot", "que-hacer-si-llueve-el-dia-de-la-sesion"],
  "what-to-wear": ["what-to-wear-for-a-photoshoot-in-spain", "que-ponerse-sesion-de-fotos", "was-anziehen-fotoshooting-spanien", "que-porter-seance-photo-espagne"],
  "where-to-marry": ["where-to-get-married-in-spain-by-region", "donde-casarse-en-espana-por-region", "wo-in-spanien-heiraten", "ou-se-marier-en-espagne"],
  "small-wedding": ["boda-intima-en-espana-como-organizarla", "kleine-hochzeit-spanien-planen", "mariage-intime-espagne-organiser"],
  "eloping-balearics": ["eloping-in-mallorca-and-the-balearics", "boda-intima-en-baleares"],
  "how-many-photos": ["cuantas-fotos-recibes-y-que-es-una-foto-editada", "wie-viele-fotos-bekomme-ich"],
  "how-to-pose": ["como-posar-en-una-sesion-de-fotos", "comment-poser-seance-photo"],
  "andalusia": ["fotoshooting-andalusien-guide", "seance-photo-andalousie-guide"],
  "balearics-islands": ["sesion-de-fotos-en-baleares-mallorca-ibiza-menorca", "seance-photo-baleares-guide"],
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
