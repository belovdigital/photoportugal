#!/usr/bin/env node
// Smoke gate — runs on the server inside /var/www/deploy.sh, against the
// freshly built (not yet live) colour, BEFORE nginx switches traffic to it.
// If this exits non-zero, the deploy aborts and the old colour stays live.
//
//   node scripts/smoke.mjs --base http://127.0.0.1:3001
//   node scripts/smoke.mjs --base https://photoportugal.com --list   # calibrate
//
// What it checks on ~MAX real pages sampled from the app's own sitemap:
//   1. The page answers 200 (redirects followed).
//   2. The body is HTML of non-trivial size.
//   3. The visible text contains no raw i18n key paths ("quickBooking.title")
//      — the failure mode that has actually shipped before (2026-06-03).
//
// Zero dependencies; node >= 18 (global fetch). The sitemap is generated from
// the same DB the new build will serve, so the sample is always real pages of
// the market being deployed — nothing is hardcoded per market.

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : dflt;
}
const BASE = (arg("base", "http://127.0.0.1:3000")).replace(/\/$/, "");
const MAX = parseInt(arg("max", "30"), 10);
const LIST_ONLY = args.includes("--list");
const TIMEOUT_MS = 20000;
const CONCURRENCY = 4;

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "pp-smoke-gate/1", "Accept-Language": "en" },
    });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

// ── sample URLs from the sitemap ───────────────────────────────────────────
function pathsFromSitemapXml(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1].trim()).pathname || "/";
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// Bucket a path by its section so the sample spreads across page types
// instead of drowning in one long section (blog has hundreds of URLs).
function sectionOf(p) {
  const parts = p.split("/").filter(Boolean);
  // strip a 2-letter locale prefix for bucketing; keep it in the path
  const rest = parts.length && /^[a-z]{2}$/.test(parts[0]) ? parts.slice(1) : parts;
  if (rest.length === 0) return "home";
  if (rest.length === 1) return `top:${rest[0]}`;
  return rest[0]; // photographers, locations, blog, photoshoots, lp, spots…
}

async function pickUrls() {
  const { status, body } = await get(`${BASE}/sitemap.xml`);
  if (status !== 200) throw new Error(`sitemap.xml → ${status}`);
  let paths = pathsFromSitemapXml(body);
  // sitemap index → fetch children
  if (body.includes("<sitemapindex")) {
    const children = paths;
    paths = [];
    for (const c of children.slice(0, 10)) {
      const r = await get(`${BASE}${c}`);
      if (r.status === 200) paths.push(...pathsFromSitemapXml(r.body));
    }
  }
  if (!paths.length) throw new Error("sitemap yielded zero URLs");

  const buckets = new Map();
  for (const p of paths) {
    const s = sectionOf(p);
    if (!buckets.has(s)) buckets.set(s, []);
    buckets.get(s).push(p);
  }
  // deterministic: first + last of each bucket (stable across runs so a
  // failure is reproducible), round-robin until MAX
  const picked = new Set(["/"]);
  const perBucket = [...buckets.entries()].map(([, list]) => {
    const uniq = [...new Set(list)];
    return [uniq[0], uniq[uniq.length - 1], ...uniq.slice(1, -1)];
  });
  outer: for (let round = 0; round < 50; round++) {
    for (const list of perBucket) {
      if (picked.size >= MAX) break outer;
      if (list[round]) picked.add(list[round]);
    }
  }
  return [...picked];
}

// ── raw i18n-key detector ──────────────────────────────────────────────────
// Visible text = body minus script/style/head/JSON-LD/comments/tags.
function visibleText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
}

// token.token(.token)* of letter-words, excluding things that legitimately
// contain dots: domains/TLDs, filenames, "e.g."-style, version-ish strings.
const NOT_A_KEY =
  /\.(com|net|org|io|co|pt|es|it|de|fr|eu|app|dev|js|ts|jsx|tsx|json|md|png|jpe?g|webp|svg|gif|ico|css|html?|pdf|zip|mjs|cjs|txt|xml|yml|sh)(\.|$)/i;
function findRawKeys(html) {
  const text = visibleText(html);
  const hits = new Set();
  for (const m of text.matchAll(/\b[a-z][a-zA-Z0-9]{2,}(?:\.[a-zA-Z][a-zA-Z0-9]{2,}){1,3}\b/g)) {
    const tok = m[0];
    if (NOT_A_KEY.test(tok + ".")) continue;
    if (tok.includes("@")) continue;
    hits.add(tok);
  }
  return [...hits];
}

// ── run ────────────────────────────────────────────────────────────────────
const urls = await pickUrls();
if (LIST_ONLY) {
  console.log(urls.join("\n"));
  process.exit(0);
}

console.log(`smoke: ${urls.length} pages from ${BASE}`);
const failures = [];
let i = 0;
async function worker() {
  while (i < urls.length) {
    const p = urls[i++];
    try {
      const { status, body } = await get(`${BASE}${p}`);
      if (status !== 200) {
        failures.push(`${p} → HTTP ${status}`);
        console.log(`  ✗ ${p} → ${status}`);
        continue;
      }
      if (body.length < 2000 || !/<(!doctype|html)/i.test(body)) {
        failures.push(`${p} → suspiciously small/non-HTML body (${body.length}b)`);
        console.log(`  ✗ ${p} → tiny body ${body.length}b`);
        continue;
      }
      const raw = findRawKeys(body);
      if (raw.length) {
        failures.push(`${p} → raw i18n keys in visible text: ${raw.slice(0, 5).join(", ")}`);
        console.log(`  ✗ ${p} → raw keys: ${raw.slice(0, 5).join(", ")}`);
        continue;
      }
      console.log(`  ✓ ${p}`);
    } catch (e) {
      failures.push(`${p} → ${e.name === "AbortError" ? `timeout ${TIMEOUT_MS}ms` : e.message}`);
      console.log(`  ✗ ${p} → ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("");
if (failures.length) {
  console.log(`SMOKE FAILED — ${failures.length}/${urls.length} pages broken:`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log(`SMOKE PASSED — ${urls.length} pages OK`);
