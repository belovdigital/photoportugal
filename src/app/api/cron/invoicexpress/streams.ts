import type Stripe from "stripe";
import { query, queryOne } from "@/lib/db";
import {
  findOrCreateClient,
  createInvoiceDraft,
  finalizeInvoice,
  lisbonDay,
  ACTIVITY_START,
} from "@/lib/invoicexpress";

/**
 * The two revenue streams that are not bookings.
 *
 * Both are charges the platform makes in its own name, so both need a document
 * from Kate's ENI — and both land in `issued_documents`, whose unique key is
 * (source_type, source_id). That constraint is the real one-per-source
 * guarantee: the row is written BEFORE the document exists, so a crash between
 * the claim and the API call blocks a duplicate rather than inviting one.
 *
 * Neither writes anything unless INVOICEXPRESS_AUTO_ISSUE is "true", and
 * neither finalises unless INVOICEXPRESS_FINALIZE is "true" as well.
 */

export interface StreamResult {
  considered: number;
  issued: number;
  finalized: number;
  held: string[];
  errors: string[];
}

const empty = (): StreamResult => ({ considered: 0, issued: 0, finalized: 0, held: [], errors: [] });

/**
 * Claim a source, create the draft, record the id, optionally finalise.
 *
 * Shared by both streams so the crash-safety story is written once. The claim
 * INSERT is the lock: a second run hits the unique index and is turned away
 * before it can call InvoiceXpress.
 */
async function issueOne(opts: {
  sourceType: string;
  sourceId: string;
  amountEur: number;
  date: string;
  clientCode: string;
  clientName: string;
  clientEmail?: string | null;
  lineName: string;
  lineDescription: string;
  observations: string;
  photographerId?: string | null;
  clientId?: string | null;
  result: StreamResult;
}) {
  const { result } = opts;
  const claimed = await queryOne<{ id: string }>(
    `INSERT INTO issued_documents
       (source_type, source_id, photographer_id, client_id, amount_eur, document_date, state)
     VALUES ($1, $2, $3, $4, $5, $6, 'claiming')
     ON CONFLICT (source_type, source_id) DO NOTHING
     RETURNING id`,
    [opts.sourceType, opts.sourceId, opts.photographerId || null, opts.clientId || null, opts.amountEur, opts.date]
  );
  if (!claimed) {
    result.held.push(`${opts.sourceId}: already claimed`);
    return;
  }

  try {
    const client = await findOrCreateClient({
      code: opts.clientCode,
      name: opts.clientName,
      email: opts.clientEmail,
    });
    const inv = await createInvoiceDraft({
      clientId: client.id,
      date: opts.date,
      lines: [{ name: opts.lineName, description: opts.lineDescription, unit_price: opts.amountEur, quantity: 1 }],
      observations: opts.observations,
    });

    try {
      await queryOne(
        `UPDATE issued_documents
            SET invoicexpress_invoice_id = $1, state = 'draft', issued_at = NOW()
          WHERE id = $2 RETURNING id`,
        [String(inv.id), claimed.id]
      );
    } catch (writeErr) {
      // The document exists and we could not record it. The id must reach a
      // human or the orphan is unfindable; the row stays 'claiming' so nothing
      // re-issues it.
      result.errors.push(`ORPHAN DRAFT #${inv.id} for ${opts.sourceType} ${opts.sourceId}: ${writeErr}`);
      throw writeErr;
    }
    result.issued++;

    if (process.env.INVOICEXPRESS_FINALIZE === "true") {
      await finalizeInvoice(inv.id);
      await queryOne(`UPDATE issued_documents SET state = 'final' WHERE id = $1 RETURNING id`, [claimed.id]);
      result.finalized++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`${opts.sourceType} ${opts.sourceId}: ${msg}`);
    // Only release a claim that never produced a document. If the id was
    // written, the row is 'draft' and this no-ops.
    await queryOne(
      `UPDATE issued_documents SET state = 'error', error = $2
        WHERE id = $1 AND invoicexpress_invoice_id IS NULL RETURNING id`,
      [claimed.id, msg.slice(0, 500)]
    ).catch(() => {});
  }
}

/**
 * Photographer add-ons: Featured (€19/month) and Verified (€19/year).
 *
 * The source of truth is the paid Stripe invoice, one per billing cycle — not
 * the is_featured / is_verified flags, which say "on" but not "paid when, how
 * much, how many times". Every cycle is a separate charge and a separate
 * document.
 *
 * These are the platform invoicing a PHOTOGRAPHER, the one document stream the
 * 2026-08-10 announcement said did not exist. It does; the announcement was
 * about commission, and this is a separate service they chose to buy.
 */
export async function issueSubscriptionInvoices(
  stripe: Stripe,
  autoIssue: boolean
): Promise<StreamResult> {
  const result = empty();

  for await (const inv of stripe.invoices.list({ status: "paid", limit: 100, expand: ["data.subscription"] })) {
    result.considered++;
    const id = inv.id;
    if (!id) continue;

    const paidAt = inv.status_transitions?.paid_at || inv.created;
    const date = lisbonDay(paidAt);
    const amount = (inv.amount_paid || 0) / 100;
    // `subscription` left the typed Invoice surface in the pinned SDK version,
    // but the expanded object is still on the wire — read it off a narrowed
    // shape rather than pretending it is not there.
    const sub = (inv as unknown as { subscription?: { metadata?: Record<string, string> } | string | null }).subscription;
    const type =
      (sub && typeof sub === "object" ? sub.metadata?.type : undefined) ||
      (inv.lines?.data?.[0]?.metadata?.type as string | undefined) ||
      "add-on";

    if (date < ACTIVITY_START) { result.held.push(`${id}: paid ${date}, pre-activity`); continue; }
    if ((inv.currency || "eur").toLowerCase() !== "eur") { result.held.push(`${id}: currency ${inv.currency}`); continue; }
    if (amount <= 0) { result.held.push(`${id}: nothing paid`); continue; }

    const existing = await queryOne<{ state: string }>(
      `SELECT state FROM issued_documents WHERE source_type = 'subscription' AND source_id = $1`,
      [id]
    );
    if (existing) { result.held.push(`${id}: already ${existing.state}`); continue; }

    const email = inv.customer_email || null;
    const photographer = email
      ? await queryOne<{ id: string; name: string }>(
          `SELECT pp.id, u.name FROM photographer_profiles pp
             JOIN users u ON u.id = pp.user_id WHERE lower(u.email) = lower($1)`,
          [email]
        )
      : null;

    if (!autoIssue) { result.held.push(`${id}: would issue ${amount} to ${email} (AUTO_ISSUE off)`); continue; }

    const label = type === "verified" ? "Verified badge" : type === "featured" ? "Featured placement" : "Add-on";
    await issueOne({
      sourceType: "subscription",
      sourceId: id,
      amountEur: amount,
      date,
      // Photographers are billed as themselves. We deliberately do not collect
      // a VAT number for add-ons (see the cross-border note in the invoicing
      // memory), so the document carries consumidor final.
      clientCode: `PP-PH-${(photographer?.id || email || id).slice(0, 12)}`,
      clientName: photographer?.name || email || "Photographer",
      clientEmail: email,
      lineName: label,
      lineDescription: `Photo Portugal ${label} — billing period from ${date}`,
      observations: `Stripe invoice ${id}`,
      photographerId: photographer?.id || null,
      result,
    });
  }
  return result;
}

/**
 * Extra photos bought from a delivery gallery.
 *
 * Grouped by `order_id`: one checkout is one Stripe payment and therefore one
 * document, however many frames it contained. Billing per row would put five
 * documents on one payment and burn through the InvoiceXpress plan for nothing.
 *
 * The photographer's cut of an extras sale is theirs to invoice, exactly like a
 * session; ours is `platform_fee_cents`.
 */
export async function issueExtrasInvoices(
  stripe: Stripe,
  autoIssue: boolean
): Promise<StreamResult> {
  const result = empty();

  const orders = await query<{
    order_id: string;
    booking_id: string;
    client_id: string;
    client_name: string | null;
    client_email: string | null;
    platform_fee_eur: string;
    photos: string;
    stripe_payment_intent_id: string | null;
  }>(
    `SELECT x.order_id,
            MIN(x.booking_id::text) AS booking_id,
            MIN(x.client_id::text)  AS client_id,
            MIN(u.name)             AS client_name,
            MIN(u.email)            AS client_email,
            (SUM(x.platform_fee_cents) / 100.0)::text AS platform_fee_eur,
            COUNT(*)::text AS photos,
            MIN(x.stripe_payment_intent_id) AS stripe_payment_intent_id
       FROM delivery_extra_purchases x
       JOIN users u ON u.id = x.client_id
      WHERE x.status = 'paid'
        AND x.amount_cents > 0
        AND x.order_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM issued_documents d
           WHERE d.source_type = 'extras' AND d.source_id = x.order_id::text
        )
      GROUP BY x.order_id
      LIMIT 40`
  );

  for (const o of orders) {
    result.considered++;
    const fee = Number(o.platform_fee_eur);
    if (!(fee > 0)) { result.held.push(`${o.order_id}: no platform margin`); continue; }
    if (!o.stripe_payment_intent_id) { result.held.push(`${o.order_id}: no payment intent — cannot date it`); continue; }

    let date: string;
    try {
      const pi = await stripe.paymentIntents.retrieve(o.stripe_payment_intent_id, {
        expand: ["latest_charge", "latest_charge.balance_transaction"],
      });
      const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      if (!charge || pi.status !== "succeeded" || charge.captured === false) {
        result.held.push(`${o.order_id}: PI ${pi.status}, not a captured payment`);
        continue;
      }
      if ((charge.amount_refunded || 0) > 0) {
        result.held.push(`${o.order_id}: refunded — needs a human`);
        continue;
      }
      const bt = charge.balance_transaction;
      const instant = bt && typeof bt === "object" && "created" in bt ? (bt as { created: number }).created : charge.created;
      date = lisbonDay(instant);
    } catch (err) {
      result.errors.push(`${o.order_id}: Stripe ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (date < ACTIVITY_START) { result.held.push(`${o.order_id}: paid ${date}, pre-activity`); continue; }
    if (!autoIssue) { result.held.push(`${o.order_id}: would issue ${fee} (AUTO_ISSUE off)`); continue; }

    await issueOne({
      sourceType: "extras",
      sourceId: o.order_id,
      amountEur: Math.round(fee * 100) / 100,
      date,
      clientCode: `PP-${o.client_id.slice(0, 12)}`,
      clientName: o.client_name || "Consumidor Final",
      clientEmail: o.client_email,
      lineName: "Booking service — extra photos",
      lineDescription: `Photo Portugal booking service on ${o.photos} extra photo(s)`,
      observations: `Extras order ${o.order_id} · booking ${o.booking_id}`,
      clientId: o.client_id,
      result,
    });
  }
  return result;
}
