import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT pp.id, u.name, pp.slug, u.avatar_url,
        COALESCE(pp.rating, 0) as rating,
        COALESCE(pp.review_count, 0) as review_count,
        (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
        (SELECT array_agg(location_slug) FROM photographer_locations WHERE photographer_id = pp.id) as locations
      FROM photographer_profiles pp
      JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
      ORDER BY pp.rating DESC NULLS LAST`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[admin/match-request/photographers] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch photographers" }, { status: 500 });
  }
}
