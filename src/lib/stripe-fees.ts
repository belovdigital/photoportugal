import type Stripe from "stripe";
import { query, queryOne } from "@/lib/db";

/**
 * Stripe's own cut, recorded per payment so revenue can be reported net of it.
 *
 * Two things shape this file.
 *
 * The fee lives on the charge's balance transaction, not on the PaymentIntent,
 * and a balance transaction only exists once the money is captured. That gap is
 * why there is a sweep and not just a write in the webhook: a blind booking is
 * authorised on Monday and captured on Thursday, and no fee exists in between.
 *
 * And one payment does not mean one row. A basket of six extra photos is six
 * rows in delivery_extra_purchases sharing a single PaymentIntent and a single
 * fee. Writing that fee to each row would sextuple it, so the fee goes on one
 * anchor row per payment and every sibling gets an explicit 0 — not NULL, which
 * would invite the next sweep to fill them in again.
 */

interface Sweepable {
  table: "bookings" | "delivery_extra_purchases" | "tips";
  where: string;
}

/** Everything here is money that has been taken, or is about to be. */
const SWEEPABLE: Sweepable[] = [
  { table: "bookings", where: "payment_status = 'paid'" },
  { table: "delivery_extra_purchases", where: "status = 'paid' AND amount_cents > 0" },
  { table: "tips", where: "status = 'paid' AND amount_cents > 0" },
];

let cachedColumns: boolean | null = null;

/**
 * Migration 012 may not have run on a given market yet, and no screen should
 * 500 because of it.
 */
export async function stripeFeeColumnExists(): Promise<boolean> {
  if (cachedColumns !== null) return cachedColumns;
  try {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND column_name = 'stripe_fee_cents'
          AND table_name IN ('bookings', 'delivery_extra_purchases', 'tips')`
    );
    cachedColumns = Number(row?.count || 0) === 3;
  } catch {
    cachedColumns = false;
  }
  return cachedColumns;
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

/**
 * Put the fee on one row of a payment and zero on its siblings, so summing the
 * column over the whole table gives what Stripe actually took.
 *
 * The WHERE on `stripe_fee_cents IS NULL` makes this idempotent: a second run
 * matches nothing.
 */
async function writeFeeForPayment(
  spec: Sweepable,
  paymentIntentId: string,
  feeCents: number
): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE ${spec.table} t
        SET stripe_fee_cents = CASE WHEN t.id = anchor.id THEN $1::int ELSE 0 END
       FROM (SELECT id FROM ${spec.table}
              WHERE stripe_payment_intent_id = $2 AND ${spec.where}
              ORDER BY created_at ASC, id ASC
              LIMIT 1) anchor
      WHERE t.stripe_payment_intent_id = $2
        AND ${spec.where}
        AND t.stripe_fee_cents IS NULL
      RETURNING t.id`,
    [feeCents, paymentIntentId]
  );
  return rows.length;
}

export interface SweepResult {
  filled: number;
  rowsTouched: number;
  pending: number;
  errors: string[];
}

/**
 * Fill in every fee not yet known.
 *
 * Idempotent and interruptible: it only looks at payments with at least one
 * NULL row, so a crash halfway costs a re-read, not a double-count.
 */
export async function sweepStripeFees(
  stripe: Stripe,
  limitPerTable = 200
): Promise<SweepResult> {
  const out: SweepResult = { filled: 0, rowsTouched: 0, pending: 0, errors: [] };
  if (!(await stripeFeeColumnExists())) {
    out.errors.push("stripe_fee_cents columns missing — migration 012 has not run");
    return out;
  }

  for (const spec of SWEEPABLE) {
    let payments: { pi: string }[];
    try {
      // One row per PaymentIntent, not per row: a six-photo basket is one fee.
      payments = await query<{ pi: string }>(
        `SELECT stripe_payment_intent_id AS pi
           FROM ${spec.table}
          WHERE ${spec.where}
            AND stripe_payment_intent_id IS NOT NULL
            AND stripe_fee_cents IS NULL
          GROUP BY stripe_payment_intent_id
          ORDER BY MAX(created_at) DESC
          LIMIT ${Number(limitPerTable)}`
      );
    } catch (err) {
      out.errors.push(`${spec.table}: ${err instanceof Error ? err.message : String(err)}`);
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
        const touched = await writeFeeForPayment(spec, pi, fee);
        if (touched > 0) {
          out.filled++;
          out.rowsTouched += touched;
        }
      } catch (err) {
        out.errors.push(`${spec.table} ${pi.slice(0, 14)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return out;
}

/**
 * Best-effort write straight after a payment succeeds, so the ordinary case is
 * right within seconds rather than waiting for the nightly sweep.
 *
 * Deliberately does not ask what kind of payment this is. Every table is
 * offered the PaymentIntent and only the one that owns it matches — which is
 * both shorter than a dispatch on metadata and immune to it, and the metadata
 * here has been wrong before (a tip carrying booking_id once overwrote three
 * bookings' payment intents).
 *
 * Never throws. A missing fee is caught by the sweep, and nothing about a
 * client's payment should fail because a reporting number is late.
 */
export async function recordStripeFee(stripe: Stripe, paymentIntentId: string): Promise<void> {
  try {
    if (!(await stripeFeeColumnExists())) return;
    const fee = await feeForPaymentIntent(stripe, paymentIntentId);
    if (fee === null) return;
    for (const spec of SWEEPABLE) {
      await writeFeeForPayment(spec, paymentIntentId, fee).catch((err) =>
        console.error(`[stripe-fees] ${spec.table} write failed for ${paymentIntentId}:`, err)
      );
    }
  } catch (err) {
    console.error(`[stripe-fees] could not record fee for ${paymentIntentId}:`, err);
  }
}
