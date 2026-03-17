import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { sendNewMessageNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    const { photographer_id, message } = await req.json();

    if (!photographer_id || !message?.trim()) {
      return NextResponse.json({ error: "Photographer and message required" }, { status: 400 });
    }

    // Check photographer exists and is approved
    const photographer = await queryOne<{ is_approved: boolean; user_id: string }>(
      "SELECT is_approved, user_id FROM photographer_profiles WHERE id = $1",
      [photographer_id]
    );
    if (!photographer || !photographer.is_approved) {
      return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
    }
    if (photographer.user_id === userId) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }

    // Check if there's already an inquiry/booking between these two
    const existing = await queryOne<{ id: string }>(
      `SELECT b.id FROM bookings b
       WHERE b.client_id = $1 AND b.photographer_id = $2 AND b.status IN ('inquiry', 'pending', 'confirmed')
       ORDER BY b.created_at DESC LIMIT 1`,
      [userId, photographer_id]
    );

    let bookingId: string;

    if (existing) {
      bookingId = existing.id;
    } else {
      // Create inquiry booking
      const booking = await queryOne<{ id: string }>(
        `INSERT INTO bookings (client_id, photographer_id, status) VALUES ($1, $2, 'inquiry') RETURNING id`,
        [userId, photographer_id]
      );
      bookingId = booking!.id;
    }

    // Send the message
    await queryOne(
      "INSERT INTO messages (booking_id, sender_id, text) VALUES ($1, $2, $3) RETURNING id",
      [bookingId, userId, message.trim()]
    );

    // Email notification
    try {
      const prefs = await queryOne<{ email_messages: boolean }>(
        "SELECT email_messages FROM notification_preferences WHERE user_id = $1",
        [photographer.user_id]
      );
      if (prefs?.email_messages !== false) {
        const recipient = await queryOne<{ email: string; name: string }>(
          "SELECT email, name FROM users WHERE id = $1", [photographer.user_id]
        );
        const sender = await queryOne<{ name: string }>(
          "SELECT name FROM users WHERE id = $1", [userId]
        );
        if (recipient && sender) {
          sendNewMessageNotification(recipient.email, recipient.name, sender.name);
        }
      }
    } catch {}

    return NextResponse.json({ success: true, booking_id: bookingId });
  } catch (error) {
    console.error("[inquiries] error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
