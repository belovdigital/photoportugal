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
      `SELECT mr.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', pp.id, 'name', u.name, 'slug', pp.slug,
            'avatar_url', u.avatar_url,
            'rating', COALESCE(pp.avg_rating, 0),
            'review_count', COALESCE(pp.review_count, 0),
            'min_price', (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)
          ))
          FROM match_request_photographers mrp
          JOIN photographer_profiles pp ON pp.id = mrp.photographer_id
          JOIN users u ON u.id = pp.user_id
          WHERE mrp.match_request_id = mr.id),
          '[]'::json
        ) as photographers
      FROM match_requests mr
      ORDER BY mr.created_at DESC
      LIMIT 200`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[admin/match-request] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch match requests" }, { status: 500 });
  }
}
