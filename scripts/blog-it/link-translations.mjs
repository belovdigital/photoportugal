// Group the Italian market's blog posts by topic, so hreflang can point each
// language version at the others.
//
// The groups are declared here rather than guessed from the text: a guess that
// pairs the wrong two posts tells Google two different articles are the same
// page, which is worse than leaving them unlinked.
//
// Usage, from a deployed colour directory on the Italian box:
//   node scripts/blog-it/link-translations.mjs [--dry-run]
import fs from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const ENV_FILE = process.env.ENV_FILE || "/var/www/photoitaly/.env";
const url = fs.readFileSync(ENV_FILE, "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim();

// group key -> the slugs that are the same article in different languages
const GROUPS = {
  "rome-guide": ["photographing-rome-guide", "fotografare-roma-guida", "fotoshooting-rom-guide", "seance-photo-rome-guide", "fotografiar-roma-guia"],
  "florence-guide": ["photographing-florence-guide", "fotografare-firenze-guida", "fotoshooting-florenz-guide", "seance-photo-florence-guide", "fotografiar-florencia-guia"],
  "venice-guide": ["photographing-venice-guide", "fotografare-venezia-guida", "fotoshooting-venedig-guide", "seance-photo-venise-guide", "fotografiar-venecia-guia"],
  "amalfi-guide": ["photographing-the-amalfi-coast", "fotografare-la-costiera-amalfitana", "fotoshooting-amalfikueste-guide", "seance-photo-cote-amalfitaine-guide", "fotografiar-la-costa-amalfitana"],
  "weddings-planning": ["wedding-photography-in-italy-what-to-plan", "fotografo-di-matrimonio-in-italia-cosa-pianificare", "hochzeitsfotografie-italien-planung", "photographe-mariage-italie-organisation", "fotografo-de-boda-en-italia-que-planificar"],
  "where-to-propose": ["where-to-propose-in-italy", "dove-fare-la-proposta-di-matrimonio-in-italia", "heiratsantrag-italien-orte", "demande-en-mariage-italie-lieux", "donde-pedir-matrimonio-en-italia"],

  "milan-guide": ["photographing-milan-guide", "fotografare-milano-guida"],
  "como-guide": ["photographing-lake-como-guide", "fotografare-il-lago-di-como-guida"],
  "positano-sorrento": ["photographing-positano-and-sorrento", "fotografare-positano-e-sorrento"],
  "cinque-terre": ["photographing-the-cinque-terre", "fotografare-le-cinque-terre"],
  "sicily-guide": ["photographing-sicily-taormina-palermo-syracuse", "fotografare-la-sicilia-taormina-palermo-siracusa"],
  "puglia-guide": ["photographing-puglia-lecce-and-alberobello", "fotografare-la-puglia-lecce-e-alberobello"],

  "session-cost": ["what-a-photoshoot-in-italy-costs", "quanto-costa-un-servizio-fotografico-in-italia"],
  "when-to-shoot": ["best-time-of-day-for-photos-in-italy", "quando-fotografare-in-italia-luce-e-stagioni"],
  "what-to-wear": ["what-to-wear-for-a-photoshoot-in-italy", "come-vestirsi-per-un-servizio-fotografico-in-italia"],
  "how-to-pose": ["how-to-pose-for-photos-without-feeling-awkward", "come-mettersi-in-posa-senza-sentirsi-a-disagio"],
  "family-young-children": ["family-photoshoot-in-italy-with-young-children", "servizio-fotografico-di-famiglia-in-italia-con-bambini"],
  "honeymoon": ["honeymoon-photoshoot-in-italy-where-to-go", "servizio-fotografico-di-luna-di-miele-in-italia"],

  "eloping": ["eloping-in-italy-what-it-takes", "elopement-in-italia-come-organizzarlo"],
  "corporate": ["corporate-photography-in-italy", "fotografia-aziendale-in-italia"],

  // Batch 6-8 (2026-08-08): the thin-category fills.
  "rome-proposal": ["planning-a-proposal-in-rome-spots-and-logistics", "proposta-di-matrimonio-a-roma-dove-e-come", "heiratsantrag-in-rom-orte-und-ablauf", "pedida-de-mano-en-roma-donde-y-como", "demande-en-mariage-a-rome-lieux-et-organisation"],
  "wedding-questions": ["wedding-photographer-in-italy-questions-before-you-sign", "fotografo-di-matrimonio-le-domande-prima-di-firmare", "hochzeitsfotograf-italien-fragen-vor-vertrag", "fotografo-de-boda-en-italia-preguntas-antes-de-firmar", "photographe-mariage-italie-questions-avant-de-signer"],
  "couples-hour": ["couples-photoshoot-in-italy-what-the-hour-looks-like", "servizio-di-coppia-in-italia-come-funziona-quell-ora"],
  "where-to-elope": ["where-to-elope-in-italy-seven-settings-compared", "dove-sposarsi-in-due-in-italia-sette-scenari"],
  "family-rome": ["family-photoshoot-in-rome-with-kids", "servizio-di-famiglia-a-roma-con-i-bambini"],
  "booking-lead-time": ["how-far-ahead-to-book-a-photographer-in-italy", "con-quanto-anticipo-prenotare-un-fotografo-in-italia"],
  "team-headshots": ["team-headshots-in-italy-office-event-or-studio", "foto-del-team-e-ritratti-aziendali-in-italia"],
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
