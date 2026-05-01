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

  // Full list with photographer info — returns the same rich shape as
  // the explore-list endpoint (`/api/photographers`) so the saved tab
  // can render the same Instagram-style PhotographerFullCard with cover
  // carousel and inline package list, instead of a flat thumbnail card.
  const rows = await query(
    `SELECT w.photographer_id AS id, pp.slug, u.name, pp.tagline,
            u.avatar_url, pp.cover_url,
            pp.is_verified, pp.is_featured,
            pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) AS min_price,
            ARRAY(SELECT pl.location_slug FROM photographer_locations pl WHERE pl.photographer_id = pp.id) AS locations,
            COALESCE((
              SELECT array_agg(url ORDER BY shuffle, sort_order NULLS LAST, created_at)
                FROM (
                  SELECT pi.url,
                         hashtext(pp.id::text || pi.url) AS shuffle,
                         pi.sort_order, pi.created_at
                    FROM portfolio_items pi
                   WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
                   ORDER BY shuffle, pi.sort_order NULLS LAST, pi.created_at
                   LIMIT 6
                ) t
            ), ARRAY[]::text[]) AS portfolio_thumbs,
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
                 WHERE photographer_id = pp.id
                   AND is_public = TRUE
                   AND custom_for_user_id IS NULL
                 ORDER BY is_popular DESC NULLS LAST, sort_order NULLS LAST, price ASC
                 LIMIT 3
              ) pk
            ), '[]'::json) AS packages,
            w.created_at AS wishlisted_at
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
      sendTelegram(`❤️ <b>${info.client_name}</b> saved <b>${info.photographer_name}</b> to wishlist\nhttps://photoportugal.com/photographers/${info.slug}`, "clients").catch((err) => console.error("[wishlist] telegram error:", err));
    }

    return NextResponse.json({ wishlisted: true });
  }
}
