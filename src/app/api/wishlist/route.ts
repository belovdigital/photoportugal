import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";

// GET /api/wishlist — list wishlisted photographers
// GET /api/wishlist?check=id1,id2 — bulk check which IDs are wishlisted
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = req.nextUrl.searchParams.get("check");

  if (check) {
    if (check === "all") {
      // Return all wishlisted photographer_ids
      const rows = await query<{ photographer_id: string }>(
        "SELECT photographer_id FROM wishlists WHERE user_id = $1",
        [user.id]
      );
      return NextResponse.json(rows.map((r) => r.photographer_id));
    }
    // Bulk check: return array of wishlisted photographer_ids
    const ids = check.split(",").filter(Boolean);
    if (ids.length === 0) return NextResponse.json([]);
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
    const rows = await query<{ photographer_id: string }>(
      `SELECT photographer_id FROM wishlists WHERE user_id = $1 AND photographer_id IN (${placeholders})`,
      [user.id, ...ids]
    );
    return NextResponse.json(rows.map((r) => r.photographer_id));
  }

  // Full list with photographer info
  const rows = await query<{
    photographer_id: string;
    slug: string;
    name: string;
    tagline: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    rating: number;
    review_count: number;
    min_price: number | null;
    wishlisted_at: string;
  }>(
    `SELECT w.photographer_id, pp.slug, u.name, pp.tagline, u.avatar_url, pp.cover_url,
            pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
            w.created_at as wishlisted_at
     FROM wishlists w
     JOIN photographer_profiles pp ON pp.id = w.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE w.user_id = $1 AND pp.is_approved = TRUE
     ORDER BY w.created_at DESC`,
    [user.id]
  );

  return NextResponse.json(rows);
}

// POST /api/wishlist — toggle wishlist (add or remove)
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photographer_id } = await req.json();
  if (!photographer_id) {
    return NextResponse.json({ error: "photographer_id required" }, { status: 400 });
  }

  // Check if already wishlisted
  const existing = await queryOne(
    "SELECT id FROM wishlists WHERE user_id = $1 AND photographer_id = $2",
    [user.id, photographer_id]
  );

  if (existing) {
    // Remove
    await queryOne("DELETE FROM wishlists WHERE user_id = $1 AND photographer_id = $2", [user.id, photographer_id]);
    return NextResponse.json({ wishlisted: false });
  } else {
    // Add
    await queryOne(
      "INSERT INTO wishlists (user_id, photographer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, photographer_id]
    );

    // Telegram notification
    const info = await queryOne<{ client_name: string; photographer_name: string; slug: string }>(
      `SELECT u_c.name as client_name, u_p.name as photographer_name, pp.slug
       FROM users u_c, photographer_profiles pp JOIN users u_p ON u_p.id = pp.user_id
       WHERE u_c.id = $1 AND pp.id = $2`,
      [user.id, photographer_id]
    );
    if (info) {
      sendTelegram(`❤️ <b>${info.client_name}</b> saved <b>${info.photographer_name}</b> to wishlist\nhttps://photoportugal.com/photographers/${info.slug}`).catch((err) => console.error("[wishlist] telegram error:", err));
    }

    return NextResponse.json({ wishlisted: true });
  }
}
