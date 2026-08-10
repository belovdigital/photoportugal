// Diff our router-state validator against the one Next actually uses.
//
// src/lib/flight-router-state.ts re-implements Next's
// parseAndValidateFlightRouterState so middleware can drop a broken
// Next-Router-State-Tree header instead of letting it 500 the page. This
// checks the two agree, so a Next upgrade that widens or tightens the schema
// shows up here rather than as either false 500s or needless full-document
// renders.
//
// Usage: node scripts/check-flight-router-state.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { parseAndValidateFlightRouterState } = require("next/dist/server/app-render/parse-and-validate-flight-router-state");

// Compile our TS module standalone (it has no imports, so tsc alone suffices).
const out = fs.mkdtempSync(path.join(os.tmpdir(), "frs-"));
execFileSync("npx", ["tsc", "src/lib/flight-router-state.ts", "--outDir", out, "--module", "commonjs", "--target", "es2022", "--skipLibCheck"], { stdio: "pipe" });
const ours = require(path.join(out, "flight-router-state.js"));

const tree = (segment, children = {}, ...rest) => [segment, children, ...rest];

const CASES = [
  // --- shapes a real client sends ---
  tree(""),
  tree("", { children: tree("faq", { children: tree("__PAGE__") }) }),
  tree("", { children: tree("blog", { children: tree(["slug", "my-post", "d", null], { children: tree("__PAGE__") }) }) }),
  tree("", { children: tree("photographers", { children: tree("__PAGE__") }) }, null, "refetch"),
  tree("", { children: tree("__PAGE__") }, ["/faq", "/faq"], "inside-shared-layout", 1),
  tree("", { children: tree("__PAGE__") }, null, "metadata-only"),
  tree(["locale", "pt", "d", null], { children: tree("__PAGE__") }),
  tree(["slug", "a", "ci(...)", ["x", "y"]], { children: tree("__PAGE__") }),
  tree("", { children: tree("a", { children: tree("b", { children: tree("__PAGE__") }) }) }, null, null, 0),
  // --- parallel routes ---
  tree("", { children: tree("__PAGE__"), modal: tree("photo", { children: tree("__PAGE__") }) }),
  // --- malformed ---
  "nonsense",
  "",
  "[]",
  "[null,{}]",
  '["",[]]',
  '["",{},null,null,true]',
  '["",{},null,"not-a-marker"]',
  '["",{},"not-a-tuple"]',
  '["",{},["only-one"]]',
  '[["p"],{}]',
  '[["p","v","d"],{}]',
  '[["p","v","d",5],{}]',
  '[["p","v","bogus-type"],{}]',
  '["",{"children":"not-a-state"}]',
  '["",{},null,null,1,"sixth"]',
  '{"children":[]}',
  "42",
  '"just-a-string"',
  "%%%not-uri",
  "[",
];

let mismatches = 0;
for (const raw of CASES) {
  const header = typeof raw === "string" ? raw : encodeURIComponent(JSON.stringify(raw));

  let nextOk;
  try {
    parseAndValidateFlightRouterState(header);
    nextOk = true;
  } catch {
    nextOk = false;
  }
  const oursOk = ours.isParsableRouterState(header);

  if (nextOk !== oursOk) {
    mismatches++;
    const label = typeof raw === "string" ? raw : JSON.stringify(raw);
    console.log(`MISMATCH  next=${nextOk} ours=${oursOk}  ${label.slice(0, 110)}`);
  }
}

// Oversized header: Next throws its own "too large" error above 40000 chars.
const huge = encodeURIComponent(JSON.stringify(tree("", { children: tree("x".repeat(40000)) })));
let nextHuge;
try { parseAndValidateFlightRouterState(huge); nextHuge = true; } catch { nextHuge = false; }
if (nextHuge !== ours.isParsableRouterState(huge)) {
  mismatches++;
  console.log(`MISMATCH on oversized header: next=${nextHuge} ours=${ours.isParsableRouterState(huge)}`);
}

fs.rmSync(out, { recursive: true, force: true });
console.log(mismatches === 0
  ? `ok — ${CASES.length + 1} cases, our validator agrees with Next's on every one`
  : `${mismatches} mismatch(es) — src/lib/flight-router-state.ts has drifted from Next`);
process.exit(mismatches === 0 ? 0 : 1);
