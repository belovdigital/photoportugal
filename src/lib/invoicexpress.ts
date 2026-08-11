/**
 * InvoiceXpress — the platform's own invoices to clients.
 *
 * What we issue and why: the client pays one all-in price. The photographer
 * invoices them for their payout; we invoice them for the remainder, which is
 * our booking service. We never invoice a photographer for commission.
 *
 * Two rules this module exists to enforce:
 *
 * 1. **A finalised document cannot be deleted.** Only credited. So everything
 *    here creates a DRAFT, and finalising is a separate, separately-gated call.
 *    `INVOICEXPRESS_FINALIZE` stays unset until a human has read real drafts in
 *    the InvoiceXpress UI and agreed they are right.
 *
 * 2. **Never two documents for one booking.** The caller writes the returned id
 *    onto the booking inside the same request that created it, and the unique
 *    index in migration 006 catches anything that slips past.
 *
 * The amount is always derived from what Stripe actually charged, never from
 * the package price — those diverge on promo codes, blind bookings and the €5
 * rounding, and the invoice has to match the money.
 */

const ACCOUNT = process.env.INVOICEXPRESS_ACCOUNT;
const API_KEY = process.env.INVOICEXPRESS_API_KEY;
const SEQUENCE_ID = process.env.INVOICEXPRESS_SEQUENCE_ID;

/** Series PP is registered with the AT; issuing on an unregistered series
 *  produces documents without a valid ATCUD. */
export const invoicexpressConfigured = Boolean(ACCOUNT && API_KEY && SEQUENCE_ID);

/**
 * Kate's ENI is exempt under article 53.º CIVA, so every line carries a 0%
 * tax plus the exemption reason. M10 is the AT's code for the article 53.º
 * regime; without it the document is incomplete, not merely untaxed.
 */
const EXEMPTION_REASON = "M10";
const EXEMPT_TAX_NAME = "Isento";

/** Portuguese generic NIF for a final consumer — most of our clients are
 *  tourists with no Portuguese tax number. */
export const CONSUMIDOR_FINAL_NIF = "999999990";

/** Kate's início de atividade. Nothing paid before this can be invoiced. */
export const ACTIVITY_START = "2026-08-01";

/** Our cut is a service fee plus a plan commission. Outside this band the
 *  stored payout and the Stripe charge disagree about the booking, and the
 *  answer is a person, not a document. */
export const SHARE_PCT_MIN = 10;
export const SHARE_PCT_MAX = 35;

/**
 * The Portuguese calendar day for a unix timestamp.
 *
 * NOT toISOString(): that is UTC, and Lisbon runs UTC+1 from late March to late
 * October, so every payment in the first hour of a local day was landing on the
 * previous date — mis-dating the document and, at the boundary, pushing a
 * genuine first-of-August payment behind the activity-start cutoff.
 */
export function lisbonDay(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

/**
 * When the money actually moved, for a Stripe charge.
 *
 * `charge.created` is the AUTHORISATION. Blind bookings are authorised at
 * checkout and captured days later when an admin assigns the photographer, so
 * for those the two differ by up to six days. The balance transaction is
 * created at capture, which is the instant that dates the document.
 */
export function paymentInstant(charge: {
  created: number;
  balance_transaction?: unknown;
}): number {
  const bt = charge.balance_transaction;
  if (bt && typeof bt === "object" && "created" in bt && typeof (bt as { created: unknown }).created === "number") {
    return (bt as { created: number }).created;
  }
  return charge.created;
}

function base(): string {
  return `https://${ACCOUNT}.app.invoicexpress.com`;
}

async function call<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<T> {
  if (!invoicexpressConfigured) {
    throw new Error("InvoiceXpress is not configured (ACCOUNT / API_KEY / SEQUENCE_ID)");
  }
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base()}${path}${sep}api_key=${API_KEY}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    // The body carries the field-level reason ("client is invalid", "tax not
    // found"); losing it turns every failure into "400" and a guessing game.
    throw new Error(`InvoiceXpress ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface IXClient {
  id: number;
  name: string;
  code: string;
  fiscal_id?: string | null;
}

/**
 * Find a client by our own stable code, or create it.
 *
 * `code` is InvoiceXpress's unique-per-client field, so we key it on our user
 * id for identified clients and on the generic NIF for anonymous tourists.
 * Reusing one "Consumidor Final" record for every tourist is deliberate: their
 * name is on the document, and creating hundreds of near-empty client records
 * makes the account unusable for Kate.
 */
export async function findOrCreateClient(opts: {
  code: string;
  name: string;
  email?: string | null;
  fiscalId?: string | null;
  country?: string | null;
}): Promise<IXClient> {
  try {
    const found = await call<{ client: IXClient }>(
      "GET",
      `/clients/find-by-code.json?client_code=${encodeURIComponent(opts.code)}`
    );
    if (found?.client?.id) return found.client;
  } catch {
    // 404 from find-by-code is the normal "not there yet" path.
  }
  const created = await call<{ client: IXClient }>("POST", "/clients.json", {
    client: {
      name: opts.name.slice(0, 100),
      code: opts.code,
      email: opts.email || undefined,
      fiscal_id: opts.fiscalId || CONSUMIDOR_FINAL_NIF,
      country: opts.country || undefined,
    },
  });
  return created.client;
}

export interface DraftLine {
  name: string;
  description?: string;
  unit_price: number;
  quantity: number;
}

export interface IXInvoice {
  id: number;
  status: string;
  sequence_number?: string;
  permalink?: string;
  total?: string;
}

/**
 * Create a DRAFT invoice. Never finalises — see the module header.
 *
 * `date` is the document date. Under the model settled on 2026-08-11 that is
 * the day the client paid, not the day of the shoot: the client pays when the
 * booking is confirmed, which is normally earlier.
 */
export async function createInvoiceDraft(opts: {
  clientId: number;
  date: string; // YYYY-MM-DD
  lines: DraftLine[];
  observations?: string;
}): Promise<IXInvoice> {
  const payload = {
    invoice: {
      date: opts.date,
      due_date: opts.date,
      // Explicit: the account has more than one series and the default can be
      // changed in the UI by someone who does not know we depend on it.
      sequence_id: Number(SEQUENCE_ID),
      client: { id: opts.clientId },
      items: opts.lines.map((l) => ({
        name: l.name.slice(0, 100),
        description: l.description?.slice(0, 250),
        unit_price: Number(l.unit_price.toFixed(2)),
        quantity: l.quantity,
        tax: { name: EXEMPT_TAX_NAME },
      })),
      tax_exemption: EXEMPTION_REASON,
      observations: opts.observations,
    },
  };
  const created = await call<{ invoice: IXInvoice }>("POST", "/invoices.json", payload);
  return created.invoice;
}

/**
 * The date of the most recent document already in our series, or null if the
 * series is empty.
 *
 * A series cannot go backwards: InvoiceXpress refuses to finalise anything
 * dated earlier than this, because Portuguese numbering rules require it. The
 * issuing loop reads this once and refuses to attempt a document below it,
 * rather than discovering the rule as a 422 halfway through a run.
 */
export async function sequenceLastDocumentDate(): Promise<string | null> {
  try {
    const r = await call<{ invoices?: Array<{ date?: string; status?: string }> }>(
      "GET",
      "/invoices.json?per_page=30&non_archived=true"
    );
    const dates = (r.invoices || [])
      .filter((i) => i.status && i.status !== "draft" && i.status !== "deleted")
      // InvoiceXpress returns DD/MM/YYYY; compare as ISO.
      .map((i) => {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(i.date || "");
        return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
      })
      .filter((d): d is string => Boolean(d));
    return dates.length ? dates.sort().at(-1)! : null;
  } catch {
    // Unknown floor is not a reason to stop: the per-document 422 still
    // protects us, it is just a worse error message.
    return null;
  }
}

/**
 * Move a DRAFT's date. The only legitimate use is a document that arrived out
 * of order and cannot be dated truthfully without going backwards in the
 * series — where the choice is a date one or two days late, or no document at
 * all for a real payment. Refuses anything already finalised.
 */
export async function setDraftDate(id: number | string, date: string): Promise<IXInvoice> {
  const r = await call<{ invoice: IXInvoice }>("PUT", `/invoices/${id}.json`, {
    invoice: { date, due_date: date },
  });
  return r.invoice;
}

/** Read a document back — used to verify a draft before anyone finalises it. */
export async function getInvoice(id: number | string): Promise<IXInvoice> {
  const r = await call<{ invoice: IXInvoice }>("GET", `/invoices/${id}.json`);
  return r.invoice;
}

/**
 * Finalise a draft. Irreversible: from here the document exists for the AT and
 * can only be undone with a credit note.
 *
 * Gated on INVOICEXPRESS_FINALIZE so that shipping the code and switching it on
 * are two separate decisions taken on two different days.
 */
export async function finalizeInvoice(id: number | string): Promise<IXInvoice> {
  if (process.env.INVOICEXPRESS_FINALIZE !== "true") {
    throw new Error(
      `Refusing to finalise invoice ${id}: INVOICEXPRESS_FINALIZE is not "true". ` +
        `Finalising is irreversible — set it deliberately.`
    );
  }
  const r = await call<{ invoice: IXInvoice }>("PUT", `/invoices/${id}/change-state.json`, {
    invoice: { state: "finalized" },
  });
  return r.invoice;
}

/**
 * What the platform charges the client on a booking: everything they paid that
 * is not the photographer's payout.
 *
 * Both inputs come from the booking row as actuals — `paidCents` from Stripe,
 * `payout` from the agreed payout — so promo codes, blind pricing and the €5
 * rounding are all already inside the number. Returns null when the figures
 * cannot produce a sane positive amount; the caller must skip rather than
 * invent one.
 */
export function platformShareEur(paidCents: number | null, payout: number | null): number | null {
  if (paidCents == null || payout == null) return null;
  const paid = paidCents / 100;
  const share = Math.round((paid - Number(payout)) * 100) / 100;
  if (!Number.isFinite(share) || share <= 0 || share > paid) return null;
  return share;
}
