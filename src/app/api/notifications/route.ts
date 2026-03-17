import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ unread_messages: 0, pending_bookings: 0 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    // Update last seen + get role
    const user = await queryOne<{ role: string }>(
      "UPDATE users SET last_seen_at = NOW() WHERE id = $1 RETURNING role",
      [userId]
    );

    let unreadMessages = 0;
    let pendingBookings = 0;

    if (user?.role === "photographer") {
      const profile = await queryOne<{ id: string }>(
        "SELECT id FROM photographer_profiles WHERE user_id = $1",
        [userId]
      );

      if (profile) {
        // Unread messages for photographer
        const msgResult = await queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM messages m
           JOIN bookings b ON b.id = m.booking_id
           WHERE b.photographer_id = $1 AND m.sender_id != $2 AND m.read_at IS NULL`,
          [profile.id, userId]
        );
        unreadMessages = parseInt(msgResult?.count || "0");

        // Pending bookings
        const bookResult = await queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1 AND status = 'pending'",
          [profile.id]
        );
        pendingBookings = parseInt(bookResult?.count || "0");
      }
    } else {
      // Unread messages for client
      const msgResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages m
         JOIN bookings b ON b.id = m.booking_id
         WHERE b.client_id = $1 AND m.sender_id != $1 AND m.read_at IS NULL`,
        [userId]
      );
      unreadMessages = parseInt(msgResult?.count || "0");
    }

    return NextResponse.json({ unread_messages: unreadMessages, pending_bookings: pendingBookings });
  } catch {
    return NextResponse.json({ unread_messages: 0, pending_bookings: 0 });
  }
}
