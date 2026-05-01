import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { sendNewMessageNotification } from "@/lib/email";
import { detectContactInfo, detectSocialPlatform } from "@/lib/content-filter";

// Get messages for a booking
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
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

    // Load messages from ALL bookings between these two users (merged conversation)
    const messages = await query(
      `SELECT m.id, m.text, m.media_url, m.sender_id, m.created_at, m.read_at,
              u.name as sender_name, u.avatar_url as sender_avatar,
              COALESCE(m.is_system, FALSE) as is_system
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.booking_id IN (
         SELECT b2.id FROM bookings b2
         WHERE b2.client_id = $2 AND b2.photographer_id = (SELECT photographer_id FROM bookings WHERE id = $1)
       )
       ORDER BY m.created_at ASC`,
      [bookingId, booking.client_id]
    );

    // Mark messages as read across all bookings between these users
    await query(
      `UPDATE messages SET read_at = NOW() WHERE booking_id IN (
         SELECT b2.id FROM bookings b2
         WHERE b2.client_id = $2 AND b2.photographer_id = (SELECT photographer_id FROM bookings WHERE id = $1)
       ) AND sender_id != $3 AND read_at IS NULL`,
      [bookingId, booking.client_id, userId]
    );

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[messages] get error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/messages", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to get messages" }, { status: 500 });
  }
}

// Send a message
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { booking_id, text, media_url } = await req.json();

    if (!booking_id || (!text?.trim() && !media_url)) {
      return NextResponse.json({ error: "booking_id and text or media_url required" }, { status: 400 });
    }

    if (text && text.length > 10000) {
      return NextResponse.json({ error: "Message is too long, please shorten it" }, { status: 400 });
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
    const booking = await queryOne<{ client_id: string; photographer_user_id: string; status: string }>(
      `SELECT b.client_id, u.id as photographer_user_id, b.status
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

    // Check for social media platform mentions (Instagram/Facebook)
    if (text?.trim()) {
      const senderRole = userId === booking.client_id ? "client" : "photographer";
      const socialPlatform = detectSocialPlatform(text, senderRole);

      if (socialPlatform && senderRole === "client") {
        // BLOCK the message for clients
        return NextResponse.json({
          error: "social_platform_blocked",
          warning: `Photo Portugal is a curated platform where every photographer is personally vetted for quality, reliability, and professionalism. Our photographers' profiles include portfolios, verified reviews, pricing, and all the information you need to make the right choice.\n\nTo protect both you and the photographer, all communication and bookings must stay on the platform. Contacting or booking photographers outside Photo Portugal may result in a permanent ban for the photographer.\n\nIf you have any questions, our support team is happy to help!`,
        }, { status: 400 });
      }

      if (socialPlatform && senderRole === "photographer") {
        // Let the message through but add a system warning after it
        // (handled below after message insert)
        contactWarning = `⚠️ Reminder: sharing social media handles or directing clients off-platform is against Photo Portugal's terms. Repeated violations may result in account suspension.`;
      }
    }

    const message = await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, media_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, media_url`,
      [booking_id, userId, text?.trim() || null, media_url || null]
    );

    // Insert system warning if photographer shared social media
    if (contactWarning && text?.trim()) {
      const socialPlatform = detectSocialPlatform(text, "photographer");
      if (socialPlatform) {
        await queryOne(
          `INSERT INTO messages (booking_id, sender_id, text, is_system)
           VALUES ($1, $2, $3, TRUE)`,
          [booking_id, userId, "⚠️ Reminder: Please keep all communication on Photo Portugal. Sharing social media handles or directing clients off-platform is against our terms and may result in account suspension."]
        );
      }
    }

    // Notify WebSocket server via PostgreSQL
    try {
      const senderInfo = await queryOne<{ name: string; avatar_url: string | null }>(
        "SELECT name, avatar_url FROM users WHERE id = $1", [userId]
      );
      await queryOne("SELECT pg_notify('new_message', $1)", [
        JSON.stringify({
          booking_id,
          message: {
            id: (message as any).id,
            text: text?.trim() || null,
            media_url: (message as any).media_url || null,
            sender_id: userId,
            sender_name: senderInfo?.name || "",
            sender_avatar: senderInfo?.avatar_url || null,
            created_at: (message as any).created_at,
            read_at: null,
            is_system: false,
          },
        }),
      ]);
    } catch {}

    // Telegram notification to Messages topic
    try {
      const senderName = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]))?.name || "Unknown";
      const recipientId = userId === booking.client_id ? booking.photographer_user_id : booking.client_id;
      const recipientName = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [recipientId]))?.name || "Unknown";
      const msgPreview = text?.trim() || (media_url ? "[photo]" : "");
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`💬 <b>${senderName}</b> → ${recipientName}\n\n${msgPreview.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`, "messages");
      }).catch(() => {});
    } catch {}

    // Send email notification to the other person (if they have it enabled, throttled to 1 per 15 min)
    try {
      const recipientId = userId === booking.client_id ? booking.photographer_user_id : booking.client_id;
      const prefs = await queryOne<{ email_messages: boolean }>(
        "SELECT email_messages FROM notification_preferences WHERE user_id = $1",
        [recipientId]
      );
      // Default to true if no preferences set
      if (prefs?.email_messages !== false) {
        const recipient = await queryOne<{ email: string; name: string; last_seen_at: string | null }>(
          "SELECT email, name, last_seen_at FROM users WHERE id = $1", [recipientId]
        );
        const sender = await queryOne<{ name: string }>(
          "SELECT name FROM users WHERE id = $1", [userId]
        );
        if (recipient && sender) {
          // Skip if recipient is online (last seen < 5 min ago)
          const isOnline = recipient.last_seen_at && (Date.now() - new Date(recipient.last_seen_at).getTime()) < 5 * 60 * 1000;
          // Throttle: only send if no email sent to this recipient in last 1 hour
          const recentEmail = !isOnline && await queryOne(
            `SELECT id FROM notification_logs
             WHERE channel = 'email' AND recipient = $1 AND event LIKE '%New message%'
             AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
            [recipient.email]
          );
          if (!isOnline && !recentEmail) {
            sendNewMessageNotification(recipient.email, recipient.name, sender.name);
            // Log for throttling
            try {
              const { logNotification } = await import("@/lib/notification-log");
              logNotification("email", recipient.email, `New messages from ${sender.name}`, "sent");
            } catch {}
          }
        }
      }

      // Push notification to recipient
      const senderName = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]))?.name?.split(" ")[0] || "Someone";
      import("@/lib/push").then(m =>
        m.sendPushNotification(
          recipientId,
          "New Message",
          `${senderName}: ${text?.trim().slice(0, 50) || "sent a photo"}`,
          { type: "message", bookingId: booking_id }
        )
      ).catch((err) => console.error("[messages] push notification error:", err));
      // Real-time conversation list refresh on the recipient's other
      // open clients (mobile + web tabs).
      import("@/lib/realtime").then((m) =>
        m.notifyUser(recipientId, "new_message", { bookingId: booking_id })
      );

      // Telegram notification to photographer (when sender is client)
      if (userId === booking.client_id) {
        try {
          const photographerProfile = await queryOne<{ id: string }>(
            `SELECT pp.id FROM photographer_profiles pp
             JOIN bookings b ON b.photographer_id = pp.id
             WHERE b.id = $1`, [booking_id]
          );
          if (photographerProfile) {
            const senderFirst = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]))?.name?.split(" ")[0] || "A client";
            import("@/lib/notify-photographer").then(m =>
              m.notifyPhotographerViaTelegram(
                photographerProfile.id,
                `New message from ${senderFirst}\n\nView: https://photoportugal.com/dashboard/messages`
              )
            ).catch((err) => console.error("[messages] telegram photographer error:", err));
          }
        } catch {}
      }

      // Throttled WhatsApp/SMS for pending bookings (max once per 10 min per recipient)
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
              const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
              const senderName = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]))?.name?.split(" ")[0] || "Someone";
              const rLocale = await getUserLocaleById(recipientId);
              const smsBody = pickT({
                en: `Photo Portugal: New message from ${senderName}. Open your dashboard to reply: https://photoportugal.com/dashboard/messages`,
                pt: `Photo Portugal: Nova mensagem de ${senderName}. Abra o seu painel para responder: https://photoportugal.com/dashboard/messages`,
                de: `Photo Portugal: Neue Nachricht von ${senderName}. Öffnen Sie Ihr Dashboard, um zu antworten: https://photoportugal.com/dashboard/messages`,
                fr: `Photo Portugal : Nouveau message de ${senderName}. Ouvrez votre tableau de bord pour répondre : https://photoportugal.com/dashboard/messages`,
              }, rLocale);
              sendSMS(recipientInfo.phone, smsBody);
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
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/messages", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
