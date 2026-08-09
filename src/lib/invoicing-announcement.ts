/**
 * The one-time announcement that tells Portuguese photographers they now have
 * to issue a fatura for every shoot.
 *
 * Everything that decides WHO sees it and WHICH dates it quotes lives here, so
 * flipping the announcement live is a one-line change rather than a hunt
 * through three components.
 */

import { country } from "./country";

/**
 * Has the announcement been released to photographers?
 *
 * Released on 2026-08-09, once Alex settled which amount the photographer
 * invoices: the platform invoices the client for its service fee and the
 * photographer for its commission, so the photographer invoices only their own
 * session rate. Kate notifies the roster the same day.
 */
export const INVOICING_ANNOUNCEMENT_LIVE = true;

/**
 * The day the platform's Portuguese activity starts, as declared to the AT.
 *
 * Quoted on the page, in the banner and in the "shoots you have already done"
 * warning. If Kate's início de atividade lands on another date, change it here
 * and every surface follows.
 */
export const ACTIVITY_START_ISO = "2026-08-01";

/** The operating entity, as it must appear on documents photographers receive. */
export const OPERATING_ENTITY = {
  name: "Ekaterina Belova",
  form: "Empresária em Nome Individual",
  nif: "319455327",
  city: "Lisboa",
} as const;

/**
 * Only Portugal. The instructions are Portuguese tax law end to end — Finanças,
 * ATCUD, artigo 53.º — and shipping them to a Spanish or Italian photographer
 * would be worse than showing nothing: it reads as authoritative and is wrong
 * for their country.
 */
export const invoicingAnnouncementApplies = country.code === "pt";

/**
 * Should the in-product entrances (sidebar entry, dashboard banner) be shown?
 *
 * No admin escape hatch on purpose: the admin role renders neither the
 * photographer sidebar nor the photographer overview, so a branch for it would
 * look like a preview path and never fire. Review the page at its URL instead —
 * `/dashboard/invoicing` is reachable for photographer and admin alike.
 */
export const showsInvoicingAnnouncement =
  invoicingAnnouncementApplies && INVOICING_ANNOUNCEMENT_LIVE;

/** e.g. "1 August 2026" in the reader's language. */
export function activityStartLabel(locale: string): string {
  return new Date(`${ACTIVITY_START_ISO}T00:00:00Z`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
