#!/usr/bin/env node
// npm run verify — the one command that must pass before any "done".
//
// Checks, in order of how often each class has actually burned us:
//   1. i18n — every namespace referenced from code exists in messages/en.json,
//      and all SIX base locale files carry the same key set. A missing key
//      renders as a raw key path in production ("quickBooking.title") and the
//      `|| fallback` pattern does not catch it — see CLAUDE.md §i18n.
//   2. messages/*.json parse, including the country override layer
//      (messages/country/{es,it}) whose keys must exist in the base files.
//   3. tsc --noEmit.
//   4. eslint (errors fail; the ~355 standing warnings do not).
//
// Zero dependencies, no network, no prod access — safe to run anywhere.

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LOCALES = ["en", "pt", "de", "es", "fr", "it"];
let failures = 0;

function section(name) {
  process.stdout.write(`\n── ${name}\n`);
}
function fail(msg) {
  failures++;
  console.log(`  ✗ ${msg}`);
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

// Every leaf key path in a messages object: "booking.form.title", ...
function keyPaths(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keyPaths(v, p));
    else out.push(p);
  }
  return out;
}
function hasPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

// ── 1+2. messages files ─────────────────────────────────────────────────────
section("i18n: base locale files");
const messages = {};
for (const loc of LOCALES) {
  const file = path.join(ROOT, "messages", `${loc}.json`);
  try {
    messages[loc] = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`messages/${loc}.json does not parse: ${e.message}`);
  }
}

if (messages.en) {
  const enPaths = new Set(keyPaths(messages.en));
  ok(`en.json: ${enPaths.size} keys`);
  for (const loc of LOCALES.filter((l) => l !== "en")) {
    if (!messages[loc]) continue;
    const locPaths = new Set(keyPaths(messages[loc]));
    const missing = [...enPaths].filter((p) => !locPaths.has(p));
    const extra = [...locPaths].filter((p) => !enPaths.has(p));
    if (missing.length)
      fail(`${loc}.json missing ${missing.length} keys vs en: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}`);
    else ok(`${loc}.json covers all en keys`);
    if (extra.length)
      fail(`${loc}.json has ${extra.length} keys absent from en: ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? ", …" : ""}`);
  }
}

section("i18n: country overrides (messages/country/*)");
const countryDir = path.join(ROOT, "messages", "country");
if (existsSync(countryDir) && messages.en) {
  const enPaths = new Set(keyPaths(messages.en));
  for (const market of readdirSync(countryDir)) {
    const dir = path.join(countryDir, market);
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const rel = `country/${market}/${f}`;
      let data;
      try {
        data = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      } catch (e) {
        fail(`messages/${rel} does not parse: ${e.message}`);
        continue;
      }
      // An override key that no base file has is dead weight at best,
      // a typo hiding a real key at worst.
      const orphans = keyPaths(data).filter((p) => !enPaths.has(p));
      if (orphans.length)
        fail(`messages/${rel}: ${orphans.length} keys not present in base en.json: ${orphans.slice(0, 4).join(", ")}${orphans.length > 4 ? ", …" : ""}`);
      else ok(`messages/${rel} is a clean subset`);
    }
  }
}

// ── 1b. namespaces referenced from code exist ───────────────────────────────
section("i18n: namespaces referenced from code");
if (messages.en) {
  // useTranslations("ns"), getTranslations("ns"), getTranslations({namespace:"ns"})
  let grep = "";
  try {
    grep = execSync(
      `grep -rhoE '(useTranslations|getTranslations)\\((\\{[^}]*namespace:\\s*)?"[^"]+"' src --include='*.ts' --include='*.tsx'`,
      { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    );
  } catch {
    /* no matches */
  }
  const namespaces = new Set();
  for (const line of grep.split("\n")) {
    const m = line.match(/"([^"]+)"$/);
    if (m) namespaces.add(m[1]);
  }
  const bad = [...namespaces].filter((ns) => !hasPath(messages.en, ns)).sort();
  if (bad.length)
    for (const ns of bad)
      fail(`namespace "${ns}" is used in code but missing from messages/en.json — WILL render raw key paths`);
  else ok(`${namespaces.size} namespaces used in code, all present in en.json`);
}

// ── 3. tsc ──────────────────────────────────────────────────────────────────
section("tsc --noEmit");
try {
  execSync("npx tsc --noEmit", { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 });
  ok("clean");
} catch (e) {
  fail("type errors:");
  process.stdout.write(String(e.stdout || e.message).split("\n").slice(0, 30).join("\n") + "\n");
}

// ── 4. eslint ───────────────────────────────────────────────────────────────
section("eslint (errors only)");
try {
  execSync("npx eslint . --quiet", { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  ok("no errors");
} catch (e) {
  fail("lint errors:");
  process.stdout.write(String(e.stdout || e.message).split("\n").slice(0, 30).join("\n") + "\n");
}

// ── verdict ─────────────────────────────────────────────────────────────────
console.log("");
if (failures) {
  console.log(`VERIFY FAILED — ${failures} problem${failures === 1 ? "" : "s"}. Do not say "done", do not deploy.`);
  process.exit(1);
}
console.log("VERIFY PASSED");
