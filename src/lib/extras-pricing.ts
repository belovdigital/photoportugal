/**
 * What an extra photo costs, in one place.
 *
 * "Extra" means a frame the photographer shot but the booking never promised:
 * held out of the delivery, shown watermarked, sold afterwards. The economics
 * were decided 2026-08-05 (docs/DELIVERY-EXTRAS.md) and are flat — the same on
 * every plan, because an extra frame costs the photographer nothing to produce.
 * It is already shot and already edited.
 *
 * This exists for the reason src/lib/service-fee.ts and src/lib/entry-price.ts
 * exist: the number is now quoted in support articles, the ToS, the concierge
 * prompt and the MCP tool descriptions, and a price that lives in five places
 * eventually disagrees with itself. The charge is built from PRICE_CENTS here;
 * everything else displays it.
 */

/** All-in, per photo. No service fee is added on top of this for the client. */
export const EXTRA_PHOTO_PRICE_CENTS = 290;

/** The photographer's share, transferred on payment — not at acceptance. */
export const EXTRA_PHOTO_PAYOUT_CENTS = 200;

/** What the platform keeps. Derived, never typed twice. */
export const EXTRA_PHOTO_PLATFORM_FEE_CENTS =
  EXTRA_PHOTO_PRICE_CENTS - EXTRA_PHOTO_PAYOUT_CENTS;

/** "2,90 €" / "€2.90" — for copy that is generated rather than translated. */
export function formatExtraPhotoPrice(locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(EXTRA_PHOTO_PRICE_CENTS / 100);
}
