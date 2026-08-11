import type Stripe from "stripe";
import { query, queryOne } from "@/lib/db";
import { lisbonDay, paymentInstant, ACTIVITY_START, SHARE_PCT_MIN, SHARE_PCT_MAX } from "@/lib/invoicexpress";

/**
 * Gather everything invoiceable from all three streams, WITHOUT issuing.
 *
 * Collect-then-sort exists because a series cannot go backwards in time:
 * InvoiceXpress refuses to finalise a document dated earlier than the last one
 * in the sequence ("Date cannot be earlier than the last invoice of this
 * sequence"), and Portuguese numbering rules are the reason. Issuing each
 * stream in turn — bookings, then subscriptions, then extras — produces exactly
 * that: a 3 August subscription arriving after a 4 August booking, permanently
 * unissuable in that series.
 *
 * So nothing is created until every candidate has a date and the whole set is
 * sorted oldest-first.
 */

export interface Candidate {
  sourceType: "booking" | "subscription" | "extras";
  sourceId: string;
  date: string;            // YYYY-MM-DD, Europe/Lisbon
  amountEur: number;
  clientCode: string;
  clientName: string;
  clientEmail: string | null;
  lineName: string;
  lineDescription: string;
  observations: string;
  photographerId?: string | null;
  clientId?: string | null;
  bookingId?: string | null;
}

export interface Collected {
  candidates: Candidate[];
  held: string[];
  errors: string[];
}

export async function collectAll(stripe: Stripe): Promise<Collected> {
  const out: Collected = { candidates: [], held: [], errors: [] };

  // ── bookings ───────────────────────────────────────────────────────────
  const bookings = await query<{
    id: string; stripe_payment_intent_id: string; payout_amount: string | null;
    client_id: string; client_name: string | null; client_email: string | null;
    package_name: string | null; photographer_name: string | null;
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
      LIMIT 60`
  );

  for (const b of bookings) {
    const short = b.id.slice(0, 8);
    try {
      const pi = await stripe.paymentIntents.retrieve(b.stripe_payment_intent_id, {
        expand: ["latest_charge", "latest_charge.balance_transaction"],
      });
      const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      if (!charge || pi.status !== "succeeded") { out.held.push(`booking ${short}: PI ${pi.status}`); continue; }
      if (charge.captured === false) { out.held.push(`booking ${short}: authorised, not captured`); continue; }

      const date = lisbonDay(paymentInstant(charge));
      const currency = (charge.currency || "eur").toLowerCase();
      const net = Math.round(charge.amount - (charge.amount_refunded || 0)) / 100;
      const payout = b.payout_amount == null ? null : Number(b.payout_amount);
      const share = payout == null ? null : Math.round((net - payout) * 100) / 100;
      const pct = share == null || net <= 0 ? null : (share / net) * 100;

      const hold =
        currency !== "eur" ? `currency ${currency}`
        : date < ACTIVITY_START ? `paid ${date}, pre-activity`
        : net <= 0 ? "fully refunded"
        : payout == null ? "no payout recorded"
        : share == null || share <= 0 ? "payout >= net"
        : (charge.amount_refunded || 0) > 0 ? "refunded — needs a human"
        : pct! < SHARE_PCT_MIN || pct! > SHARE_PCT_MAX ? `share ${pct!.toFixed(0)}% out of band — needs a human`
        : null;
      if (hold) { out.held.push(`booking ${short}: ${hold}`); continue; }

      out.candidates.push({
        sourceType: "booking",
        sourceId: b.id,
        date,
        amountEur: share!,
        clientCode: `PP-${b.client_id.slice(0, 12)}`,
        clientName: b.client_name || "Consumidor Final",
        clientEmail: b.client_email,
        lineName: "Booking service",
        lineDescription: `Photo Portugal booking service — ${b.package_name || "photoshoot"}${b.photographer_name ? ` with ${b.photographer_name.split(" ")[0]}` : ""}`,
        observations: `Booking ${b.id}`,
        clientId: b.client_id,
        bookingId: b.id,
      });
    } catch (err) {
      out.errors.push(`booking ${short}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── photographer add-on subscriptions ──────────────────────────────────
  for await (const inv of stripe.invoices.list({ status: "paid", limit: 100, expand: ["data.subscription"] })) {
    const id = inv.id;
    if (!id) continue;
    const date = lisbonDay(inv.status_transitions?.paid_at || inv.created);
    const amount = (inv.amount_paid || 0) / 100;
    if (date < ACTIVITY_START) { out.held.push(`subscription ${id}: paid ${date}, pre-activity`); continue; }
    if ((inv.currency || "eur").toLowerCase() !== "eur") { out.held.push(`subscription ${id}: currency ${inv.currency}`); continue; }
    if (amount <= 0) { out.held.push(`subscription ${id}: nothing paid`); continue; }

    const existing = await queryOne<{ state: string }>(
      `SELECT state FROM issued_documents WHERE source_type = 'subscription' AND source_id = $1`, [id]
    );
    if (existing) { out.held.push(`subscription ${id}: already ${existing.state}`); continue; }

    const sub = (inv as unknown as { subscription?: { metadata?: Record<string, string> } | string | null }).subscription;
    const type =
      (sub && typeof sub === "object" ? sub.metadata?.type : undefined) ||
      (inv.lines?.data?.[0]?.metadata?.type as string | undefined) || "add-on";
    const label = type === "verified" ? "Verified badge" : type === "featured" ? "Featured placement" : "Add-on";

    const email = inv.customer_email || null;
    const photographer = email
      ? await queryOne<{ id: string; name: string }>(
          `SELECT pp.id, u.name FROM photographer_profiles pp
             JOIN users u ON u.id = pp.user_id WHERE lower(u.email) = lower($1)`, [email]
        )
      : null;

    out.candidates.push({
      sourceType: "subscription",
      sourceId: id,
      date,
      amountEur: amount,
      // Add-ons are deliberately billed without asking for a VAT number, which
      // is what keeps a Spanish or Italian photographer a B2C customer and this
      // whole stream out of VIES.
      clientCode: `PP-PH-${(photographer?.id || email || id).slice(0, 12)}`,
      clientName: photographer?.name || email || "Photographer",
      clientEmail: email,
      lineName: label,
      lineDescription: `Photo Portugal ${label} — billing period from ${date}`,
      observations: `Stripe invoice ${id}`,
      photographerId: photographer?.id || null,
    });
  }

  // ── extra photos ───────────────────────────────────────────────────────
  const orders = await query<{
    order_id: string; booking_id: string; client_id: string;
    client_name: string | null; client_email: string | null;
    platform_fee_eur: string; photos: string; stripe_payment_intent_id: string | null;
  }>(
    `SELECT x.order_id::text AS order_id,
            MIN(x.booking_id::text) AS booking_id,
            MIN(x.client_id::text)  AS client_id,
            MIN(u.name) AS client_name, MIN(u.email) AS client_email,
            (SUM(x.platform_fee_cents) / 100.0)::text AS platform_fee_eur,
            COUNT(*)::text AS photos,
            MIN(x.stripe_payment_intent_id) AS stripe_payment_intent_id
       FROM delivery_extra_purchases x
       JOIN users u ON u.id = x.client_id
      WHERE x.status = 'paid' AND x.amount_cents > 0 AND x.order_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM issued_documents d
                         WHERE d.source_type = 'extras' AND d.source_id = x.order_id::text)
      GROUP BY x.order_id
      LIMIT 40`
  );

  for (const o of orders) {
    const fee = Number(o.platform_fee_eur);
    if (!(fee > 0)) { out.held.push(`extras ${o.order_id}: no platform margin`); continue; }
    if (!o.stripe_payment_intent_id) { out.held.push(`extras ${o.order_id}: no payment intent — cannot date it`); continue; }
    try {
      const pi = await stripe.paymentIntents.retrieve(o.stripe_payment_intent_id, {
        expand: ["latest_charge", "latest_charge.balance_transaction"],
      });
      const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      if (!charge || pi.status !== "succeeded" || charge.captured === false) {
        out.held.push(`extras ${o.order_id}: PI ${pi.status}, not a captured payment`); continue;
      }
      if ((charge.amount_refunded || 0) > 0) { out.held.push(`extras ${o.order_id}: refunded — needs a human`); continue; }
      const date = lisbonDay(paymentInstant(charge));
      if (date < ACTIVITY_START) { out.held.push(`extras ${o.order_id}: paid ${date}, pre-activity`); continue; }

      out.candidates.push({
        sourceType: "extras",
        sourceId: o.order_id,
        date,
        amountEur: Math.round(fee * 100) / 100,
        clientCode: `PP-${o.client_id.slice(0, 12)}`,
        clientName: o.client_name || "Consumidor Final",
        clientEmail: o.client_email,
        lineName: "Booking service — extra photos",
        lineDescription: `Photo Portugal booking service on ${o.photos} extra photo(s)`,
        observations: `Extras order ${o.order_id} · booking ${o.booking_id}`,
        clientId: o.client_id,
        bookingId: o.booking_id,
      });
    } catch (err) {
      out.errors.push(`extras ${o.order_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Oldest first, across every stream. This ordering IS the correctness
  // property — the series can never go backwards.
  out.candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
