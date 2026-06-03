import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendEmail, sendAdminNewInquiryNotification } from "@/lib/email";
import { sendSMS } from "@/lib/sms";

const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { photographer_id, message } = await req.json();

    if (!photographer_id || !message?.trim()) {
      return NextResponse.json({ error: "Photographer and message required" }, { status: 400 });
    }

    // Check photographer exists and is approved
    const photographer = await queryOne<{ id: string; is_approved: boolean; user_id: string }>(
      "SELECT id, is_approved, user_id FROM photographer_profiles WHERE id = $1",
      [photographer_id]
    );
    if (!photographer || !photographer.is_approved) {
      return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
    }
    if (photographer.user_id === userId) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }

    // Check if there's already a booking of ANY status between these two —
    // conversation list is conversation-scoped (see /api/messages/
    // conversations), so even cancelled/completed bookings should re-use
    // their existing thread instead of spawning a parallel inquiry row.
    // Previously this filter was `('inquiry','pending','confirmed')`,
    // which silently created parallel inquiries after a shoot completed
    // — confusing both sides.
    const existing = await queryOne<{ id: string }>(
      `SELECT b.id FROM bookings b
       WHERE b.client_id = $1 AND b.photographer_id = $2
       ORDER BY b.created_at DESC LIMIT 1`,
      [userId, photographer_id]
    );

    let bookingId: string;
    const isNewInquiry = !existing;

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

    // Insert the typed message regardless of whether this is a new
    // inquiry or a follow-up on an existing thread. Previously the
    // existing-thread branch returned early here, silently dropping
    // whatever the visitor typed — so they thought they had sent a
    // message that never landed in chat.
    await queryOne(
      "INSERT INTO messages (booking_id, sender_id, text) VALUES ($1, $2, $3) RETURNING id",
      [bookingId, userId, message.trim()]
    );

    // Concierge attribution: if this inquiry came from a concierge
    // recommendation, stamp message_started_at on the matching rec event
    // AND backfill bookings.concierge_chat_id so the Stripe webhook can
    // later hop straight to the chat without re-running this join.
    // Fire-and-forget — telemetry must never block the inquiry path.
    const userIdForAttribution = userId;
    const photographerIdForAttribution = photographer_id;
    const bookingIdForAttribution = bookingId;
    void (async () => {
      try {
        const recent = await queryOne<{ id: string }>(
          `SELECT cc.id FROM concierge_chats cc
             JOIN concierge_recommendation_events r ON r.chat_id = cc.id
            WHERE cc.user_id = $1
              AND r.photographer_id = $2
              AND r.shown_at >= NOW() - INTERVAL '14 days'
            ORDER BY r.shown_at DESC LIMIT 1`,
          [userIdForAttribution, photographerIdForAttribution]
        );
        if (recent?.id) {
          const { markMessageStarted } = await import("@/lib/concierge/recommendation-events");
          await markMessageStarted(recent.id, photographerIdForAttribution);
          await queryOne(
            "UPDATE bookings SET concierge_chat_id = COALESCE(concierge_chat_id, $1) WHERE id = $2 RETURNING id",
            [recent.id, bookingIdForAttribution]
          ).catch(() => null);
        }
      } catch (err) {
        console.error("[inquiries] concierge attribution failed:", err);
      }
    })();

    // Get sender and recipient info
    const sender = await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]);
    const recipient = await queryOne<{ email: string; name: string; phone: string | null }>(
      "SELECT email, name, phone FROM users WHERE id = $1", [photographer.user_id]
    );
    const prefs = await queryOne<{ email_messages: boolean; sms_bookings: boolean }>(
      "SELECT email_messages, sms_bookings FROM notification_preferences WHERE user_id = $1",
      [photographer.user_id]
    );

    if (recipient && sender) {
      const senderName = sender.name;
      const msgPreview = message.trim().length > 200 ? message.trim().slice(0, 200) + "..." : message.trim();

      // Email notification
      if (prefs?.email_messages !== false) {
        sendEmail(
          recipient.email,
          isNewInquiry ? `New inquiry from ${senderName}` : `New message from ${senderName}`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">${isNewInquiry ? "New Inquiry" : "New Message"}</h2>
            <p>Hi ${recipient.name.split(" ")[0]},</p>
            <p><strong>${senderName}</strong> ${isNewInquiry ? "sent you an inquiry" : "sent you a message"}:</p>
            <div style="background: #FFF9F0; border: 1px solid #F0E6D6; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="color: #333; margin: 0; font-style: italic;">"${msgPreview}"</p>
            </div>
            <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reply Now</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch(err => console.error("[inquiry] email error:", err));
      }

      // SMS notification (for new inquiries only, to avoid spam on follow-up messages)
      if (isNewInquiry && recipient.phone && prefs?.sms_bookings !== false) {
        sendSMS(
          recipient.phone,
          `Photo Portugal: New inquiry from ${senderName}. Log in to reply: ${BASE_URL}/dashboard/messages`
        ).catch(err => console.error("[inquiry] sms error:", err));
      }

      // Telegram notification to photographer
      import("@/lib/notify-photographer").then(m =>
        m.notifyPhotographerViaTelegram(
          photographer.id,
          `💬 <b>${isNewInquiry ? "New Inquiry" : "New Message"}</b>\n\nFrom: <b>${senderName}</b>\n"${msgPreview}"\n\nReply in your dashboard.`
        )
      ).catch((err) => console.error("[inquiries] telegram photographer error:", err));

      // Admin notifications (new inquiries only)
      if (isNewInquiry) {
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`💬 <b>New Inquiry</b>\n\n<b>Client:</b> ${senderName}\n<b>Photographer:</b> ${recipient!.name}\n\n"${msgPreview}"\n\n<a href="https://photoportugal.com/admin">Open Admin →</a>`, "clients");
        }).catch((err) => console.error("[inquiries] telegram admin error:", err));
        sendAdminNewInquiryNotification(senderName, recipient!.name, msgPreview)
          .catch((err) => console.error("[inquiries] admin email error:", err));
      }
    }

    return NextResponse.json({ success: true, booking_id: bookingId });
  } catch (error) {
    console.error("[inquiries] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/inquiries", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
