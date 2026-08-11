import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import {
  invoicexpressConfigured,
  findOrCreateClient,
  createInvoiceDraft,
  finalizeInvoice,
  lisbonDay,
  paymentInstant,
  ACTIVITY_START,
  SHARE_PCT_MIN,
  SHARE_PCT_MAX,
} from "@/lib/invoicexpress";
import { issueSubscriptionInvoices, issueExtrasInvoices } from "./streams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Issues the platform's own invoices to clients, one per paid booking.
 *
 * A cron rather than a Stripe webhook, deliberately. A webhook fires once: if
 * InvoiceXpress is down or the row is momentarily odd, the document is simply
 * never created and nothing notices. This re-reads outstanding work every time,
 * so a failure is a delay rather than a hole, and the same guard ladder runs
 * on every attempt.
 *
 * Everything irreversible is gated:
 *   INVOICEXPRESS_AUTO_ISSUE=true  — create drafts at all
 *   INVOICEXPRESS_FINALIZE=true    — turn drafts into real fiscal documents
 * With neither set this endpoint reports what it would do and writes nothing.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!invoicexpressConfigured) {
    return NextResponse.json({ skipped: "InvoiceXpress not configured" });
  }

  const autoIssue = process.env.INVOICEXPRESS_AUTO_ISSUE === "true";
  const finalize = process.env.INVOICEXPRESS_FINALIZE === "true";
  const stripe = requireStripe();

  const candidates = await query<{
    id: string;
    stripe_payment_intent_id: string;
    payout_amount: string | null;
    client_id: string;
    client_name: string | null;
    client_email: string | null;
    package_name: string | null;
    photographer_name: string | null;
  }>(
    `SELECT b.id, b.stripe_payment_intent_id, b.payout_amount,
            cu.id::text AS client_id, cu.name AS client_name, cu.email AS client_email,
            p.name AS package_name, pu.name AS photographer_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
       LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
       LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE b.payment_status = 'paid'
        AND b.stripe_payment_intent_id IS NOT NULL
        AND b.invoicexpress_invoice_id IS NULL
        AND (b.invoicexpress_state IS NULL OR b.invoicexpress_state = 'error')
      ORDER BY b.created_at DESC
      LIMIT 40`
  );

  const result = { considered: candidates.length, issued: 0, finalized: 0, held: [] as string[], errors: [] as string[] };

  for (const b of candidates) {
    const short = b.id.slice(0, 8);
    try {
      const pi = await stripe.paymentIntents.retrieve(b.stripe_payment_intent_id, {
        expand: ["latest_charge", "latest_charge.balance_transaction"],
      });
      const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      if (!charge || pi.status !== "succeeded") { result.held.push(`${short}: PI ${pi.status}`); continue; }
      // An authorised hold is not a payment — blind bookings sit here for days.
      if (charge.captured === false) { result.held.push(`${short}: authorised, not captured`); continue; }

      const paidOn = lisbonDay(paymentInstant(charge));
      const currency = (charge.currency || "eur").toLowerCase();
      const net = Math.round((charge.amount - (charge.amount_refunded || 0))) / 100;
      const payout = b.payout_amount == null ? null : Number(b.payout_amount);
      const share = payout == null ? null : Math.round((net - payout) * 100) / 100;
      const pct = share == null || net <= 0 ? null : (share / net) * 100;

      const hold =
        currency !== "eur" ? `currency ${currency}`
        : paidOn < ACTIVITY_START ? `paid ${paidOn}, pre-activity`
        : net <= 0 ? "fully refunded"
        : payout == null ? "no payout recorded"
        : share == null || share <= 0 ? "payout >= net"
        : (charge.amount_refunded || 0) > 0 ? "refunded — needs a human"
        : pct! < SHARE_PCT_MIN || pct! > SHARE_PCT_MAX ? `share ${pct!.toFixed(0)}% out of band — needs a human`
        : null;
      if (hold) { result.held.push(`${short}: ${hold}`); continue; }

      if (!autoIssue) { result.held.push(`${short}: would issue ${share} (AUTO_ISSUE off)`); continue; }

      // Claim before the document exists: a crash between the API call and the
      // write would otherwise orphan a draft that the next run duplicates.
      const claimed = await queryOne<{ id: string }>(
        `UPDATE bookings SET invoicexpress_state = 'claiming'
          WHERE id = $1 AND invoicexpress_invoice_id IS NULL
            AND (invoicexpress_state IS NULL OR invoicexpress_state = 'error')
          RETURNING id`,
        [b.id]
      );
      if (!claimed) { result.held.push(`${short}: claimed elsewhere`); continue; }

      const client = await findOrCreateClient({
        code: `PP-${b.client_id.slice(0, 12)}`,
        name: b.client_name || "Consumidor Final",
        email: b.client_email,
      });
      const inv = await createInvoiceDraft({
        clientId: client.id,
        date: paidOn,
        lines: [{
          name: "Booking service",
          description: `Photo Portugal booking service — ${b.package_name || "photoshoot"}${b.photographer_name ? ` with ${b.photographer_name.split(" ")[0]}` : ""}`,
          unit_price: share!,
          quantity: 1,
        }],
        observations: `Booking ${b.id}`,
      });

      try {
        await queryOne(
          `UPDATE bookings SET invoicexpress_invoice_id = $1, invoicexpress_state = 'draft',
                  invoicexpress_issued_at = NOW()
            WHERE id = $2 RETURNING id`,
          [String(inv.id), b.id]
        );
      } catch (writeErr) {
        // The document exists and we could not record it. The id has to reach a
        // human or the orphan is unfindable; the row stays 'claiming' so no
        // later run touches it.
        result.errors.push(`ORPHAN DRAFT #${inv.id} for booking ${b.id} — could not record: ${writeErr}`);
        throw writeErr;
      }
      result.issued++;

      if (finalize) {
        const final = await finalizeInvoice(inv.id);
        await queryOne(
          `UPDATE bookings SET invoicexpress_state = 'final' WHERE id = $1 RETURNING id`,
          [b.id]
        );
        result.finalized++;
        void final;
      }
    } catch (err) {
      result.errors.push(`${short}: ${err instanceof Error ? err.message : String(err)}`);
      await queryOne(
        `UPDATE bookings SET invoicexpress_state = 'error'
          WHERE id = $1 AND invoicexpress_invoice_id IS NULL AND invoicexpress_state = 'claiming'
          RETURNING id`,
        [b.id]
      ).catch(() => {});
    }
  }

  // The two streams that are not bookings: photographer add-on subscriptions
  // and extra-photo purchases. Same guards, own table.
  const subscriptions = await issueSubscriptionInvoices(stripe, autoIssue);
  const extras = await issueExtrasInvoices(stripe, autoIssue);
  result.errors.push(...subscriptions.errors, ...extras.errors);

  // Anything the ladder refuses is a thing a person has to look at, so it must
  // not be findable only by reading a cron log nobody opens.
  if (result.errors.length > 0) {
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      await sendTelegram(
        `🧾 <b>InvoiceXpress cron: ${result.errors.length} error(s)</b>\n\n${result.errors.slice(0, 5).join("\n")}`
      );
    } catch {}
  }

  return NextResponse.json({ bookings: result, subscriptions, extras });
}
