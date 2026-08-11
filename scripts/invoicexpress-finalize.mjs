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
const argv = process.argv.slice(2);
/**
 * --date YYYY-MM-DD moves the draft before finalising.
 *
 * The only legitimate use: a document that arrived out of order and cannot be
 * dated truthfully without the series going backwards, which InvoiceXpress and
 * Portuguese numbering both forbid. The real choice there is a date a day or
 * two late, or no document at all for a payment that happened — and no
 * document is worse. It is loud on purpose.
 */
const dateIdx = argv.indexOf("--date");
const forcedDate = dateIdx > -1 ? argv[dateIdx + 1] : null;
if (forcedDate && !/^\d{4}-\d{2}-\d{2}$/.test(forcedDate)) {
  console.error("--date must be YYYY-MM-DD");
  process.exit(1);
}
const ids = argv.filter((a) => /^\d+$/.test(a));
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
    // Two ledgers: bookings carry their own columns (migration 006), everything
    // issued since — add-on subscriptions, extras — lives in issued_documents.
    // A document recorded in neither is an orphan, and finalising an orphan is
    // the one mistake with no way back.
    const { rows } = await db.query(
      `SELECT id::text AS ref, 'booking' AS kind FROM bookings WHERE invoicexpress_invoice_id = $1
       UNION ALL
       SELECT source_type || ' ' || source_id, 'ledger' FROM issued_documents WHERE invoicexpress_invoice_id = $1`,
      [String(id)]
    );
    if (rows.length !== 1) {
      console.log(`  ! ${id} is recorded against ${rows.length} sources — refusing to finalise an orphan`);
      continue;
    }

    if (forcedDate && before.date) {
      console.log(`  ⚠ ${id}: moving date ${before.date} → ${forcedDate} before finalising`);
      // The update endpoint replaces the document, so the client and every
      // line have to be sent back with it — a bare date change returns
      // "No items element provided" and touches nothing.
      await ix("PUT", `/invoices/${id}.json`, {
        invoice: {
          date: forcedDate,
          due_date: forcedDate,
          client: { id: before.client?.id },
          items: (before.items || []).map((it) => ({
            name: it.name,
            description: it.description,
            unit_price: it.unit_price,
            quantity: it.quantity,
            tax: { name: it.tax?.name },
          })),
          tax_exemption: before.tax_exemption,
          observations: before.observations,
        },
      });
    }

    const after = (await ix("PUT", `/invoices/${id}/change-state.json`, {
      invoice: { state: "finalized" },
    })).invoice;

    if (rows[0].kind === "booking") {
      await db.query("UPDATE bookings SET invoicexpress_state = 'final' WHERE invoicexpress_invoice_id = $1", [String(id)]);
    } else {
      await db.query("UPDATE issued_documents SET state = 'final' WHERE invoicexpress_invoice_id = $1", [String(id)]);
    }
    console.log(`  ✓ ${id} → ${after.status}  ${after.sequence_number || ""}  ${after.total || ""}  (${rows[0].ref.slice(0, 32)})`);
  } catch (err) {
    console.error(`  ✗ ${id} — ${err.message}`);
  }
}
await db.end();
