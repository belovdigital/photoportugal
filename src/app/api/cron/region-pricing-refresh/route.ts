import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { invalidatePriceCache } from "@/lib/blind-booking/pricing";

export const dynamic = "force-dynamic";

// FLAT PRICING (2026-06-03) — user decision: same rate across all
// regions and occasions, with a built-in duration discount that makes
// 2h+ attractive. Photographer payout in cheap regions is generous;
// in expensive regions (Algarve) margin is tight but acceptable.
//   1h →  €300 (€338 client all-in with 12.5% service fee)
//   2h →  €500 (€563)
//   3h →  €700 (€788)
const FLAT_PRICES: Record<60 | 120 | 180, number> = {
  60: 300,
  120: 500,
  180: 700,
};

// Region + occasion combos that get priced. UPSERT covers any new
// (region, occasion, duration) tuples the LLM might emit before a
// human seeds them.
const REGIONS = [
  "greater-lisbon", "northern-portugal", "central-portugal",
  "alentejo", "algarve", "madeira", "azores",
];

const OCCASIONS = [
  "anniversary", "birthday", "couples", "elopement", "engagement",
  "family", "honeymoon", "maternity", "other", "proposal", "solo", "vacation",
];

const DURATIONS: (60 | 120 | 180)[] = [60, 120, 180];

// GET /api/cron/region-pricing-refresh?secret=...
//
// Nightly: ensure every (region, occasion, duration) tuple has its
// flat price row. The old behaviour computed regional medians from
// the package catalog; that's been replaced with flat platform-wide
// pricing per user decision 2026-06-03. We still UPSERT nightly so
// any new occasion/region the LLM might emit auto-populates without
// a manual seed.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inserted = { rows: 0, regions: 0, errors: [] as string[] };

  try {
    for (const region of REGIONS) {
      for (const occ of OCCASIONS) {
        for (const dur of DURATIONS) {
          try {
            await queryOne(
              `INSERT INTO region_pricing (region, occasion, duration_minutes, price_eur, sample_size, updated_at)
               VALUES ($1, $2, $3, $4, 0, NOW())
               ON CONFLICT (region, occasion, duration_minutes)
               DO UPDATE SET price_eur = EXCLUDED.price_eur,
                             updated_at = NOW()
               RETURNING id`,
              [region, occ, dur, FLAT_PRICES[dur]]
            );
            inserted.rows++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            inserted.errors.push(`${region}/${occ}/${dur}: ${msg}`);
          }
        }
      }
      inserted.regions++;
    }

    invalidatePriceCache();
  } catch (err) {
    inserted.errors.push(`scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json(inserted);
}
