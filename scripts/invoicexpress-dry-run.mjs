/**
 * What the platform would invoice each client — and, on demand, the drafts.
 *
 *   node scripts/invoicexpress-dry-run.mjs                  # table only, no writes
 *   node scripts/invoicexpress-dry-run.mjs --create-drafts  # creates DRAFTS (deletable)
 *   node scripts/invoicexpress-dry-run.mjs --create-drafts --limit 2
 *
 * Runs on the prod box (needs .env for DB, Stripe and InvoiceXpress). It never
 * finalises: a finalised document cannot be deleted, only credited.
 *
 * ── Where the numbers come from ──────────────────────────────────────────
 * STRIPE, not our columns. Learned the hard way on 2026-08-11, when a first
 * pass took the date from `COALESCE(confirmed_at, updated_at)` — confirmed_at
 * was NULL, so it silently used "when the row was last touched" and dated a
 * June payment to August, sailing straight past the activity-start filter. The
 * same pass read `stripe_amount_paid_cents`, which is the original charge and
 * ignores refunds; one booking had €316.25 refunded and would have been
 * invoiced for money the client no longer had.
 *
 * So: the DB selects CANDIDATES, Stripe decides the DATE and the AMOUNT.
 *   date   = the charge's creation date
 *   net    = charge.amount − charge.amount_refunded
 *   share  = net − the photographer's payout
 */
import { readFileSync } from "fs";
import pg from "pg";
import Stripe from "stripe";

const APP_DIR = "/var/www/photoportugal";
const CREATE = process.argv.includes("--create-drafts");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? parseInt(process.argv[i + 1], 10) : 50;
})();

/** Kate's início de atividade. Nothing before this date can be invoiced: the
 *  activity did not exist when the money moved. */
const ACTIVITY_START = "2026-08-01";
/** Our cut is a service fee plus a plan commission. Outside this band the
 *  stored payout and the Stripe charge disagree, and the answer is a human,
 *  not a document. */
const SHARE_PCT_MIN = 10;
const SHARE_PCT_MAX = 35;

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

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" });

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
/**
 * The Portuguese calendar day, not the UTC one. toISOString() is UTC by
 * definition, and Lisbon runs UTC+1 from late March to late October — so every
 * payment between 00:00 and 00:59 local was being dated to the previous day,
 * which both mis-dates the document and can push a genuine first-of-August
 * payment behind the activity-start cutoff.
 */
const day = (unix) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(unix * 1000));

/**
 * When the money actually moved.
 *
 * charge.created is the AUTHORISATION. Blind bookings are authorised at
 * checkout and captured days later when an admin assigns the photographer
 * (capture_method: "manual"), so for those the two differ by up to six days.
 * The balance transaction is created at capture, which is the moment that
 * dates the document.
 */
function paymentInstant(charge) {
  const bt = charge.balance_transaction;
  if (bt && typeof bt === "object" && bt.created) return bt.created;
  return charge.created;
}

const { Client } = pg;
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(`
  SELECT b.id,
         b.stripe_payment_intent_id,
         b.payout_amount, b.blind_booking,
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
     AND b.stripe_payment_intent_id IS NOT NULL
     -- Only outstanding work. Without this, already-issued bookings consume
     -- the window and anything deferred once (refunded, flagged, Stripe
     -- timeout) drops out of view permanently as newer bookings arrive.
     AND b.invoicexpress_invoice_id IS NULL
     AND (b.invoicexpress_state IS NULL OR b.invoicexpress_state = 'error')
   ORDER BY b.created_at DESC
   LIMIT $1`, [LIMIT]);

if (rows.length === LIMIT) {
  console.log(`⚠ hit the --limit of ${LIMIT}: there is more outstanding work than shown. Re-run with a larger --limit.\n`);
}

console.log(`candidates from DB: ${rows.length} — resolving each against Stripe…\n`);

const plan = [];
for (const r of rows) {
  const row = { ...r, payout: r.payout_amount == null ? null : Number(r.payout_amount) };
  try {
    const pi = await stripe.paymentIntents.retrieve(r.stripe_payment_intent_id, {
      expand: ["latest_charge", "latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    if (!charge || pi.status !== "succeeded") {
      plan.push({ ...row, skip: `not a succeeded charge (PI ${pi.status})` });
      continue;
    }
    // An authorised-but-uncaptured hold is not a payment. Blind bookings sit
    // here for days before an admin assigns the photographer.
    if (charge.captured === false) {
      plan.push({ ...row, skip: `authorised but not captured — no money has moved yet` });
      continue;
    }
    row.paidOn = day(paymentInstant(charge));
    row.currency = (charge.currency || "eur").toLowerCase();
    row.gross = charge.amount / 100;
    row.refunded = (charge.amount_refunded || 0) / 100;
    row.net = Math.round((row.gross - row.refunded) * 100) / 100;
    row.share = row.payout == null ? null : Math.round((row.net - row.payout) * 100) / 100;
    row.pct = row.share == null || row.net <= 0 ? null : (row.share / row.net) * 100;

    row.skip =
      row.currency !== "eur" ? `CURRENCY ${row.currency.toUpperCase()} — not handled`
      : row.paidOn < ACTIVITY_START ? `paid ${row.paidOn}, before activity start ${ACTIVITY_START}`
      : row.net <= 0 ? `fully refunded (${eur(row.refunded)} of ${eur(row.gross)})`
      : row.payout == null ? `no payout recorded`
      : row.share == null || row.share <= 0 ? `payout ${eur(row.payout)} ≥ net ${eur(row.net)}`
      : row.refunded > 0 ? `⚠ REFUNDED ${eur(row.refunded)} — confirm the document story by hand`
      : row.pct < SHARE_PCT_MIN || row.pct > SHARE_PCT_MAX ? `⚠ CHECK BY HAND — our share is ${row.pct.toFixed(0)}% of net`
      : null;
  } catch (err) {
    row.skip = `Stripe error: ${err.message.slice(0, 80)}`;
  }
  plan.push(row);
}

console.log(
  ["booking".padEnd(10), "paid_on".padEnd(11), "client".padEnd(19),
   "net".padEnd(10), "payout".padEnd(10), "OUR SHARE".padEnd(11), "note"].join(" ")
);
console.log("-".repeat(104));
for (const p of plan) {
  console.log(
    [String(p.id).slice(0, 8).padEnd(10), (p.paidOn || "?").padEnd(11),
     (p.client_name || "?").slice(0, 18).padEnd(19), eur(p.net).padEnd(10),
     eur(p.payout).padEnd(10), eur(p.share).padEnd(11),
     p.skip || (p.blind_booking ? "ok · blind" : "ok")].join(" ")
  );
}

const issuable = plan.filter((p) => !p.skip);
const total = issuable.reduce((s, p) => s + p.share, 0);
console.log(`\nissuable now: ${issuable.length} · total to invoice: ${eur(total)}`);
console.log(`held back: ${plan.length - issuable.length} — ` +
  `${plan.filter((p) => (p.skip || "").includes("before activity")).length} pre-activity · ` +
  `${plan.filter((p) => (p.skip || "").includes("REFUNDED")).length} refunded · ` +
  `${plan.filter((p) => (p.skip || "").includes("CHECK BY HAND")).length} outliers · ` +
  `${plan.filter((p) => (p.skip || "").includes("already invoiced")).length} done`);

if (!CREATE) {
  console.log(`\nDRY RUN — nothing written to InvoiceXpress or the database.`);
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
    // Claim the booking BEFORE the document exists. Two runs racing, or a
    // crash between the POST and the write, otherwise leaves an orphan draft
    // that the next run cheerfully duplicates — and the unique index does not
    // help, because it constrains one InvoiceXpress id across bookings (always
    // true) rather than one document per booking.
    const claim = await db.query(
      `UPDATE bookings SET invoicexpress_state = 'claiming'
        WHERE id = $1 AND invoicexpress_invoice_id IS NULL
          AND (invoicexpress_state IS NULL OR invoicexpress_state = 'error')
        RETURNING id`,
      [p.id]
    );
    if (claim.rowCount === 0) {
      console.log(`  · ${String(p.id).slice(0, 8)}  skipped — claimed by another run`);
      continue;
    }

    // One client record per platform user, keyed on our own id. Tourists carry
    // consumidor final; their name is still on the document.
    const code = `PP-${p.client_id.slice(0, 12)}`;
    let client;
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
        date: p.paidOn,      // the day the client actually paid, per Stripe
        due_date: p.paidOn,
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

    try {
      await db.query(
        `UPDATE bookings SET invoicexpress_invoice_id = $1, invoicexpress_state = 'draft' WHERE id = $2`,
        [String(inv.id), p.id]
      );
    } catch (writeErr) {
      // The document exists and we could not record it. Shout the id — this is
      // the only place it is ever printed, and without it the orphan cannot be
      // found and deleted. The row stays 'claiming', so no re-run touches it.
      console.error(
        `\n  !! ORPHAN DRAFT — booking ${p.id} has InvoiceXpress draft #${inv.id} (${eur(p.share)}) ` +
        `that could not be recorded: ${writeErr.message}\n` +
        `     DELETE IT in InvoiceXpress, or set invoicexpress_invoice_id='${inv.id}' on that booking by hand.\n`
      );
      throw writeErr;
    }
    ok++;
    console.log(`  ✓ ${String(p.id).slice(0, 8)}  draft #${inv.id}  ${eur(p.share)}  ${p.paidOn}  ${inv.permalink || ""}`);
  } catch (err) {
    console.error(`  ✗ ${String(p.id).slice(0, 8)} — ${err.message}`);
    // Release the claim so a later run can retry — unless the DB is the thing
    // that broke, in which case 'claiming' correctly blocks a blind retry.
    await db.query(
      `UPDATE bookings SET invoicexpress_state = 'error'
        WHERE id = $1 AND invoicexpress_invoice_id IS NULL AND invoicexpress_state = 'claiming'`,
      [p.id]
    ).catch(() => {});
  }
}
console.log(`\n${ok}/${issuable.length} drafts created. Nothing was finalised.`);
await db.end();
