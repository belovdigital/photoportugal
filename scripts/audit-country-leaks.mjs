#!/usr/bin/env node
/**
 * Audit the Spanish override layer for content that still belongs to Portugal.
 *
 * WHY THIS EXISTS
 * ---------------
 * The first version of this check was run ad-hoc and reported "0 pages with
 * Portuguese remnants" while the live Spanish site was showing
 * `info@photoportugal.com` in the support FAQ, 16 raw i18n key paths on
 * /try-yourself, "au Espagne" in 107 French strings and "+351" as the
 * auto-prefix for Spanish phone numbers. It missed all of it for three
 * reasons, each of which this script fixes:
 *
 *   1. It matched case-sensitively, so lowercase occurrences inside domains
 *      and email addresses (`photoportugal.com`) never matched "Portugal".
 *   2. It subtracted one "allowed" hit per page, because the footer legitimately
 *      names Portugal (the operating company is a Portuguese sole proprietorship).
 *      A page with exactly one real leak therefore scored clean. Allowances are
 *      now an explicit key list — never a count.
 *   3. It only looked for place names, so `+351` and `PHOTO PT` were invisible:
 *      a string can be about Portugal without containing the word.
 *
 * It also checks the class of bug that produced most of the damage: bulk
 * place-name substitution replaces a noun without fixing the grammar around it
 * ("au Portugal" -> "au Espagne"), and leaves broken tokens behind ("dLa Rioja").
 *
 * Run: node scripts/audit-country-leaks.mjs
 *
 * Exits non-zero on the precise checks, so it can gate a deploy. The code scan
 * is advisory only and never fails the run — see the note above `report`.
 * This script is necessary but NOT sufficient: it reads source, not pages, so
 * the live sweep of text, <meta> and JSON-LD in docs/MARKETS.md §11 still has to run.
 */

import fs from "node:fs";
import path from "node:path";

const LOCALES = ["en", "es", "de", "fr"];
const OVERRIDE_DIR = "messages/country/es";

/**
 * Keys whose Portuguese content is CORRECT on the Spanish site.
 *
 * The operating company is Ekaterina Belova, Empresária em Nome Individual,
 * registered in Portugal, so the legal entity and its DPA stay Portuguese in
 * every market. This list is explicit and per-key on purpose: the previous
 * "allow one hit per page" heuristic is what hid the real leaks.
 */
const ALLOWED_KEYS = new Set([
  "footer.legalEntityLocation",
  "footer.legalEntityName",
  "footer.legalEntityNif",
  "terms.sections.governingLaw.content",
  "privacy.sections.controller.content",
  // The footer partner block is wrapped in `country.code === "pt"` in
  // Footer.tsx — these are real Portuguese tour operators and the block does
  // not render outside Portugal, so the strings are unreachable here.
  "footer.partnerBikeTagline",
  "footer.partnerWalkingTagline",
]);

/**
 * Matched with a leading word boundary. Terms in WORD_TERMS also need a
 * trailing boundary: without it "comporta" matches inside the ordinary Spanish
 * word "comportamiento" and the report fills with noise, which is how a real
 * finding gets skimmed past.
 */
const WORD_TERMS = [
  "photoportugal",
  "portugal",
  "algarve",
  "madeira",
  "sintra",
  "cascais",
  "douro",
  "coimbra",
  "évora",
  "evora",
  "aveiro",
  "nazaré",
  "óbidos",
  "comporta",
  "guimarães",
];
/** Prefixes — these need to catch inflected forms (portuguesa, Lisboa, Açores). */
const PREFIX_TERMS = ["portugu", "lisbo", "azore", "açore"];

/** Portugal-specific facts that contain no Portuguese place name at all. */
const SILENT_TERMS = ["\\+351", "photo pt", "cnpd"];

const TERM_RES = [
  ...WORD_TERMS.map((t) => [new RegExp(`\\b${t}\\b`, "i"), t]),
  ...PREFIX_TERMS.map((t) => [new RegExp(`\\b${t}`, "i"), t]),
  ...SILENT_TERMS.map((t) => [new RegExp(t, "i"), t]),
];

const findTerm = (value) => TERM_RES.find(([re]) => re.test(value))?.[1];

/**
 * Grammar left broken by place-name substitution. `Portugal` is masculine in
 * French and Spanish; `Espagne`/`España` are feminine, so every article and
 * preposition around the substituted word is wrong.
 */
const GRAMMAR = {
  es: [
    [/\btodo España\b/gi, "todo España → toda España"],
    [/\bel España\b/g, "el España → España"],
    [/\bdel España\b/g, "del España → de España"],
    [/\bdel (Costa|Sierra|Rioja|Mancha|Alhambra)\b/g, "del + женский род"],
    [/\ba[lo] Costa\b/g, "al/ao Costa"],
  ],
  fr: [
    [/\bau Espagne\b/gi, "au Espagne → en Espagne"],
    [/\ble Espagne\b/g, "le Espagne → l'Espagne"],
    [/\bdu Espagne\b/g, "du Espagne → d'Espagne"],
    [/\bla Espagne\b/g, "la Espagne → l'Espagne"],
    [/\bdu (Costa|Sierra|Rioja)\b/g, "du + женский род"],
  ],
  de: [[/\bder Spanien\b/g, "der Spanien"]],
  en: [[/\bthe Spain\b/g, "the Spain"]],
};

/** A lowercase run glued to a capitalised word — "dLa Rioja", "aBarcelona". */
const GLUED_TOKEN = /\b[a-záéíóúàèùç]{1,2}[A-ZÁÉÍÓÚ][a-záéíóú]{2,}/g;

/** The brand is a proper noun and is never translated, in any locale. */
const TRANSLATED_BRAND = /Photo (Spanien|Espagne|España|Spagna)/g;

const flatten = (node, prefix = "", out = {}) => {
  if (typeof node === "string") {
    out[prefix] = node;
    return out;
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      flatten(node[key], prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const problems = [];
const advisories = [];

/**
 * Gating findings vs advisory ones.
 *
 * The code scan (check 5) cannot tell a rendered string from the `: "Portugal"`
 * branch of a country ternary, or from dead code — it reports ~200 lines that
 * the live site provably does not show. A check that cries wolf gets skimmed,
 * which is how the original leaks survived in the first place, so it is listed
 * separately and does NOT fail the run. The gate is the precise checks plus the
 * live sweep of text, <meta> and JSON-LD described in docs/MARKETS.md §11.
 */
const report = (kind, locale, key, detail) =>
  problems.push({ kind, locale, key, detail });
const advise = (kind, locale, key, detail) =>
  advisories.push({ kind, locale, key, detail });

/**
 * AI scene IDs the Spanish market actually renders. `SCENES` in ai-scenes.ts
 * switches on NEXT_PUBLIC_COUNTRY, so the Portuguese scene keys still present
 * in the base locale files are never looked up here — reporting them would be
 * noise, and noise is what let the real leaks hide.
 */
// The /try-yourself feature and its scene presets were removed on 2026-08-04.
// Any surviving tryYourself.* string is dead copy nobody renders, so it must not
// be reported as a leak — that noise is exactly what hid real leaks before.
const isDeadSceneKey = (key) => key.startsWith("tryYourself.");

for (const locale of LOCALES) {
  const base = flatten(readJson(`messages/${locale}.json`));
  const override = flatten(readJson(path.join(OVERRIDE_DIR, `${locale}.json`)));

  // 1. Base strings about Portugal that the Spanish site inherits unchanged.
  for (const [key, value] of Object.entries(base)) {
    if (key in override || ALLOWED_KEYS.has(key) || isDeadSceneKey(key)) continue;
    const hit = findTerm(value);
    if (hit) report("унаследовано от Португалии", locale, key, `«${hit}» — ${value.slice(0, 90)}`);
  }

  // 2. Portugal that survived inside the Spanish layer itself.
  for (const [key, value] of Object.entries(override)) {
    if (ALLOWED_KEYS.has(key) || isDeadSceneKey(key)) continue;
    const hit = findTerm(value);
    if (hit) report("Португалия в испанском слое", locale, key, `«${hit}» — ${value.slice(0, 90)}`);

    for (const [re, label] of GRAMMAR[locale] ?? []) {
      if (re.test(value)) report("сломанное согласование", locale, key, label);
      re.lastIndex = 0;
    }
    const glued = value.match(GLUED_TOKEN);
    if (glued) report("склеенный токен", locale, key, glued.slice(0, 3).join(", "));
    const brand = value.match(TRANSLATED_BRAND);
    if (brand) report("бренд переведён", locale, key, brand[0]);
  }
}

// 4. Location slugs must agree between the dataset and the tree, or every
//    slug lookup silently returns nothing (picker, coverage step, concierge).
const slugsOf = (file) =>
  new Set([...fs.readFileSync(file, "utf8").matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]));
const dataSlugs = slugsOf("src/lib/locations-data-es.ts");
const treeSlugs = slugsOf("src/lib/location-hierarchy-es.ts");
for (const slug of dataSlugs) {
  if (!treeSlugs.has(slug)) report("слаг локации не в дереве", "—", slug, "locations-data-es.ts");
}

// 5. Copy hardcoded inside components. Several components predate the messages
//    catalogue and carry their own per-locale copy block (LocationExplorer,
//    WeddingBand). Auditing only messages/*.json declared the site clean while
//    the German homepage still asked "Ihr heiratet in Portugal?".
const walkFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const PT_IN_CODE = /\b(Portugal|Lisboa|Algarve|Sintra|Cascais|Douro)\b/;

// Scanning every literal produces thousands of hits: the `: "Portugal"` branch
// of a country ternary is correct, and plenty of literals are never rendered.
// The real defect is narrower and is what actually shipped — a file that is
// ALREADY country-aware, where some locales were converted to the country
// constant and others were left hardcoded. WeddingBand had exactly that: `en`
// and `es` used CN, while `pt`, `de` and `fr` still said Portugal.
for (const file of walkFiles("src")) {
  const raw = fs.readFileSync(file, "utf8");
  if (!/from "@\/lib\/country"/.test(raw)) continue;
  const code = stripComments(raw);
  const lines = code.split("\n");
  lines.forEach((line, i) => {
    if (!PT_IN_CODE.test(line)) return;
    // A conditional on this line, or the line above, means it is deliberate.
    const context = `${lines[i - 1] ?? ""}\n${line}`;
    if (/country\.code|isSpain|country\.areaServed|CN\./.test(context)) return;
    if (!/["'`]/.test(line)) return;
    advise("страна зашита в country-aware файле (справочно)", "—", `${file.replace(/^src\//, "")}:${i + 1}`, line.trim().slice(0, 80));
  });
}

// 6. The English country name substituted into a non-English field, e.g.
//    "bodas en Spain", "Hochzeitsfotografen in Spain buchen".
for (const file of fs.readdirSync("src/lib").filter((f) => f.endsWith("-es.ts"))) {
  const code = fs.readFileSync(path.join("src/lib", file), "utf8");
  for (const [, key, lang, value] of code.matchAll(/(\w+)_(es|pt|de|fr):\s*"((?:[^"\\]|\\.)*)"/g)) {
    // The BRAND is legitimately English in every locale — "Photo Spain" is a
    // proper noun, the same way base de/fr keep "Photo Portugal". Strip it
    // before testing, or fixing the translated-brand bug re-triggers this check.
    const withoutBrand = value.replace(/Photo Spain/g, "");
    if (/\bSpain\b|Riojatal/.test(withoutBrand)) {
      report("английское «Spain» в неанглийском поле", lang, `${file}:${key}_${lang}`, value.slice(0, 70));
    }
  }
}

// 7b. Broken article/preposition agreement in the DATASETS, not just the
//     messages layer. "Portugal" is masculine and "Espagne"/"España" feminine,
//     so bulk substitution leaves "le Espagne" and "todo España" behind. Ten of
//     these survived in shoot-types-data-es.ts after the messages layer was
//     repaired, and shipped into FAQPage structured data.
const DATASET_GRAMMAR = [
  [/\b(au|le|la|du) Espagne\b/gi, "французский артикль/предлог + Espagne"],
  [/\btodo España\b/gi, "todo España → toda España"],
  [/\b(el|del) España\b/g, "испанский артикль + España"],
  [/\bder Spanien\b/g, "der Spanien"],
];
for (const file of fs.readdirSync("src/lib").filter((f) => f.endsWith("-es.ts"))) {
  const code = fs.readFileSync(path.join("src/lib", file), "utf8");
  for (const [re, label] of DATASET_GRAMMAR) {
    const hits = code.match(re);
    if (hits) report("сломанное согласование в датасете", "—", file, `${hits.length}× ${label}`);
  }
}

// 7. The brand translated, ANYWHERE in src — not just the messages layer.
//    The first repair pass only walked messages/country/es/*.json, so 122
//    occurrences survived in shoot-types-data-es.ts and shipped "Photo
//    Spanien" and "Photo Espagne" into German and French body copy and into
//    FAQPage structured data. The brand is a proper noun in every locale.
for (const file of walkFiles("src")) {
  const code = fs.readFileSync(file, "utf8");
  const hits = code.match(TRANSLATED_BRAND);
  if (hits) {
    report("бренд переведён", "—", file.replace(/^src\//, ""), `${hits.length}× ${hits[0]}`);
  }
}

if (advisories.length) {
  console.log(`ℹ️  справочно (не блокирует): ${advisories.length} строк со страной, зашитой в country-aware файлах`);
  console.log("   живой скан текста/меты/JSON-LD — единственная надёжная проверка, см. docs/MARKETS.md §11\n");
}

if (problems.length === 0) {
  console.log("✅ утечек не найдено");
  process.exit(0);
}

const byKind = {};
for (const p of problems) (byKind[p.kind] ??= []).push(p);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n═══ ${kind}: ${list.length}`);
  for (const p of list.slice(0, 30)) {
    console.log(`   [${p.locale}] ${p.key}${p.detail ? `  ${p.detail}` : ""}`);
  }
  if (list.length > 30) console.log(`   … ещё ${list.length - 30}`);
}
console.log(`\n❌ всего проблем: ${problems.length}`);
process.exit(1);
