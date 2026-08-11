import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import {
  invoicexpressConfigured,
  findOrCreateClient,
  createInvoiceDraft,
  finalizeInvoice,
  sequenceLastDocumentDate,
} from "@/lib/invoicexpress";
import { collectAll, type Candidate } from "./collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Issues every document the platform owes: its share of a booking, a
 * photographer's add-on subscription, and the margin on an extra-photo sale.
 *
 * A cron rather than a Stripe webhook, deliberately. A webhook fires once: if
 * InvoiceXpress is down or a row is momentarily odd, the document is simply
 * never created and nothing notices. This re-reads outstanding work every run,
 * so a failure is a delay rather than a hole.
 *
 * ── Why collect-then-issue, in that order ────────────────────────────────
 * A series cannot go backwards in time. InvoiceXpress refuses to finalise a
 * document dated earlier than the last one in the sequence, and Portuguese
 * numbering rules are why. Issuing stream by stream produced exactly that on
 * 2026-08-11: a 3 August subscription arriving after a 4 August booking, and
 * permanently unissuable in series PP. So every candidate is dated first, the
 * whole set is sorted oldest-first, and anything older than the series' last
 * document is held for a person instead of being attempted and failing.
 *
 * Everything irreversible is gated:
 *   INVOICEXPRESS_AUTO_ISSUE=true  — create drafts at all
 *   INVOICEXPRESS_FINALIZE=true    — turn drafts into real fiscal documents
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

  const { candidates, held, errors } = await collectAll(stripe);
  const result = {
    considered: candidates.length,
    issued: 0,
    finalized: 0,
    held,
    errors,
    wouldIssue: [] as string[],
  };

  // The floor: nothing may be dated before the last document already in the
  // series. Read once per run — every issue moves it forward.
  let seriesFloor = await sequenceLastDocumentDate();

  for (const c of candidates) {
    const tag = `${c.sourceType} ${c.sourceId.slice(0, 12)}`;
    if (seriesFloor && c.date < seriesFloor) {
      result.held.push(
        `${tag}: dated ${c.date}, but series already has a document dated ${seriesFloor} — needs a person`
      );
      continue;
    }
    if (!autoIssue) {
      result.wouldIssue.push(`${tag}: ${c.amountEur} on ${c.date}`);
      continue;
    }
    try {
      const invoiceId = await issueCandidate(c, finalize);
      result.issued++;
      if (finalize) result.finalized++;
      seriesFloor = c.date;
      void invoiceId;
    } catch (err) {
      result.errors.push(`${tag}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Anything refused is a thing a person has to look at, so it must not be
  // findable only by reading a cron log nobody opens.
  if (result.errors.length > 0) {
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      await sendTelegram(
        `🧾 <b>InvoiceXpress: ${result.errors.length} error(s)</b>\n\n${result.errors.slice(0, 5).join("\n")}`
      );
    } catch {}
  }

  return NextResponse.json(result);
}

/**
 * Claim, create, record — in that order, so a crash between the API call and
 * the write blocks a duplicate instead of inviting one.
 *
 * Bookings claim on their own columns (migration 006); everything else claims
 * a row in `issued_documents`, whose unique key is (source_type, source_id) and
 * is the actual one-per-source guarantee.
 */
async function issueCandidate(c: Candidate, finalize: boolean): Promise<number> {
  let release: (() => Promise<void>) | null = null;
  let record: (invoiceId: number) => Promise<void>;
  let markFinal: () => Promise<void>;

  if (c.sourceType === "booking") {
    const claimed = await queryOne<{ id: string }>(
      `UPDATE bookings SET invoicexpress_state = 'claiming'
        WHERE id = $1 AND invoicexpress_invoice_id IS NULL
          AND (invoicexpress_state IS NULL OR invoicexpress_state = 'error')
        RETURNING id`,
      [c.sourceId]
    );
    if (!claimed) throw new Error("claimed elsewhere");
    release = async () => {
      await queryOne(
        `UPDATE bookings SET invoicexpress_state = 'error'
          WHERE id = $1 AND invoicexpress_invoice_id IS NULL AND invoicexpress_state = 'claiming'
          RETURNING id`,
        [c.sourceId]
      ).catch(() => {});
    };
    record = async (invoiceId) => {
      await queryOne(
        `UPDATE bookings SET invoicexpress_invoice_id = $1, invoicexpress_state = 'draft',
                invoicexpress_issued_at = NOW()
          WHERE id = $2 RETURNING id`,
        [String(invoiceId), c.sourceId]
      );
    };
    markFinal = async () => {
      await queryOne(`UPDATE bookings SET invoicexpress_state = 'final' WHERE id = $1 RETURNING id`, [c.sourceId]);
    };
  } else {
    const claimed = await queryOne<{ id: string }>(
      `INSERT INTO issued_documents
         (source_type, source_id, photographer_id, client_id, amount_eur, document_date, state)
       VALUES ($1, $2, $3, $4, $5, $6, 'claiming')
       ON CONFLICT (source_type, source_id) DO NOTHING
       RETURNING id`,
      [c.sourceType, c.sourceId, c.photographerId || null, c.clientId || null, c.amountEur, c.date]
    );
    if (!claimed) throw new Error("claimed elsewhere");
    const rowId = claimed.id;
    release = async () => {
      await queryOne(
        `UPDATE issued_documents SET state = 'error' WHERE id = $1 AND invoicexpress_invoice_id IS NULL RETURNING id`,
        [rowId]
      ).catch(() => {});
    };
    record = async (invoiceId) => {
      await queryOne(
        `UPDATE issued_documents SET invoicexpress_invoice_id = $1, state = 'draft', issued_at = NOW()
          WHERE id = $2 RETURNING id`,
        [String(invoiceId), rowId]
      );
    };
    markFinal = async () => {
      await queryOne(`UPDATE issued_documents SET state = 'final' WHERE id = $1 RETURNING id`, [rowId]);
    };
  }

  let invoiceId: number;
  try {
    const client = await findOrCreateClient({
      code: c.clientCode,
      name: c.clientName,
      email: c.clientEmail,
    });
    const inv = await createInvoiceDraft({
      clientId: client.id,
      date: c.date,
      lines: [{ name: c.lineName, description: c.lineDescription, unit_price: c.amountEur, quantity: 1 }],
      observations: c.observations,
    });
    invoiceId = inv.id;
  } catch (err) {
    await release?.();
    throw err;
  }

  try {
    await record(invoiceId);
  } catch (writeErr) {
    // The document exists and could not be recorded. The id has to reach a
    // human or the orphan is unfindable; the claim stays so nothing re-issues.
    throw new Error(
      `ORPHAN DRAFT #${invoiceId} for ${c.sourceType} ${c.sourceId} — could not record: ${writeErr}`
    );
  }

  if (finalize) {
    await finalizeInvoice(invoiceId);
    await markFinal();
  }
  return invoiceId;
}
