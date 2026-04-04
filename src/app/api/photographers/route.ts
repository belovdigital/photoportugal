import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  const shootType = searchParams.get("shoot_type");
  const language = searchParams.get("language");

  try {
    let sql = `
      SELECT p.id, p.slug, u.name, p.tagline,
             u.avatar_url, p.cover_url, p.cover_position_y,
             p.languages, p.shoot_types,
             p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
             p.rating, p.review_count,
             (SELECT MIN(price) FROM packages WHERE photographer_id = p.id AND is_public = TRUE) as min_price,
             ARRAY(SELECT pl.location_slug FROM photographer_locations pl WHERE pl.photographer_id = p.id) as locations
      FROM photographer_profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_approved = TRUE
    `;
    const params: string[] = [];
    let paramIdx = 1;

    if (location) {
      sql += ` AND p.id IN (SELECT photographer_id FROM photographer_locations WHERE location_slug = $${paramIdx})`;
      params.push(location);
      paramIdx++;
    }

    if (shootType) {
      sql += ` AND $${paramIdx} = ANY(p.shoot_types)`;
      params.push(shootType);
      paramIdx++;
    }

    if (language) {
      sql += ` AND $${paramIdx} = ANY(p.languages)`;
      params.push(language);
      paramIdx++;
    }

    sql += ` ORDER BY p.is_featured DESC, RANDOM()`;

    const photographers = await query(sql, params);

    return NextResponse.json(photographers);
  } catch (error) {
    console.error("[photographers] list error:", error);
    return NextResponse.json({ error: "Failed to load photographers" }, { status: 500 });
  }
}
