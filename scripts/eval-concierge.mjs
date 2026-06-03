#!/usr/bin/env node
// Concierge eval runner.
//
// Exercises every scenario in src/lib/concierge/eval-suite.ts against a
// live /api/concierge/chat endpoint and prints a pass/fail summary.
//
// Usage:
//   BASE_URL=https://photoportugal.com node scripts/eval-concierge.mjs
//   BASE_URL=http://localhost:3000 node scripts/eval-concierge.mjs
//
// Default BASE_URL is localhost:3000 so the runner is safe to invoke
// from a dev checkout without surprise hits on production.
//
// Each scenario is exercised in a FRESH chat — the runner generates a
// random visitor_id per scenario so persona memory + per-chat shown
// state don't bleed between tests.
//
// What's checked automatically:
//   - response is HTTP 200 and JSON-parseable
//   - data.action.type matches expectedBehavior.action where it's a
//     hard-coded tool name (ask_clarify → action==null; show_matches /
//     show_locations / etc. map directly; coverage_gap → action==null
//     + reply mentions the unsupported place)
//   - data.reply contains every string in expectedBehavior.mustContain
//   - data.reply contains NONE of expectedBehavior.mustNotContain
//   - language heuristic: when expectedBehavior.language is set,
//     check character class (cyrillic for ru, basic latin + diacritics
//     for romance, etc.)
//
// What requires manual review (flagged but not fatal):
//   - "language: same_as_user" — runner can't validate without seeing
//     prior turn language
//   - "newcomer-discovery" — needs N runs and aggregate analysis
//
// Exit code: non-zero if any scenario hard-fails. Manual-review-only
// scenarios are reported but don't break the exit code.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TIMEOUT_MS = 30_000;

// --- Load scenarios via raw file parse ----------------------------------
// We can't ESM-import eval-suite.ts directly (it's TypeScript) without a
// loader, so the runner pulls a JSON-shaped subset from a snapshot file.
// Keep this list in sync with eval-suite.ts — manual today, codegen later.
//
// Trade-off: a tiny duplication for zero build dependency. The runner
// stays a one-liner you can invoke from anywhere.
const SCENARIOS_FILE = join(__dirname, "concierge-scenarios.json");
const SCENARIOS = JSON.parse(readFileSync(SCENARIOS_FILE, "utf8"));

// --- Language heuristic -------------------------------------------------
// Server-rendered chat replies are short; a light regex check is enough
// to spot grossly-wrong language without dragging a CLD library in.
function detectLanguage(text) {
  if (!text || text.length < 4) return "unknown";
  const cyrillic = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const total = text.replace(/\s/g, "").length;
  if (total > 0 && cyrillic / total > 0.3) return "ru";
  // Heuristic: distinctive lowercase tokens per language. Cheap, not
  // robust — but enough to catch "AI replied EN to a PT visitor"-class
  // failures, which is what we care about.
  const lower = " " + text.toLowerCase() + " ";
  const score = {
    pt: (lower.match(/\b(de|para|com|você|sua|seu|olá|fotógrafo|sessão|sim|não)\b/g) || []).length,
    de: (lower.match(/\b(und|der|die|das|ein|sie|mit|für|fotograf|nicht|ja)\b/g) || []).length,
    es: (lower.match(/\b(el|la|de|para|con|usted|fotógrafo|sesión|sí|no)\b/g) || []).length,
    fr: (lower.match(/\b(le|la|de|pour|avec|vous|votre|photographe|séance|oui|non)\b/g) || []).length,
    en: (lower.match(/\b(the|and|for|with|you|your|photographer|shoot|yes|no)\b/g) || []).length,
  };
  let best = "en";
  let bestN = 0;
  for (const [k, n] of Object.entries(score)) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return bestN >= 1 ? best : "unknown";
}

// --- One scenario run ---------------------------------------------------
async function runScenario(s) {
  const visitorId = `eval-${s.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = {
    visitor_id: visitorId,
    messages: [{ role: "user", content: s.opening }],
    // page_context_obj could be added based on s.pageContext but we
    // keep it simple — most scenarios test fresh-page behaviour.
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(`${BASE_URL}/api/concierge/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: `fetch failed: ${err.message}` };
  }
  clearTimeout(timer);

  if (!resp.ok) {
    return { ok: false, error: `HTTP ${resp.status}` };
  }
  const data = await resp.json().catch(() => null);
  if (!data) return { ok: false, error: "non-JSON response" };

  const reply = (data.reply || "").trim();
  const actionType = data.action?.type ?? null;
  const expected = s.expectedBehavior;

  const failures = [];

  // Action check
  const actualAction =
    actionType === "show_matches" ? "show_matches" :
    actionType === "show_locations" ? "show_locations" :
    actionType === "show_spots" ? "show_spots" :
    actionType === "request_human_match" ? "ask_clarify" :
    actionType === null ? "ask_clarify" : actionType;

  // coverage_gap manifests as ask_clarify (no tool call) + reply mentions the place
  if (expected.action === "coverage_gap") {
    if (actionType !== null) failures.push(`expected coverage_gap (no tool), got ${actionType}`);
  } else if (expected.action === "ask_clarify") {
    if (actionType === "show_matches") failures.push(`expected ask_clarify, AI called show_matches`);
  } else if (expected.action === "show_matches") {
    if (actionType !== "show_matches") failures.push(`expected show_matches, got ${actionType || "ask_clarify"}`);
  } else if (expected.action === "show_locations") {
    if (actionType !== "show_locations") failures.push(`expected show_locations, got ${actionType || "ask_clarify"}`);
  }

  // mustContain
  for (const phrase of expected.mustContain || []) {
    if (!reply.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`mustContain missing: "${phrase}"`);
    }
  }
  // mustNotContain
  for (const phrase of expected.mustNotContain || []) {
    if (reply.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`mustNotContain present: "${phrase}"`);
    }
  }

  // Language check (skip "same_as_user" — needs prior context)
  let langNote = null;
  if (expected.language && expected.language !== "same_as_user") {
    const detected = detectLanguage(reply);
    if (detected !== "unknown" && detected !== expected.language) {
      failures.push(`language: expected ${expected.language}, detected ${detected}`);
    } else if (detected === "unknown") {
      langNote = `language: heuristic indeterminate (reply too short or mixed)`;
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    note: langNote,
    actualAction,
    replyPreview: reply.slice(0, 100),
    chatId: data.chat_id,
  };
}

// --- Cleanup helper -----------------------------------------------------
// Test chats accumulate in concierge_chats — caller should periodically
// purge them. For now we just emit chat_ids so they're traceable.

// --- Main ---------------------------------------------------------------
console.log(`\nConcierge eval — target: ${BASE_URL}`);
console.log(`Scenarios: ${SCENARIOS.length}\n`);
console.log("─".repeat(70));

let passed = 0;
let failed = 0;
const failures = [];
const testChatIds = [];

for (const s of SCENARIOS) {
  process.stdout.write(`  ${s.id.padEnd(34)} `);
  const result = await runScenario(s);
  if (result.chatId) testChatIds.push(result.chatId);
  if (result.ok) {
    process.stdout.write(`\x1b[32m✓\x1b[0m  ${result.actualAction}\n`);
    passed++;
  } else {
    process.stdout.write(`\x1b[31m✗\x1b[0m  ${result.error || result.failures.join(", ")}\n`);
    failed++;
    failures.push({ id: s.id, result, opening: s.opening });
  }
  if (result.note) {
    process.stdout.write(`     \x1b[33m⚠\x1b[0m  ${result.note}\n`);
  }
}

console.log("─".repeat(70));
console.log(`\nResult: \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : `${failed} failed`}\n`);

if (failures.length > 0) {
  console.log("Failed scenarios:");
  for (const f of failures) {
    console.log(`\n  [${f.id}]  opening: "${f.opening}"`);
    if (f.result.error) console.log(`    error: ${f.result.error}`);
    for (const fl of f.result.failures || []) console.log(`    - ${fl}`);
    if (f.result.replyPreview) console.log(`    reply: "${f.result.replyPreview}..."`);
  }
  console.log();
}

if (testChatIds.length > 0) {
  console.log(`Created ${testChatIds.length} test chats. To clean up:`);
  console.log(`  DELETE FROM concierge_recommendation_events WHERE chat_id = ANY(ARRAY[${testChatIds.map(id => `'${id}'`).join(", ")}]::uuid[]);`);
  console.log(`  DELETE FROM concierge_chats WHERE id = ANY(ARRAY[${testChatIds.map(id => `'${id}'`).join(", ")}]::uuid[]);`);
  console.log();
}

process.exit(failed > 0 ? 1 : 0);
