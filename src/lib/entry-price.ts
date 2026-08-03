import { queryOne } from "@/lib/db";
import { MIN_PACKAGE_PRICE } from "@/lib/package-pricing";

// Server-only. This lived in package-pricing.ts, which client components
// import for DURATION_OPTIONS — and a dynamic import("@/lib/db") inside a
// module the browser bundle reaches drags the Postgres driver in with it.
// The build caught it; deploy.sh refused to flip and production stayed up.

/**
 * The lowest price a visitor can actually pay for a photoshoot, in euros.
 *
 * Not the package floor: the cheapest real route is the blind booking
 * ("we hand-pick your photographer"), which is priced from `region_pricing`
 * and is what the topbar and homepage advertise. Quoting the package floor
 * instead understated nothing and overstated the entry price by twenty
 * euros, which then disagreed with the banner directly above it.
 *
 * Falls back to the package floor if the pricing table cannot be read —
 * better to quote a real, honoured price than to omit one.
 */
export async function lowestBookablePrice(): Promise<number> {
  try {
    const row = await queryOne<{ p: string | null }>(
      // region_pricing ONLY — deliberately not LEAST() against the package
      // floor any more. That let a single outlier package define the whole
      // platform's advertised price: one photographer's €90 portrait, 1 of
      // 253 public packages, was putting "From €90" on the homepage, into
      // the SERP price hint we feed Google, and from there into Google's
      // auto-generated ad sitelinks ("From €90 · 32+ Cities") — while the
      // real entry point is the €279 all-in blind booking. A price that
      // exists for one photographer in one city is not the price of the
      // marketplace, and quoting it buys clicks from people who leave the
      // moment they see the actual catalogue.
      //
      // region_pricing is the number we can honour anywhere, any date.
      `SELECT (SELECT MIN(price_eur) FROM region_pricing)::text AS p`
    );
    const value = row?.p ? Math.round(parseFloat(row.p)) : null;
    return value && value > 0 ? value : MIN_PACKAGE_PRICE;
  } catch {
    return MIN_PACKAGE_PRICE;
  }
}
