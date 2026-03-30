import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  try {
    // Get user role from DB
    const dbUser = await queryOne<{ role: string }>(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );

    let conversations;

    if (dbUser?.role === "photographer") {
      const profile = await queryOne<{ id: string }>(
        "SELECT id FROM photographer_profiles WHERE user_id = $1",
        [userId]
      );
      if (!profile) return NextResponse.json([]);

      conversations = await query(
        `SELECT DISTINCT ON (u.id)
          b.id as booking_id,
          u.name as other_name,
          u.avatar_url as other_avatar,
          u.id as other_user_id,
          'client' as other_role,
          NULL as other_slug,
          b.status as booking_status,
          p.name as package_name,
          COALESCE(
            (SELECT text FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1),
            CASE WHEN (SELECT media_url FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) IS NOT NULL THEN '📷 Photo' ELSE NULL END
          ) as last_message,
          (SELECT media_url FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_media_url,
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM messages WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = u.id AND photographer_id = $2) AND sender_id != $1 AND read_at IS NULL)::int as unread_count
        FROM bookings b
        JOIN users u ON u.id = b.client_id
        LEFT JOIN packages p ON p.id = b.package_id
        WHERE b.photographer_id = $2
          AND (EXISTS (SELECT 1 FROM messages WHERE booking_id = b.id) OR b.status IN ('inquiry','pending','confirmed'))
        ORDER BY u.id, COALESCE(
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1),
          b.created_at
        ) DESC`,
        [userId, profile.id]
      );
      // Re-sort by last message time (DISTINCT ON requires ORDER BY on the distinct column first)
      (conversations as Array<Record<string, unknown>>).sort((a, b) =>
        new Date(b.last_message_at as string || 0).getTime() - new Date(a.last_message_at as string || 0).getTime()
      );
    } else {
      conversations = await query(
        `SELECT DISTINCT ON (pp.user_id)
          b.id as booking_id,
          u.name as other_name,
          u.avatar_url as other_avatar,
          u.id as other_user_id,
          'photographer' as other_role,
          pp.slug as other_slug,
          b.status as booking_status,
          p.name as package_name,
          COALESCE(
            (SELECT text FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1),
            CASE WHEN (SELECT media_url FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) IS NOT NULL THEN '📷 Photo' ELSE NULL END
          ) as last_message,
          (SELECT media_url FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_media_url,
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM messages WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = $1 AND photographer_id = b.photographer_id) AND sender_id != $1 AND read_at IS NULL)::int as unread_count
        FROM bookings b
        JOIN photographer_profiles pp ON pp.id = b.photographer_id
        JOIN users u ON u.id = pp.user_id
        LEFT JOIN packages p ON p.id = b.package_id
        WHERE b.client_id = $1
          AND (EXISTS (SELECT 1 FROM messages WHERE booking_id = b.id) OR b.status IN ('inquiry','pending','confirmed'))
        ORDER BY pp.user_id, COALESCE(
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1),
          b.created_at
        ) DESC`,
        [userId]
      );
      (conversations as Array<Record<string, unknown>>).sort((a, b) =>
        new Date(b.last_message_at as string || 0).getTime() - new Date(a.last_message_at as string || 0).getTime()
      );
    }

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("[conversations] error:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
