/**
 * What an extra photo costs, in one place.
 *
 * "Extra" means a frame the photographer shot but the booking never promised:
 * held out of the delivery, shown watermarked, sold afterwards.
 *
 * The photographer sets what THEY RECEIVE. The client price is derived, so a
 * photographer answering "how much do I get per photo" never has to reason
 * about our cut, and we never have to explain it to them. They type 5, they
 * get 5.
 *
 * This exists for the reason src/lib/service-fee.ts and src/lib/entry-price.ts
 * exist: the number is quoted in support articles, the ToS, the concierge
 * prompt and the MCP tool descriptions, and a price that lives in five places
 * eventually disagrees with itself.
 */

/** Photographer's own rate when they have never set one. €5.00 → €6.30 client. */
export const DEFAULT_EXTRA_PHOTO_PAYOUT_CENTS = 500;

/** Our share, as a fraction added on top of the photographer's rate. */
export const EXTRA_PHOTO_MARKUP = 0.25;

/**
 * Client price from the photographer's rate: +25%, rounded UP to the nearest
 * 10 cents. Rounding up rather than to nearest means the markup is never
 * quietly shaved below 25%, and every price on the site ends in a round dime.
 *
 *   500 → 625 → 630   (€5.00 → €6.30)
 *   290 → 363 → 370
 *  1000 → 1250 → 1250 (already round)
 */
export function clientExtraPriceCents(payoutCents: number): number {
  const raw = Math.round(payoutCents * (1 + EXTRA_PHOTO_MARKUP));
  return Math.ceil(raw / 10) * 10;
}

/** What we keep on one sale. Derived, never typed twice. */
export function platformExtraFeeCents(payoutCents: number): number {
  return clientExtraPriceCents(payoutCents) - payoutCents;
}

/**
 * Resolve the pair for a booking. The snapshot on the booking wins — a
 * photographer raising their rate must never change what a client was already
 * quoted on a gallery they are looking at — then the photographer's current
 * profile rate, then the default.
 */
export function resolveExtrasPricing(row: {
  extra_photo_price_cents?: number | null;
  extra_photo_payout_cents?: number | null;
  profile_extra_photo_payout_cents?: number | null;
}): { priceCents: number; payoutCents: number; platformFeeCents: number } {
  const payoutCents =
    row.extra_photo_payout_cents ??
    row.profile_extra_photo_payout_cents ??
    DEFAULT_EXTRA_PHOTO_PAYOUT_CENTS;
  const priceCents = row.extra_photo_price_cents ?? clientExtraPriceCents(payoutCents);
  return { priceCents, payoutCents, platformFeeCents: priceCents - payoutCents };
}

/** "6,30 €" / "€6.30" — the locale decides where the symbol goes. */
export function formatExtraPhotoPrice(cents: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}
