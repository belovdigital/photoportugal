import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row {
  slug: string;
  name: string;
  cover_url: string | null;
  avatar_url: string | null;
  rating: string | null;
  review_count: number;
  min_price: string | null;
  tagline: string | null;
}

/**
 * GET /api/ai-generate/photographers?loc=lisbon
 *
 * Returns 4 approved photographers for the given location, ranked by
 * review_count → rating. Used by the /try-yourself page during the
 * generation wait to upsell visitors on real photographers.
 *
 * If no `loc` is given (or no photographers match), falls back to top
 * featured photographers across all locations.
 */
export async function GET(req: NextRequest) {
  const loc = (req.nextUrl.searchParams.get("loc") || "").toLowerCase().trim();

  let rows: Row[] = [];
  if (loc) {
    rows = await query<Row>(
      `SELECT pp.slug, u.name,
              pp.cover_url,
              u.avatar_url,
              pp.rating::text AS rating,
              pp.review_count,
              (SELECT MIN(pk.price)::text FROM packages pk WHERE pk.photographer_id = pp.id AND pk.is_public = TRUE) AS min_price,
              pp.tagline
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       JOIN photographer_locations pl ON pl.photographer_id = pp.id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
         AND pl.location_slug = $1
       ORDER BY pp.review_count DESC NULLS LAST, pp.rating DESC NULLS LAST
       LIMIT 4`,
      [loc]
    ).catch(() => []);
  }

  if (rows.length < 4) {
    const fill = await query<Row>(
      `SELECT pp.slug, u.name,
              pp.cover_url,
              u.avatar_url,
              pp.rating::text AS rating,
              pp.review_count,
              (SELECT MIN(pk.price)::text FROM packages pk WHERE pk.photographer_id = pp.id AND pk.is_public = TRUE) AS min_price,
              pp.tagline
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
         AND pp.slug NOT IN (${rows.map((_, i) => `$${i + 1}`).join(",") || "''"})
       ORDER BY pp.review_count DESC NULLS LAST, pp.rating DESC NULLS LAST
       LIMIT $${rows.length + 1}`,
      [...rows.map((r) => r.slug), 4 - rows.length]
    ).catch(() => []);
    rows = [...rows, ...fill];
  }

  return NextResponse.json({
    photographers: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      coverUrl: r.cover_url,
      avatarUrl: r.avatar_url,
      rating: r.rating ? Number(r.rating) : null,
      reviewCount: r.review_count || 0,
      minPrice: r.min_price ? Number(r.min_price) : null,
      tagline: r.tagline,
    })),
  });
}
