#!/usr/bin/env node

const base = (process.argv[2] || process.env.BLOG_AUDIT_BASE_URL || "https://photoportugal.com").replace(/\/$/, "");

const LOCATIONS = [
  ["algarve", "Algarve", [/algarve/, /benagil/]],
  ["lagos", "Lagos", [/lagos/]],
  ["sintra", "Sintra", [/sintra/, /pena-palace/]],
  ["cascais", "Cascais", [/cascais/]],
  ["douro-valley", "Douro Valley", [/douro-valley/]],
  ["porto", "Porto", [/porto/]],
  ["lisbon", "Lisbon", [/lisbon/]],
  ["aveiro", "Aveiro", [/aveiro/]],
  ["obidos", "Obidos", [/obidos/]],
  ["coimbra", "Coimbra", [/coimbra/]],
  ["evora", "Evora", [/evora/]],
  ["nazare", "Nazare", [/nazare/]],
];

const SIGNALS = [
  "Real shots from",
  "Featured in",
  "Want professional photos in",
  "Photographers ready to shoot in",
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function expectedLocation(slug) {
  const matched = LOCATIONS.filter(([, , rules]) => rules.some((rule) => rule.test(slug)));
  // Ambiguous comparison posts (e.g. lisbon-vs-porto) are not audited here.
  if (matched.length !== 1) return null;
  return matched[0][1];
}

function signalLocation(text, signal) {
  const idx = text.toLowerCase().indexOf(signal.toLowerCase());
  if (idx < 0) return null;
  const tail = text.slice(idx + signal.length, idx + signal.length + 90).toLowerCase();
  const loc = LOCATIONS.find(([, label]) => tail.trimStart().startsWith(label.toLowerCase()));
  return loc?.[1] || null;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.text();
}

const sitemap = await fetchText(`${base}/sitemap.xml`);
const urls = [...sitemap.matchAll(new RegExp(`<loc>(${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/blog\\/[^<]+)<\\/loc>`, "g"))]
  .map((match) => match[1]);

const failures = [];
let checked = 0;

for (const url of urls) {
  const slug = url.split("/").pop();
  const expected = expectedLocation(slug);
  if (!expected) continue;

  checked++;
  const text = stripHtml(await fetchText(url));
  const found = Object.fromEntries(
    SIGNALS.map((signal) => [signal, signalLocation(text, signal)]).filter(([, value]) => value)
  );
  const badSignals = Object.entries(found).filter(([, value]) => value !== expected);
  if (badSignals.length > 0) {
    failures.push({ slug, expected, found });
  }
}

console.log(`Audited ${checked} location-specific blog posts from ${base}`);

if (failures.length > 0) {
  console.error(`Found ${failures.length} blog conversion topic mismatch(es):`);
  for (const failure of failures) {
    console.error(`- ${failure.slug}: expected ${failure.expected}, found ${JSON.stringify(failure.found)}`);
  }
  process.exit(1);
}

console.log("No blog conversion topic mismatches found.");
