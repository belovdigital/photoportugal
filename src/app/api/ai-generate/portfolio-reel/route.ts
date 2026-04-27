import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row {
  url: string;
  photographer_slug: string;
  photographer_name: string;
  photographer_rating: string | null;
  location_slug: string | null;
}

/**
 * GET /api/ai-generate/portfolio-reel?loc=lisbon
 *
 * Returns up to 12 real portfolio photos (with attribution) for the
 * carousel that runs while the AI generation is in flight. Filters by
 * location when one is given; falls back to top-rated photographers'
 * portfolios across all locations.
 *
 * Each row includes the photographer slug + name so the carousel can
 * link the photo to that photographer's profile (opens in a new tab).
 */
export async function GET(req: NextRequest) {
  const loc = (req.nextUrl.searchParams.get("loc") || "").toLowerCase().trim();

  // One random photo per photographer — variety is the whole point of the reel.
  // DISTINCT ON (photographer_id) keeps the first row per photographer in the
  // ORDER BY; we randomise the inner order so each visit shows different shots.
  let rows: Row[] = [];
  if (loc) {
    rows = await query<Row>(
      `SELECT DISTINCT ON (pp.id)
              pi.url,
              pp.slug AS photographer_slug,
              u.name AS photographer_name,
              pp.rating::text AS photographer_rating,
              pi.location_slug,
              pp.review_count,
              pp.rating
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
         AND (pi.location_slug = $1 OR pp.id IN (
           SELECT pl.photographer_id FROM photographer_locations pl WHERE pl.location_slug = $1
         ))
       ORDER BY pp.id, RANDOM()`,
      [loc]
    ).catch(() => []);
    // Sort by review count desc, take top 12
    rows = rows
      .sort((a, b) => {
        const ar = (a as Row & { review_count?: number }).review_count || 0;
        const br = (b as Row & { review_count?: number }).review_count || 0;
        return br - ar;
      })
      .slice(0, 12);
  }

  if (rows.length < 12) {
    const fill = await query<Row>(
      `SELECT DISTINCT ON (pp.id)
              pi.url,
              pp.slug AS photographer_slug,
              u.name AS photographer_name,
              pp.rating::text AS photographer_rating,
              pi.location_slug
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
       ORDER BY pp.id, RANDOM()
       LIMIT $1`,
      [(12 - rows.length) * 3]
    ).catch(() => []);
    // De-dupe by photographer slug (rows already have one-per-photographer, but
    // need to skip ones we already have from the location-specific query)
    const seenPhotographers = new Set(rows.map((r) => r.photographer_slug));
    for (const r of fill) {
      if (rows.length >= 12) break;
      if (!seenPhotographers.has(r.photographer_slug)) {
        rows.push(r);
        seenPhotographers.add(r.photographer_slug);
      }
    }
  }

  return NextResponse.json({
    photos: rows.slice(0, 12).map((r) => ({
      url: r.url,
      photographerSlug: r.photographer_slug,
      photographerName: r.photographer_name,
      photographerRating: r.photographer_rating ? Number(r.photographer_rating) : null,
      locationSlug: r.location_slug,
    })),
  });
}
