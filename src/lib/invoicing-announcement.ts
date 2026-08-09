/**
 * Photographer invoicing instructions — release state and shared constants.
 *
 * The model is the same in every market (decided 2026-08-09): the photographer
 * invoices the CLIENT for their payout; the platform invoices the client for
 * the remainder of the all-inclusive price; the platform NEVER invoices the
 * photographer. Only the local mechanics differ (Finanças / AEAT / SdI), which
 * is why /dashboard/invoicing renders a per-market subtree of the `invoicing`
 * namespace.
 */

import { country, type CountryCode } from "./country";

/**
 * Per-market release switch for the in-product entrances (dashboard banner,
 * sidebar entry). The page itself is always reachable by URL for photographers
 * and admins, so a market can be reviewed before its entrances open.
 *
 * All three went live 2026-08-09 (PT with Kate's roster notification; ES/IT
 * released the same evening on Alex's "делай всё что осталось" — their rosters
 * are a handful of people and the page carries its own not-tax-advice limits).
 */
const LIVE_BY_MARKET: Record<CountryCode, boolean> = {
  pt: true,
  es: true,
  it: true,
};

/**
 * The day the platform's Portuguese activity starts, as declared to the AT.
 * Drives the PT page's intro and its "shoots you have already done" warning;
 * ES/IT copy is date-free until those markets get a release date of their own.
 */
export const ACTIVITY_START_ISO = "2026-08-01";

/** The operating entity behind every market, as it appears on client invoices. */
export const OPERATING_ENTITY = {
  name: "Ekaterina Belova",
  form: "Empresária em Nome Individual",
  nif: "319455327",
  city: "Lisboa",
} as const;

/** Should this market show the in-product entrances to the announcement? */
export const showsInvoicingAnnouncement = LIVE_BY_MARKET[country.code];

/** e.g. "1 August 2026" in the reader's language. */
export function activityStartLabel(locale: string): string {
  return new Date(`${ACTIVITY_START_ISO}T00:00:00Z`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
