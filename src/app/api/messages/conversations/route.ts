import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    // Get user role from DB
    const user = await queryOne<{ role: string }>(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );

    let conversations;

    if (user?.role === "photographer") {
      const profile = await queryOne<{ id: string }>(
        "SELECT id FROM photographer_profiles WHERE user_id = $1",
        [userId]
      );
      if (!profile) return NextResponse.json([]);

      conversations = await query(
        `SELECT
          b.id as booking_id,
          u.name as other_name,
          u.avatar_url as other_avatar,
          u.id as other_user_id,
          b.status as booking_status,
          p.name as package_name,
          (SELECT text FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND sender_id != $1 AND read_at IS NULL)::int as unread_count
        FROM bookings b
        JOIN users u ON u.id = b.client_id
        LEFT JOIN packages p ON p.id = b.package_id
        WHERE b.photographer_id = $2
        ORDER BY COALESCE(
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1),
          b.created_at
        ) DESC`,
        [userId, profile.id]
      );
    } else {
      conversations = await query(
        `SELECT
          b.id as booking_id,
          pp.display_name as other_name,
          u.avatar_url as other_avatar,
          u.id as other_user_id,
          b.status as booking_status,
          p.name as package_name,
          (SELECT text FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND sender_id != $1 AND read_at IS NULL)::int as unread_count
        FROM bookings b
        JOIN photographer_profiles pp ON pp.id = b.photographer_id
        JOIN users u ON u.id = pp.user_id
        LEFT JOIN packages p ON p.id = b.package_id
        WHERE b.client_id = $1
        ORDER BY COALESCE(
          (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1),
          b.created_at
        ) DESC`,
        [userId]
      );
    }

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("[conversations] error:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
