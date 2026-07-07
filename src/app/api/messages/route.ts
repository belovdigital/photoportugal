import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { sendNewMessageNotification } from "@/lib/email";
import { detectContactInfo, detectSocialPlatform } from "@/lib/content-filter";
import { maskSurname } from "@/lib/photographer-name";

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

    // Load all messages in the conversation (client_id + photographer_id pair).
    // The legacy "WHERE booking_id IN (...)" subquery is replaced by a
    // direct lookup on the new conversation-scoped columns.
    const photographerIdRow = await queryOne<{ photographer_id: string }>(
      "SELECT photographer_id FROM bookings WHERE id = $1",
      [bookingId]
    );
    const photographerId = photographerIdRow?.photographer_id;

    const messages = await query(
      `SELECT m.id, m.text, m.media_url, m.sender_id, m.created_at, m.read_at,
              m.edited_at, m.deleted_at,
              m.detected_language, m.translated_text, m.translated_to_lang,
              u.name as sender_name, u.avatar_url as sender_avatar,
              COALESCE(m.is_system, FALSE) as is_system
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.client_id = $1 AND m.photographer_id = $2
       ORDER BY m.created_at ASC`,
      [booking.client_id, photographerId]
    );

    // Mark messages as read across the entire conversation
    await query(
      `UPDATE messages SET read_at = NOW()
        WHERE client_id = $1 AND photographer_id = $2
          AND sender_id != $3 AND read_at IS NULL`,
      [booking.client_id, photographerId, userId]
    );

    // Anti-disintermediation: when the CLIENT is viewing the thread, mask the
    // photographer's surname on the photographer's own messages until they
    // share a PAID booking (post-payment coordination keeps the full name).
    // The photographer viewing the thread always sees the client's full name.
    if (userId === booking.client_id) {
      const paid = await queryOne<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM bookings WHERE client_id = $1 AND photographer_id = $2 AND payment_status = 'paid') as exists`,
        [booking.client_id, photographerId]
      );
      if (!paid?.exists) {
        for (const m of messages as Array<Record<string, unknown>>) {
          if (m.sender_id === booking.photographer_user_id && typeof m.sender_name === "string") {
            m.sender_name = maskSurname(m.sender_name as string);
          }
        }
      }
    }

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

    // Resolve booking + conversation key (client_id, photographer_id).
    // Messages are conversation-scoped — booking_id is just the context
    // the user was viewing when they hit send. The pair drives all
    // subsequent reads/notifications.
    const booking = await queryOne<{
      client_id: string;
      photographer_user_id: string;
      status: string;
      payment_status: string | null;
      photographer_id: string;
      photographer_slug: string | null;
      photographer_name: string;
      client_name: string;
      occasion: string | null;
      client_sms_opt_in: boolean;
    }>(
      `SELECT b.client_id, u.id as photographer_user_id, b.status, b.payment_status,
              b.photographer_id, pp.slug as photographer_slug,
              u.name as photographer_name,
              cu.name as client_name,
              b.occasion, COALESCE(b.client_sms_opt_in, false) AS client_sms_opt_in
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN users cu ON cu.id = b.client_id
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

    const message = await queryOne<{ id: string; created_at: string; media_url: string | null }>(
      `INSERT INTO messages (booking_id, sender_id, text, media_url, client_id, photographer_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at, media_url`,
      [booking_id, userId, text?.trim() || null, media_url || null, booking.client_id, booking.photographer_id]
    );

    // Fire-and-forget: translate the message into the recipient's UI locale
    // (en/pt). Skips short / system / BOOKING_CARD payloads. Failure is
    // silent — original `text` is always rendered as fallback.
    if (text?.trim() && message) {
      const msgId = (message as any).id as string;
      void (async () => {
        try {
          const { translateMessageRow, getRecipientLocale } = await import("@/lib/chat-translate");
          const recipientLocale = await getRecipientLocale(userId, booking.client_id, booking.photographer_id);
          if (!recipientLocale) return;
          await translateMessageRow({
            message_id: msgId,
            text: text!.trim(),
            is_system: false,
            recipient_locale: recipientLocale,
          });
          // Tell live clients the row got updated so they can re-fetch.
          await queryOne(
            "SELECT pg_notify('message_updated', $1)",
            [JSON.stringify({ booking_id, message_id: msgId, client_id: booking.client_id, photographer_id: booking.photographer_id })]
          );
        } catch (err) {
          console.error("[messages] translate fire-and-forget error:", err);
        }
      })();
    }

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

    // Admin Telegram alert: photographer shared phone/email/messaging-app
    // mention BEFORE the booking was paid → likely trying to bypass the
    // platform fee. We only flag photographer → client side; client may
    // legitimately share their own contact.
    if (
      text?.trim() &&
      userId === booking.photographer_user_id &&
      booking.payment_status !== "paid"
    ) {
      const isInternalLink = /photoportugal\.com/i.test(text);
      if (!isInternalLink) {
        const contactType = detectContactInfo(text);
        // Only alert on real contact-share signals — not URLs (photographer
        // may share a portfolio link) or generic social handles (handled
        // separately by detectSocialPlatform earlier).
        if (
          contactType === "email address" ||
          contactType === "phone number" ||
          contactType === "messaging app reference"
        ) {
          try {
            const { sendTelegram } = await import("@/lib/telegram");
            const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const preview = text.trim().length > 280 ? text.trim().slice(0, 280) + "…" : text.trim();
            const profileLink = booking.photographer_slug
              ? `https://photoportugal.com/photographers/${booking.photographer_slug}`
              : null;
            const lines = [
              `🚨 <b>Possible off-platform attempt</b> — photographer shared <b>${esc(contactType)}</b> BEFORE payment`,
              ``,
              `<b>Photographer:</b> ${esc(booking.photographer_name)}${profileLink ? ` (<a href="${profileLink}">profile</a>)` : ""}`,
              `<b>Client:</b> ${esc(booking.client_name || "—")}`,
              `<b>Booking status:</b> ${esc(booking.status)} · <b>payment:</b> ${esc(booking.payment_status || "unpaid")}`,
              ``,
              `<b>Message:</b>`,
              `<i>"${esc(preview)}"</i>`,
              ``,
              `<a href="https://photoportugal.com/admin?tab=bookings&booking=${booking_id}">Open booking in admin →</a>`,
            ];
            sendTelegram(lines.join("\n"), "alerts").catch(() => {});
          } catch (alertErr) {
            console.error("[messages] off-platform alert error:", alertErr);
          }
        }
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

    // Recipient may have deactivated/deleted their account. Their email
    // is preserved but login is blocked and they'll never read it — and
    // historically a deleted account's email was a dead domain that just
    // bounced. Skip ALL recipient-facing notifications (email + push) in
    // that case. The admin Telegram line above still fires so we can see
    // the orphaned inbound message and reach out to the client ourselves.
    const recipientGone = await queryOne<{ gone: boolean }>(
      "SELECT (COALESCE(is_banned, false) OR deactivated_at IS NOT NULL) AS gone FROM users WHERE id = $1",
      [userId === booking.client_id ? booking.photographer_user_id : booking.client_id]
    );

    // Send email notification to the other person (if they have it enabled, throttled to 1 per 15 min)
    try {
      const recipientId = userId === booking.client_id ? booking.photographer_user_id : booking.client_id;
      const prefs = recipientGone?.gone ? { email_messages: false } : await queryOne<{ email_messages: boolean }>(
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
            // Queue with a 3-min delay; the cron worker re-checks before
            // delivery and silently cancels if the recipient already
            // read / replied / came online. No more "I got an email
            // about a message I already responded to 30 sec ago".
            const { enqueueNewMessageNotif } = await import("@/lib/notification-queue");
            // Anti-disintermediation: if the sender is the photographer and the
            // recipient (client) hasn't paid yet, mask the photographer surname
            // in the notification ("Jennifer D."). Client->photographer emails
            // show the client's full name unchanged.
            const senderIsPhotographer = userId === booking.photographer_user_id;
            const senderDisplay = senderIsPhotographer && booking.payment_status !== "paid"
              ? maskSurname(sender.name)
              : sender.name;
            await enqueueNewMessageNotif({
              recipientId,
              recipient: recipient.email,
              messageId: message!.id,
              bookingId: booking_id,
              channel: "email",
              subject: `New message from ${senderDisplay} — Photo Portugal`,
              body: `You've got a new message from ${senderDisplay} about your Photo Portugal booking.`,
            });
          }
        }
      }

      // Push notification to recipient. Title = sender name (so the lock
      // screen shows "💬 Maria" the way iMessage/WhatsApp do, not a generic
      // "New Message"). Body = the message content itself, no "Maria:"
      // prefix needed because the name is already the title. threadId
      // groups multiple messages from the same conversation on iOS.
      const senderRow = await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]);
      const senderName = senderRow?.name?.split(" ")[0] || "Someone";
      const pushBody = text?.trim()
        ? text.trim().slice(0, 140)
        : media_url
          ? "📷 sent a photo"
          : "sent a message";
      if (!recipientGone?.gone) {
        import("@/lib/push").then(m =>
          m.sendPushNotification(
            recipientId,
            `💬 ${senderName}`,
            pushBody,
            {
              type: "message",
              bookingId: booking_id,
              threadId: `chat:${booking.client_id}:${booking.photographer_id}`,
              channelId: "messages",
              categoryId: "MESSAGE",
            }
          )
        ).catch((err) => console.error("[messages] push notification error:", err));
      }
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

      // Surprise-proposal discretion: never SMS the CLIENT on a proposal
      // booking by default — a "New message from <photographer>" SMS on
      // their lock screen could blow the surprise if their partner sees
      // it. They still get email + in-app. The client can opt back in
      // from the booking (sets client_sms_opt_in). Photographer-side SMS
      // is unaffected (they're not the surprise target).
      const proposalDiscretionSkip =
        recipientId === booking.client_id &&
        !booking.client_sms_opt_in &&
        !!booking.occasion && /proposal/i.test(booking.occasion);

      // SMS — go through the delayed queue (3-min hold, cancelled if
      // recipient reads / replies / is online / has the app installed).
      try {
        const recipientInfo = proposalDiscretionSkip ? null : await queryOne<{ phone: string | null }>(
          "SELECT phone FROM users WHERE id = $1", [recipientId]
        );
        if (recipientInfo?.phone) {
          const { enqueueNewMessageNotif } = await import("@/lib/notification-queue");
          const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
          const senderName = (await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]))?.name?.split(" ")[0] || "Someone";
          const rLocale = await getUserLocaleById(recipientId);
          const smsBody = pickT({
            en: `Photo Portugal: New message from ${senderName}. Reply: https://photoportugal.com/dashboard/messages`,
            pt: `Photo Portugal: Nova mensagem de ${senderName}. Responda: https://photoportugal.com/dashboard/messages`,
            de: `Photo Portugal: Neue Nachricht von ${senderName}. Antworten: https://photoportugal.com/dashboard/messages`,
            fr: `Photo Portugal : Nouveau message de ${senderName}. Répondre : https://photoportugal.com/dashboard/messages`,
          }, rLocale);
          await enqueueNewMessageNotif({
            recipientId,
            recipient: recipientInfo.phone,
            messageId: message!.id,
            bookingId: booking_id,
            channel: "sms",
            body: smsBody,
          });
        }
      } catch (smsErr) {
        console.error("[messages] enqueue SMS error:", smsErr);
      }
    } catch {}

    return NextResponse.json({ success: true, message, warning: contactWarning });
  } catch (error) {
    console.error("[messages] send error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/messages", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
