import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { invalidatePriceCache } from "@/lib/blind-booking/pricing";

export const dynamic = "force-dynamic";

// Maps photographer_locations slugs → canonical region. Kept in sync
// with src/lib/blind-booking/pricing.ts. If you change one, change both.
const REGION_OF: Record<string, string> = {
  lisbon: "greater-lisbon", sintra: "greater-lisbon", cascais: "greater-lisbon",
  caparica: "greater-lisbon", ericeira: "greater-lisbon", almada: "greater-lisbon",
  setubal: "greater-lisbon", comporta: "greater-lisbon", sesimbra: "greater-lisbon",
  arrabida: "greater-lisbon",
  porto: "northern-portugal", braga: "northern-portugal", guimaraes: "northern-portugal",
  "douro-valley": "northern-portugal", douro: "northern-portugal", aveiro: "northern-portugal",
  coimbra: "central-portugal", nazare: "central-portugal", obidos: "central-portugal",
  tomar: "central-portugal", peniche: "central-portugal",
  evora: "alentejo", alentejo: "alentejo",
  algarve: "algarve", lagos: "algarve", tavira: "algarve", portimao: "algarve",
  albufeira: "algarve", faro: "algarve", vilamoura: "algarve",
  madeira: "madeira", funchal: "madeira",
  azores: "azores", "ponta-delgada": "azores", "sao-miguel": "azores",
};

// Must match the occasion enum the Concierge tool description teaches
// the LLM to use. Audit found "couples" missing — LLM emitted it,
// pricing lookup returned null, offer card silently dropped.
const OCCASIONS = [
  "anniversary", "birthday", "couples", "elopement", "engagement",
  "family", "honeymoon", "maternity", "other", "proposal", "vacation",
];

const DURATIONS = [60, 120, 180];

// GET /api/cron/region-pricing-refresh?secret=...
//
// Nightly: recompute median €/hour for each region from current
// package catalog (approved, non-test photographers; trimmed outliers).
// Writes one row per (region, occasion, duration) into region_pricing
// via UPSERT. LLM-visible pricing converges within 24h to whatever
// photographers actually charge.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inserted = { rows: 0, regions: 0, errors: [] as string[] };

  try {
    // Pull (pkg_id, location_slug, €/hour). One package can cover many
    // slugs in the same region (e.g. "lagos" + "tavira" + "faro" all
    // map to Algarve) — we MUST dedup to one row per (package, region)
    // or photographers with wider coverage skew the median upward.
    // Last bug: Algarve median was €410/h before dedup, €300/h after.
    const rows = await query<{ pkg_id: string; location_slug: string; eur_per_hour: number }>(
      `SELECT p.id AS pkg_id,
              pl.location_slug,
              (p.price::float / (p.duration_minutes::float / 60.0)) AS eur_per_hour
         FROM packages p
         JOIN photographer_profiles pp ON pp.id = p.photographer_id
         JOIN users u ON u.id = pp.user_id
         JOIN photographer_locations pl ON pl.photographer_id = pp.id
        WHERE p.is_public = TRUE
          AND p.tier IS NULL
          AND p.custom_for_user_id IS NULL
          AND p.duration_minutes BETWEEN 30 AND 600
          AND p.price BETWEEN 50 AND 5000
          AND pp.is_approved = TRUE
          AND COALESCE(pp.is_test, FALSE) = FALSE
          AND COALESCE(u.is_banned, FALSE) = FALSE`
    );

    // Bucket €/hour by region, deduplicated per (package_id, region).
    const buckets = new Map<string, number[]>();
    const seen = new Set<string>();
    for (const r of rows) {
      const region = REGION_OF[r.location_slug];
      if (!region) continue;
      const key = `${r.pkg_id}:${region}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!buckets.has(region)) buckets.set(region, []);
      buckets.get(region)!.push(Number(r.eur_per_hour));
    }

    for (const [region, values] of buckets) {
      if (values.length < 3) continue; // too few — keep previous seed
      values.sort((a, b) => a - b);
      // Trim 5% tails, then median.
      const trim = Math.floor(values.length * 0.05);
      const trimmed = values.slice(trim, values.length - trim);
      const mid = Math.floor(trimmed.length / 2);
      const median = trimmed.length % 2 === 0
        ? (trimmed[mid - 1] + trimmed[mid]) / 2
        : trimmed[mid];
      const sampleSize = values.length;

      for (const occ of OCCASIONS) {
        for (const dur of DURATIONS) {
          // Round to nearest €5, ceiling so we keep an inclusive
          // margin. Duration scaling stays linear here — per-duration
          // medians weren't sample-rich enough to justify their own
          // computation, same fallback as the seed.
          const priceEur = Math.ceil((median * (dur / 60)) / 5) * 5;
          try {
            await queryOne(
              `INSERT INTO region_pricing (region, occasion, duration_minutes, price_eur, sample_size, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT (region, occasion, duration_minutes)
               DO UPDATE SET price_eur = EXCLUDED.price_eur,
                             sample_size = EXCLUDED.sample_size,
                             updated_at = NOW()
               RETURNING id`,
              [region, occ, dur, priceEur, sampleSize]
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
