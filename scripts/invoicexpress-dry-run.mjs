/**
 * What the platform would invoice each client — and, on demand, the drafts.
 *
 *   node scripts/invoicexpress-dry-run.mjs                  # table only, no API calls
 *   node scripts/invoicexpress-dry-run.mjs --create-drafts  # creates DRAFTS (deletable)
 *   node scripts/invoicexpress-dry-run.mjs --create-drafts --limit 2
 *
 * Runs on the prod box (needs .env for DB + InvoiceXpress). It never finalises:
 * a finalised document cannot be deleted, only credited, so finalisation lives
 * behind INVOICEXPRESS_FINALIZE and a separate deliberate run.
 *
 * The amount is what Stripe actually charged minus the photographer's payout.
 * Not the package price — promo codes, blind pricing and the €5 rounding all
 * make those disagree, and the document has to match the money.
 */
import { readFileSync } from "fs";
import pg from "pg";

const APP_DIR = "/var/www/photoportugal";
const CREATE = process.argv.includes("--create-drafts");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? parseInt(process.argv[i + 1], 10) : 50;
})();

const env = Object.fromEntries(
  readFileSync(`${APP_DIR}/.env`, "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; })
);

const ACCOUNT = env.INVOICEXPRESS_ACCOUNT;
const API_KEY = env.INVOICEXPRESS_API_KEY;
const SEQUENCE_ID = env.INVOICEXPRESS_SEQUENCE_ID;
const BASE = `https://${ACCOUNT}.app.invoicexpress.com`;
const EXEMPT_TAX_NAME = "Isento";
const EXEMPTION_REASON = "M10"; // artigo 53.º CIVA
const CONSUMIDOR_FINAL = "999999990";

async function ix(method, path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}api_key=${API_KEY}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const eur = (n) => (n == null ? "—" : `€${Number(n).toFixed(2)}`);

const { Client } = pg;
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(`
  SELECT b.id, b.created_at::date::text AS booked_on,
         COALESCE(b.confirmed_at, b.updated_at)::date::text AS paid_on,
         b.stripe_amount_paid_cents, b.stripe_currency, b.stripe_promo_code,
         b.payout_amount, b.total_price, b.blind_booking,
         b.invoicexpress_invoice_id, b.invoicexpress_state,
         cu.id::text AS client_id, cu.name AS client_name, cu.email AS client_email,
         p.name AS package_name,
         pu.name AS photographer_name
    FROM bookings b
    JOIN users cu ON cu.id = b.client_id
    LEFT JOIN packages p ON p.id = b.package_id
    LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
    LEFT JOIN users pu ON pu.id = pp.user_id
   WHERE b.payment_status = 'paid'
     AND b.stripe_amount_paid_cents IS NOT NULL
     -- Kate's activity starts 2026-08-01. A document cannot be issued under an
     -- activity that did not exist when the money moved, so earlier bookings
     -- are listed for context but never issuable.
   ORDER BY COALESCE(b.confirmed_at, b.updated_at) DESC
   LIMIT $1`, [LIMIT]);

const ACTIVITY_START = "2026-08-01";

const plan = [];
for (const r of rows) {
  const paid = r.stripe_amount_paid_cents / 100;
  const payout = r.payout_amount == null ? null : Number(r.payout_amount);
  const share = payout == null ? null : Math.round((paid - payout) * 100) / 100;
  const pct = share == null ? null : (share / paid) * 100;
  const beforeActivity = (r.paid_on || "9999") < ACTIVITY_START;
  // Our cut is a service fee plus a plan commission — roughly 22-30% of what
  // the client paid. Anything far outside that band means the stored payout and
  // the Stripe charge disagree about the booking, and a document is the last
  // thing that should happen next. Kim Zenglein's 14-person booking sits at 48%.
  const outlier = pct != null && (pct < 10 || pct > 35);
  const sane =
    share != null && Number.isFinite(share) && share > 0 && share <= paid &&
    !beforeActivity && !outlier;
  plan.push({ ...r, paid, payout, share, pct, sane, beforeActivity, outlier });
}

console.log(`paid bookings inspected: ${plan.length}\n`);
console.log(
  ["booking".padEnd(10), "paid_on".padEnd(11), "client".padEnd(20),
   "paid".padEnd(10), "payout".padEnd(10), "OUR SHARE".padEnd(11), "note"].join(" ")
);
console.log("-".repeat(96));
for (const p of plan) {
  const note = p.invoicexpress_invoice_id
    ? `already invoiced (${p.invoicexpress_state || "?"} #${p.invoicexpress_invoice_id})`
    : p.beforeActivity
    ? `skip — before activity start ${ACTIVITY_START}`
    : p.outlier
    ? `⚠ CHECK BY HAND — our share is ${p.pct.toFixed(0)}% of what the client paid`
    : p.share == null || p.share <= 0
    ? `SKIP — payout ${p.payout == null ? "missing" : eur(p.payout)} vs paid ${eur(p.paid)}`
    : [p.blind_booking ? "blind" : null, p.stripe_promo_code ? `promo ${p.stripe_promo_code}` : null,
       p.stripe_currency && p.stripe_currency.toLowerCase() !== "eur" ? `CURRENCY ${p.stripe_currency}` : null]
        .filter(Boolean).join(" · ") || "ok";
  console.log(
    [String(p.id).slice(0, 8).padEnd(10), (p.paid_on || "?").padEnd(11),
     (p.client_name || "?").slice(0, 19).padEnd(20), eur(p.paid).padEnd(10),
     eur(p.payout).padEnd(10), eur(p.share).padEnd(11), note].join(" ")
  );
}

const issuable = plan.filter((p) => p.sane && !p.invoicexpress_invoice_id);
const totalShare = issuable.reduce((s, p) => s + p.share, 0);
console.log(`\nissuable now: ${issuable.length} · total to invoice: ${eur(totalShare)}`);
console.log(`skipped: ${plan.filter((p) => p.beforeActivity).length} before activity start · ` +
  `${plan.filter((p) => p.outlier).length} outliers needing a human · ` +
  `${plan.filter((p) => p.invoicexpress_invoice_id).length} already invoiced`);

if (!CREATE) {
  console.log(`\nDRY RUN — no API calls made. Re-run with --create-drafts to create DRAFTS (deletable).`);
  await db.end();
  process.exit(0);
}

if (!ACCOUNT || !API_KEY || !SEQUENCE_ID) {
  console.error("InvoiceXpress env missing — refusing.");
  await db.end();
  process.exit(1);
}

console.log(`\nCreating ${issuable.length} DRAFT(s) on series id ${SEQUENCE_ID}…\n`);
let ok = 0;
for (const p of issuable) {
  try {
    // One client record per platform user, keyed on our own id. Tourists have
    // no Portuguese NIF, so the document carries consumidor final.
    let client;
    const code = `PP-${p.client_id.slice(0, 12)}`;
    try {
      client = (await ix("GET", `/clients/find-by-code.json?client_code=${encodeURIComponent(code)}`)).client;
    } catch {
      client = (await ix("POST", "/clients.json", {
        client: {
          name: (p.client_name || "Consumidor Final").slice(0, 100),
          code,
          email: p.client_email || undefined,
          fiscal_id: CONSUMIDOR_FINAL,
        },
      })).client;
    }

    const inv = (await ix("POST", "/invoices.json", {
      invoice: {
        date: p.paid_on,
        due_date: p.paid_on,
        sequence_id: Number(SEQUENCE_ID),
        client: { id: client.id },
        items: [{
          name: "Booking service",
          description: `Photo Portugal booking service — ${p.package_name || "photoshoot"}${p.photographer_name ? ` with ${p.photographer_name.split(" ")[0]}` : ""}`,
          unit_price: p.share,
          quantity: 1,
          tax: { name: EXEMPT_TAX_NAME },
        }],
        tax_exemption: EXEMPTION_REASON,
        observations: `Booking ${p.id}`,
      },
    })).invoice;

    // Written immediately: a draft nobody recorded is a duplicate waiting to
    // happen on the next run.
    await db.query(
      `UPDATE bookings SET invoicexpress_invoice_id = $1, invoicexpress_state = 'draft' WHERE id = $2`,
      [String(inv.id), p.id]
    );
    ok++;
    console.log(`  ✓ ${String(p.id).slice(0, 8)}  draft #${inv.id}  ${eur(p.share)}  ${inv.permalink || ""}`);
  } catch (err) {
    console.error(`  ✗ ${String(p.id).slice(0, 8)} — ${err.message}`);
  }
}
console.log(`\n${ok}/${issuable.length} drafts created. Nothing was finalised.`);
await db.end();
