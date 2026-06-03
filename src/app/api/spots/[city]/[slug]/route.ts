import { NextRequest, NextResponse } from "next/server";
import { getSpot, spotLocalized } from "@/lib/photo-spots-data";
import { getLocationBySlug, locField } from "@/lib/locations-data";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public-read endpoint for native (Expo) spot screens. Returns the merged
 * spot data (description, long-form copy, images, coordinates) plus a thin
 * list of photographers covering the spot's city — enough for the mobile
 * screen to render hero + about + directions + photographers without
 * shipping `photo-spots-data` to the client bundle.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ city: string; slug: string }> },
) {
  const { city, slug } = await ctx.params;
  const locale = req.nextUrl.searchParams.get("locale") || "en";

  const location = getLocationBySlug(city);
  const spotData = getSpot(city, slug);
  if (!location || !spotData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const s = spotLocalized(spotData, locale);

  // Photographers covering this city — small list for the mobile card row.
  // Same ordering rule as the web spot page: featured → verified → founding,
  // then by rating/reviews.
  const photographers = await query<{
    id: string; slug: string; name: string;
    avatar_url: string | null; cover_url: string | null;
    rating: number | null; review_count: number;
    min_price: string | null;
    is_featured: boolean; is_verified: boolean;
  }>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url,
            pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text AS min_price,
            COALESCE(pp.is_featured, FALSE) AS is_featured,
            COALESCE(pp.is_verified, FALSE) AS is_verified
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       JOIN photographer_locations pl ON pl.photographer_id = pp.id
      WHERE pp.is_approved = TRUE
        AND COALESCE(u.is_banned, FALSE) = FALSE
        AND pl.location_slug = $1
      ORDER BY pp.is_featured DESC, pp.is_verified DESC,
               pp.rating DESC NULLS LAST, pp.review_count DESC NULLS LAST
      LIMIT 6`,
    [city],
  ).catch(() => []);

  return NextResponse.json({
    city: location.slug,
    city_name: locField(location, "name", locale) || location.name,
    slug,
    name: s.name,
    description: s.description,
    long_description: s.long_description || null,
    best_time: s.best_time || null,
    tips: s.tips || null,
    images: spotData.images || [],
    coordinates: spotData.coordinates || null,
    photographers,
  });
}
