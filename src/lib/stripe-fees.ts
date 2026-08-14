import type Stripe from "stripe";
import { query, queryOne } from "@/lib/db";

/**
 * Stripe's own cut, recorded per payment so revenue can be reported net of it.
 *
 * Three things shape this file.
 *
 * The fee lives on the charge's balance transaction, not on the PaymentIntent,
 * and a balance transaction only exists once the money is captured. That gap is
 * why there is a sweep and not just a write in the webhook: a blind booking is
 * authorised on Monday and captured on Thursday, and no fee exists in between.
 *
 * The fee is keyed by PaymentIntent in its own table, never as a column on
 * bookings. Writing a column there means UPDATE bookings, which fires the
 * BEFORE UPDATE trigger that rewrites updated_at — the timestamp the 14-day
 * auto-accept, the 21-day auto-refund and the client's delivery countdown all
 * key off. The first version of this file moved 65 of those clocks in one
 * backfill before it was caught.
 *
 * And one payment is not one row: a basket of six extra photos is six rows
 * sharing a single PaymentIntent and a single fee. Keyed by payment, that stops
 * being a problem the code has to remember — the primary key enforces it.
 */

/** Tables that hold a payment we want the fee for. Read-only, all of them. */
const PAYMENT_SOURCES = [
  { table: "bookings", where: "payment_status = 'paid'" },
  { table: "delivery_extra_purchases", where: "status = 'paid' AND amount_cents > 0" },
  { table: "tips", where: "status = 'paid' AND amount_cents > 0" },
] as const;

/**
 * Migration 013 may not have run on a given market yet, and no screen should
 * 500 because of it.
 *
 * Re-checked rather than cached forever: a process that started before the
 * migration would otherwise refuse to record fees until someone restarted it,
 * and nobody would know to.
 */
let tableSeenAt = 0;
let tableExists = false;
export async function stripeFeeTableExists(): Promise<boolean> {
  if (tableExists) return true;
  if (Date.now() - tableSeenAt < 60_000) return false;
  tableSeenAt = Date.now();
  try {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'stripe_payment_fees'`
    );
    tableExists = Number(row?.count || 0) === 1;
  } catch {
    tableExists = false;
  }
  return tableExists;
}

/**
 * The fee Stripe took for one payment, in cents, or null if there is nothing to
 * read yet — an uncaptured authorisation, a failed payment, a missing charge.
 *
 * Null and zero mean different things and must not be collapsed: null is "ask
 * again later", zero is "this genuinely cost nothing".
 */
export async function feeForPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string
): Promise<number | null> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (!charge || !charge.captured) return null;

  const bt = charge.balance_transaction;
  if (!bt || typeof bt !== "object") return null;

  // `fee` is denominated in the settlement currency, which is what the balance
  // is actually debited in — the right number whatever the client paid in.
  return typeof bt.fee === "number" ? bt.fee : null;
}

async function storeFee(paymentIntentId: string, feeCents: number): Promise<void> {
  await queryOne(
    `INSERT INTO stripe_payment_fees (payment_intent_id, fee_cents)
     VALUES ($1, $2)
     ON CONFLICT (payment_intent_id) DO NOTHING
     RETURNING payment_intent_id`,
    [paymentIntentId, feeCents]
  );
}

export interface SweepResult {
  filled: number;
  pending: number;
  errors: string[];
}

/**
 * Fetch the fee for every captured payment we do not have one for yet.
 *
 * Touches only stripe_payment_fees, so it cannot disturb a booking's state,
 * its timestamps or any clock keyed off them. Idempotent: it looks for
 * payments with no fee row, so a crash halfway costs a re-read.
 */
export async function sweepStripeFees(
  stripe: Stripe,
  limitPerTable = 200
): Promise<SweepResult> {
  const out: SweepResult = { filled: 0, pending: 0, errors: [] };
  if (!(await stripeFeeTableExists())) {
    out.errors.push("stripe_payment_fees missing — migration 013 has not run");
    return out;
  }

  for (const { table, where } of PAYMENT_SOURCES) {
    let payments: { pi: string }[];
    try {
      payments = await query<{ pi: string }>(
        `SELECT DISTINCT t.stripe_payment_intent_id AS pi
           FROM ${table} t
          WHERE ${where}
            AND t.stripe_payment_intent_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM stripe_payment_fees f
               WHERE f.payment_intent_id = t.stripe_payment_intent_id
            )
          LIMIT ${Number(limitPerTable)}`
      );
    } catch (err) {
      out.errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    for (const { pi } of payments) {
      try {
        const fee = await feeForPaymentIntent(stripe, pi);
        if (fee === null) {
          // Authorised but not captured, most likely. Nothing is wrong — the
          // fee does not exist yet.
          out.pending++;
          continue;
        }
        await storeFee(pi, fee);
        out.filled++;
      } catch (err) {
        out.errors.push(`${table} ${pi.slice(0, 14)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return out;
}

/**
 * Best-effort write straight after a payment succeeds, so the ordinary case is
 * right within seconds rather than waiting for the nightly sweep.
 *
 * Never throws. A missing fee is caught by the sweep, and nothing about a
 * client's payment should fail because a reporting number is late.
 */
export async function recordStripeFee(stripe: Stripe, paymentIntentId: string): Promise<void> {
  try {
    if (!(await stripeFeeTableExists())) return;
    const fee = await feeForPaymentIntent(stripe, paymentIntentId);
    if (fee === null) return;
    await storeFee(paymentIntentId, fee);
  } catch (err) {
    console.error(`[stripe-fees] could not record fee for ${paymentIntentId}:`, err);
  }
}
