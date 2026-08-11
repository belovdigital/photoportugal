/**
 * Turn named DRAFTS into real fiscal documents. One-off, ids passed explicitly.
 *
 *   node scripts/invoicexpress-finalize.mjs 266641231            # one
 *   node scripts/invoicexpress-finalize.mjs 266641231 266641235  # several
 *
 * IRREVERSIBLE. A finalised InvoiceXpress document cannot be deleted, only
 * credited. Ids are required arguments rather than "everything in draft state"
 * on purpose: the blast radius of a typo should be one document, and there
 * should be no way to run this and be surprised by what it touched.
 *
 * It also refuses any id that is not currently a draft, and any id that is not
 * recorded against a booking — an unrecorded document is an orphan, and
 * finalising an orphan is the one mistake that cannot be walked back.
 */
import { readFileSync } from "fs";
import pg from "pg";

const APP_DIR = "/var/www/photoportugal";
const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (ids.length === 0) {
  console.error("usage: node scripts/invoicexpress-finalize.mjs <invoice-id> [more ids…]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(`${APP_DIR}/.env`, "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; })
);
const BASE = `https://${env.INVOICEXPRESS_ACCOUNT}.app.invoicexpress.com`;

async function ix(method, path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}api_key=${env.INVOICEXPRESS_API_KEY}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const { Client } = pg;
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

for (const id of ids) {
  try {
    const before = (await ix("GET", `/invoices/${id}.json`)).invoice;
    if (before.status !== "draft") {
      console.log(`  · ${id} is "${before.status}", not a draft — skipped`);
      continue;
    }
    const { rows } = await db.query(
      "SELECT id FROM bookings WHERE invoicexpress_invoice_id = $1",
      [String(id)]
    );
    if (rows.length !== 1) {
      console.log(`  ! ${id} is recorded against ${rows.length} bookings — refusing to finalise an orphan`);
      continue;
    }

    const after = (await ix("PUT", `/invoices/${id}/change-state.json`, {
      invoice: { state: "finalized" },
    })).invoice;

    await db.query(
      "UPDATE bookings SET invoicexpress_state = 'final' WHERE invoicexpress_invoice_id = $1",
      [String(id)]
    );
    console.log(`  ✓ ${id} → ${after.status}  ${after.sequence_number || ""}  ${after.total || ""}  (booking ${rows[0].id.slice(0, 8)})`);
  } catch (err) {
    console.error(`  ✗ ${id} — ${err.message}`);
  }
}
await db.end();
