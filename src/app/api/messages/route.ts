import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { sendNewMessageNotification } from "@/lib/email";
import { detectContactInfo } from "@/lib/content-filter";

// Get messages for a booking
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const bookingId = req.nextUrl.searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  }

  try {
    // Verify user is part of this booking
    const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
      `SELECT b.client_id, u.id as photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const messages = await query(
      `SELECT m.id, m.text, m.media_url, m.sender_id, m.created_at, m.read_at,
              u.name as sender_name, u.avatar_url as sender_avatar,
              COALESCE(m.is_system, FALSE) as is_system
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );

    // Mark messages as read
    await query(
      "UPDATE messages SET read_at = NOW() WHERE booking_id = $1 AND sender_id != $2 AND read_at IS NULL",
      [bookingId, userId]
    );

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[messages] get error:", error);
    return NextResponse.json({ error: "Failed to get messages" }, { status: 500 });
  }
}

// Send a message
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    const { booking_id, text, media_url } = await req.json();

    if (!booking_id || (!text?.trim() && !media_url)) {
      return NextResponse.json({ error: "booking_id and text or media_url required" }, { status: 400 });
    }

    // Check for contact info sharing — soft warning, still send
    let contactWarning: string | null = null;
    if (text?.trim()) {
      const contactType = detectContactInfo(text);
      if (contactType) {
        // Allow photoportugal.com links
        const isInternalLink = /photoportugal\.com/i.test(text);
        if (!isInternalLink) {
          contactWarning = `For your safety, we recommend keeping all communication on Photo Portugal. Sharing ${contactType}s may put your booking protection at risk.`;
        }
      }
    }

    // Verify user is part of this booking
    const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
      `SELECT b.client_id, u.id as photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`,
      [booking_id]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const message = await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, media_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, media_url`,
      [booking_id, userId, text?.trim() || null, media_url || null]
    );

    // Send email notification to the other person (if they have it enabled)
    try {
      const recipientId = userId === booking.client_id ? booking.photographer_user_id : booking.client_id;
      const prefs = await queryOne<{ email_messages: boolean }>(
        "SELECT email_messages FROM notification_preferences WHERE user_id = $1",
        [recipientId]
      );
      // Default to true if no preferences set
      if (prefs?.email_messages !== false) {
        const recipient = await queryOne<{ email: string; name: string }>(
          "SELECT email, name FROM users WHERE id = $1", [recipientId]
        );
        const sender = await queryOne<{ name: string }>(
          "SELECT name FROM users WHERE id = $1", [userId]
        );
        if (recipient && sender) {
          sendNewMessageNotification(recipient.email, recipient.name, sender.name);
        }
      }

      // Throttled SMS for pending bookings (max once per 10 min per recipient)
      if (booking.status === "pending") {
        try {
          const recipientInfo = await queryOne<{ phone: string | null; last_message_sms_at: string | null }>(
            "SELECT phone, last_message_sms_at FROM users WHERE id = $1", [recipientId]
          );
          if (recipientInfo?.phone) {
            const lastSms = recipientInfo.last_message_sms_at ? new Date(recipientInfo.last_message_sms_at).getTime() : 0;
            const tenMinAgo = Date.now() - 10 * 60 * 1000;
            if (lastSms < tenMinAgo) {
              const { sendSMS } = await import("@/lib/sms");
              const senderName = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]))?.name?.split(" ")[0] || "Someone";
              sendSMS(recipientInfo.phone, `Photo Portugal: New message from ${senderName}. Open your dashboard to reply: https://photoportugal.com/dashboard/messages`);
              await queryOne("UPDATE users SET last_message_sms_at = NOW() WHERE id = $1", [recipientId]);
            }
          }
        } catch (smsErr) {
          console.error("[messages] throttled SMS error:", smsErr);
        }
      }
    } catch {}

    return NextResponse.json({ success: true, message, warning: contactWarning });
  } catch (error) {
    console.error("[messages] send error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
