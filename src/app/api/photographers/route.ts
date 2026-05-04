import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getShootTypeBySlug } from "@/lib/shoot-types-data";
import {
  expandLocationCoverageToLegacySlugs,
  getCompatibleCoverageNodeSlugs,
} from "@/lib/location-hierarchy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  const shootType = searchParams.get("shoot_type");
  const language = searchParams.get("language");

  try {
    // Extended to return portfolio_thumbs[] + packages[] inline so mobile
    // can render image-led carousel cards (Instagram pattern) without an
    // extra round-trip per card. Subqueries are limited (6 photos, 3
    // packages) so the cost stays bounded even with 50+ photographers.
    let sql = `
      SELECT p.id, p.slug, u.name, p.tagline,
             u.avatar_url, p.cover_url, p.cover_position_y,
             p.languages, p.shoot_types,
             p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
             p.rating, p.review_count,
             (SELECT MIN(price) FROM packages WHERE photographer_id = p.id AND is_public = TRUE) as min_price,
             ARRAY(SELECT pl.location_slug FROM photographer_locations pl WHERE pl.photographer_id = p.id) as locations,
             ARRAY(SELECT plc.node_slug FROM photographer_location_coverage plc WHERE plc.photographer_id = p.id ORDER BY plc.created_at, plc.node_slug) as coverage_nodes,
             COALESCE((
               SELECT array_agg(url ORDER BY shuffle, sort_order NULLS LAST, created_at)
                 FROM (
                   SELECT pi.url,
                          hashtext(p.id::text || pi.url) as shuffle,
                          pi.sort_order, pi.created_at
                     FROM portfolio_items pi
                    WHERE pi.photographer_id = p.id AND pi.type = 'photo'
                    ORDER BY shuffle, pi.sort_order NULLS LAST, pi.created_at
                    LIMIT 6
                 ) t
             ), ARRAY[]::text[]) as portfolio_thumbs,
             COALESCE((
               SELECT json_agg(
                 json_build_object(
                   'id', pk.id,
                   'name', pk.name,
                   'price', pk.price,
                   'duration_minutes', pk.duration_minutes,
                   'num_photos', COALESCE(pk.num_photos, 0)
                 ) ORDER BY pk.is_popular DESC NULLS LAST, pk.sort_order NULLS LAST, pk.price ASC
               )
               FROM (
                 SELECT id, name, price, duration_minutes, num_photos, is_popular, sort_order
                   FROM packages
                  WHERE photographer_id = p.id
                    AND is_public = TRUE
                    AND custom_for_user_id IS NULL
                  ORDER BY is_popular DESC NULLS LAST, sort_order NULLS LAST, price ASC
                  LIMIT 3
               ) pk
             ), '[]'::json) as packages
      FROM photographer_profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_approved = TRUE
    `;
    const params: (string | string[])[] = [];
    let paramIdx = 1;

    if (location) {
      const requestedLocations = location.split(",").map((part) => part.trim()).filter(Boolean);
      const legacySlugs = expandLocationCoverageToLegacySlugs(requestedLocations);
      const compatibleNodeSlugs = getCompatibleCoverageNodeSlugs(requestedLocations);
      sql += ` AND (
        p.id IN (SELECT photographer_id FROM photographer_locations WHERE location_slug = ANY($${paramIdx}::text[]))
        OR p.id IN (SELECT photographer_id FROM photographer_location_coverage WHERE node_slug = ANY($${paramIdx + 1}::text[]))
      )`;
      params.push(legacySlugs.length > 0 ? legacySlugs : requestedLocations);
      params.push(compatibleNodeSlugs.length > 0 ? compatibleNodeSlugs : requestedLocations);
      paramIdx += 2;
    }

    if (shootType) {
      // `shootType` may arrive as a slug (e.g. "solo") or as a stored label (e.g. "Solo Portrait").
      // Resolve to the full list of aliases when it's a known slug, else pass through.
      const st = getShootTypeBySlug(shootType);
      const aliases = st?.photographerShootTypeNames ?? (st ? [st.name] : [shootType]);
      sql += ` AND p.shoot_types && $${paramIdx}::text[]`;
      params.push(aliases);
      paramIdx++;
    }

    if (language) {
      sql += ` AND $${paramIdx} = ANY(p.languages)`;
      params.push(language);
      paramIdx++;
    }

    sql += ` ORDER BY p.is_featured DESC, p.is_verified DESC, RANDOM()`;

    const photographers = await query(sql, params);

    return NextResponse.json(photographers);
  } catch (error) {
    console.error("[photographers] list error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/photographers", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to load photographers" }, { status: 500 });
  }
}
