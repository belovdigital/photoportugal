import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import {
  getBufferedBusyWindows,
  getPhotographerCalendarBufferMinutes,
  hasAvailableBookingStart,
  lisbonLocalMinutesToUtc,
} from "@/lib/booking-availability";

const BASE_URL = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

function toDateString(value: unknown) {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value || "").split("T")[0];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;
  const { id: bookingId } = await params;
  const { action, proposed_date: proposed_date_raw, proposed_date_coords, proposed_time, date_note } = await req.json();

  // Reconcile string vs raw click coords from the DatePicker. If the
  // two disagree, trust the coords and rebuild the string — protects
  // against the "I picked June but the booking says July" class of bug
  // where state-corruption between picker and submit shifts the date.
  // Logs the mismatch loudly so we can find the root cause.
  let proposed_date: string | null = null;
  {
    const raw = typeof proposed_date_raw === "string" ? proposed_date_raw : (proposed_date_raw == null ? null : String(proposed_date_raw));
    const c = proposed_date_coords as { year?: unknown; month?: unknown; day?: unknown } | null;
    if (c && typeof c.year === "number" && typeof c.month === "number" && typeof c.day === "number") {
      const rebuilt = `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
      if (raw && raw !== rebuilt) {
        console.error(`[propose-date] date MISMATCH: string="${raw}" coords=${JSON.stringify(c)} → using coords ("${rebuilt}"). booking=${bookingId} user=${userId}`);
      }
      proposed_date = rebuilt;
    } else {
      proposed_date = raw;
    }
  }

  // Get booking with both parties' info
  const booking = await queryOne<{
    id: string; status: string; client_id: string; photographer_id: string;
    shoot_date: string | null; shoot_time: string | null; proposed_date: string | null; proposed_by: string | null;
    duration_minutes: number | null;
    client_name: string; client_email: string;
    photographer_name: string; photographer_email: string; photographer_user_id: string;
  }>(
    `SELECT b.id, b.status, b.client_id, b.photographer_id,
            b.shoot_date, b.shoot_time, b.proposed_date, b.proposed_by,
            COALESCE(p.duration_minutes, 120) AS duration_minutes,
            cu.name as client_name, cu.email as client_email,
            pu.name as photographer_name, pu.email as photographer_email, pp.user_id as photographer_user_id
     FROM bookings b
     LEFT JOIN packages p ON p.id = b.package_id
     JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const currentBooking = booking;

  // Block date changes only for cancelled/completed/delivered bookings
  if (["cancelled", "completed", "delivered"].includes(currentBooking.status)) {
    return NextResponse.json({ error: "Cannot change date for this booking" }, { status: 400 });
  }

  // Determine who is making the request
  const isPhotographer = userId === currentBooking.photographer_user_id;
  const isClient = userId === currentBooking.client_id;
  if (!isPhotographer && !isClient) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  async function ensureBufferedAvailability(date: string, time: string | null | undefined) {
    const durationMin = currentBooking.duration_minutes || 120;
    const bufferMinutes = await getPhotographerCalendarBufferMinutes(currentBooking.photographer_id);
    const rangeStart = lisbonLocalMinutesToUtc(date, 0);
    const rangeEnd = lisbonLocalMinutesToUtc(date, 24 * 60 + durationMin + bufferMinutes);
    const busyWindows = await getBufferedBusyWindows(
      currentBooking.photographer_id,
      rangeStart,
      rangeEnd,
      bufferMinutes,
      currentBooking.id
    );
    return hasAvailableBookingStart(date, time, durationMin, busyWindows);
  }

  if (action === "propose") {
    if (!proposed_date) return NextResponse.json({ error: "Date required" }, { status: 400 });

    const proposedBy = isPhotographer ? "photographer" : "client";
    const nextTime = proposed_time || booking.shoot_time || "flexible";
    if (!(await ensureBufferedAvailability(proposed_date, nextTime))) {
      return NextResponse.json({
        error: "The photographer is busy around the proposed time. Please pick another date or time.",
        code: "calendar_conflict",
      }, { status: 400 });
    }

    await queryOne(
      `UPDATE bookings SET proposed_date = $1, proposed_by = $2, date_note = $3, proposed_time = $5, updated_at = NOW() WHERE id = $4 RETURNING id`,
      [proposed_date, proposedBy, date_note || null, bookingId, proposed_time || null]
    );

    // Insert a system message into the booking chat — the chat
    // renderer recognises the `DATE_PROPOSAL:{json}` prefix and shows
    // a rich card with Accept / Propose Different actions, so the
    // negotiation lives inside the conversation, not buried in email.
    let proposalMessageId: string | null = null;
    try {
      const proposalPayload = {
        proposed_date,
        proposed_time: proposed_time || null,
        proposed_by: proposedBy,
        sender_name: isPhotographer ? booking.photographer_name : booking.client_name,
        date_note: date_note || null,
      };
      const senderUserId = isPhotographer ? booking.photographer_user_id : booking.client_id;
      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [bookingId, senderUserId, `DATE_PROPOSAL:${JSON.stringify(proposalPayload)}`]
      );
      proposalMessageId = inserted?.id || null;
    } catch (chatErr) {
      console.error("[propose-date] chat message error:", chatErr);
    }

    // Notify the other party
    const recipientEmail = isPhotographer ? booking.client_email : booking.photographer_email;
    const recipientName = isPhotographer ? booking.client_name : booking.photographer_name;
    const senderName = isPhotographer ? booking.photographer_name : booking.client_name;
    const formattedDate = new Date(proposed_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const timeDisplay = proposed_time ? ` at ${proposed_time}` : "";

    await sendEmail(
      recipientEmail,
      `Date Change Proposed — ${senderName}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">New Date Proposed</h2>
        <p>Hi ${recipientName.split(" ")[0]},</p>
        <p><strong>${senderName}</strong> has proposed a new date for your photoshoot:</p>
        <div style="background: #FFF9F0; border: 1px solid #F0E6D6; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 18px; font-weight: bold; margin: 0;">${formattedDate}${timeDisplay}</p>
          ${date_note ? `<p style="color: #666; margin: 8px 0 0;">"${date_note}"</p>` : ""}
        </div>
        <p>You can accept this date or propose a different one.</p>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    ).catch(console.error);

    // Push notification to the other party — fires immediately. Cheap,
    // non-intrusive, and lets the photographer's mobile app pop a card
    // they can act on without leaving the chat.
    const recipientUserId = isPhotographer ? booking.client_id : booking.photographer_user_id;
    try {
      const { sendPushNotification } = await import("@/lib/push");
      sendPushNotification(
        recipientUserId,
        `📅 ${(senderName || "").split(" ")[0] || "Someone"} proposed a new date`,
        `${formattedDate}${timeDisplay}`.trim() || "Tap to view details.",
        { type: "date_proposal", bookingId, channelId: "bookings", categoryId: "BOOKING" }
      ).catch(() => {});
    } catch (pushErr) {
      console.error("[propose-date] push error:", pushErr);
    }

    // SMS — goes through the delayed queue (3-min hold, cancelled if
    // the recipient reads the chat / replies / is online / has the
    // mobile app installed). We anchor it to the system message we
    // just inserted so the cancel-on-read check looks at the right
    // row in `messages`.
    try {
      const recipientPhone = await queryOne<{ phone: string | null }>(
        "SELECT phone FROM users WHERE id = $1",
        [recipientUserId]
      );
      if (recipientPhone?.phone && proposalMessageId) {
        const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
          "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
          [recipientUserId]
        );
        if (smsPrefs?.sms_bookings !== false) {
          const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
          const { enqueueNewMessageNotif } = await import("@/lib/notification-queue");
          const rLocale = await getUserLocaleById(recipientUserId);
          const smsBody = pickT({
            en: `Photo Portugal: ${senderName} proposed a new date (${formattedDate}${timeDisplay}) for your photoshoot. Log in to respond.`,
            pt: `Photo Portugal: ${senderName} propôs uma nova data (${formattedDate}${timeDisplay}) para a sua sessão fotográfica. Inicie sessão para responder.`,
            de: `Photo Portugal: ${senderName} hat ein neues Datum (${formattedDate}${timeDisplay}) für Ihr Fotoshooting vorgeschlagen. Melden Sie sich an, um zu antworten.`,
            fr: `Photo Portugal : ${senderName} a proposé une nouvelle date (${formattedDate}${timeDisplay}) pour votre séance photo. Connectez-vous pour répondre.`,
          }, rLocale);
          await enqueueNewMessageNotif({
            recipientId: recipientUserId,
            recipient: recipientPhone.phone,
            messageId: proposalMessageId,
            bookingId,
            channel: "sms",
            body: smsBody,
          });
        }
      }
    } catch (smsErr) {
      console.error("[propose-date] sms error:", smsErr);
    }

    // Telegram notification to photographer (if they're the recipient)
    if (isClient) {
      import("@/lib/notify-photographer").then(m =>
        m.notifyPhotographerViaTelegram(booking.photographer_id, `📅 <b>New date proposed</b>\n\n${senderName} proposed: <b>${formattedDate}${timeDisplay}</b>${date_note ? `\nNote: "${date_note}"` : ""}\n\nAccept or propose another in your dashboard.`)
      ).catch((err) => console.error("[propose-date] telegram photographer error:", err));
    }

    return NextResponse.json({ success: true, action: "proposed" });
  }

  if (action === "accept") {
    // Accept the proposed date — update shoot_date, clear proposal
    if (!booking.proposed_date) return NextResponse.json({ error: "No date proposal to accept" }, { status: 400 });

    // Prevent self-accept: the person who proposed cannot accept their own proposal
    const proposerIsClient = booking.proposed_by === "client";
    const proposerIsPhotographer = booking.proposed_by === "photographer";
    if ((proposerIsClient && isClient) || (proposerIsPhotographer && isPhotographer)) {
      return NextResponse.json({ error: "You cannot accept your own date proposal" }, { status: 400 });
    }

    // Get proposed_time before clearing
    const proposalData = await queryOne<{ proposed_time: string | null }>(
      "SELECT proposed_time FROM bookings WHERE id = $1", [bookingId]
    );
    // Calendar guard on accept — only when CLIENT was the proposer.
    // If the PHOTOGRAPHER proposed the date, they implicitly committed
    // to it, and a later Google-Calendar sync that pulls in a personal
    // event must NOT silently block the client from accepting their
    // own proposal (the previous behaviour, which caused Dan ↔ Kristina
    // to see "Accept date" do nothing — busy slot got synced between
    // propose and accept). If the photographer is actually busy now,
    // it's on them to propose a different date.
    if (booking.proposed_by === "client") {
      if (!(await ensureBufferedAvailability(toDateString(booking.proposed_date), proposalData?.proposed_time || booking.shoot_time || "flexible"))) {
        return NextResponse.json({
          error: "The photographer is busy around the proposed time. Please pick another date or time.",
          code: "calendar_conflict",
        }, { status: 400 });
      }
    }

    await queryOne(
      `UPDATE bookings SET shoot_date = proposed_date, shoot_time = COALESCE(proposed_time, shoot_time), proposed_date = NULL, proposed_by = NULL, date_note = NULL, proposed_time = NULL, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [bookingId]
    );

    // Notify the proposer that their date was accepted
    const recipientEmail = isPhotographer ? booking.client_email : booking.photographer_email;
    const recipientName = isPhotographer ? booking.client_name : booking.photographer_name;
    const accepterName = isPhotographer ? booking.photographer_name : booking.client_name;
    const pdStr = toDateString(booking.proposed_date);
    const formattedDate = new Date(pdStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const acceptedTimeDisplay = proposalData?.proposed_time ? ` at ${proposalData.proposed_time}` : "";

    // Email to the proposer
    await sendEmail(
      recipientEmail,
      `Date Confirmed — ${formattedDate}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #22C55E;">Date Confirmed!</h2>
        <p>Hi ${recipientName.split(" ")[0]},</p>
        <p><strong>${accepterName}</strong> has accepted the proposed date:</p>
        <div style="background: #F0FFF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 18px; font-weight: bold; margin: 0; color: #166534;">${formattedDate}${acceptedTimeDisplay}</p>
        </div>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    ).catch(console.error);

    // SMS to the proposer
    try {
      const recipientUserId = isPhotographer ? booking.client_id : booking.photographer_user_id;
      const recipientPhone = await queryOne<{ phone: string | null }>(
        "SELECT phone FROM users WHERE id = $1", [recipientUserId]
      );
      if (recipientPhone?.phone) {
        const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
        const rLocale = await getUserLocaleById(recipientUserId);
        const smsBody = pickT({
          en: `Photo Portugal: Date confirmed! ${accepterName} accepted ${formattedDate}${acceptedTimeDisplay} for your photoshoot.`,
          pt: `Photo Portugal: Data confirmada! ${accepterName} aceitou ${formattedDate}${acceptedTimeDisplay} para a sua sessão fotográfica.`,
          de: `Photo Portugal: Termin bestätigt! ${accepterName} hat ${formattedDate}${acceptedTimeDisplay} für Ihr Fotoshooting akzeptiert.`,
          fr: `Photo Portugal : Date confirmée ! ${accepterName} a accepté ${formattedDate}${acceptedTimeDisplay} pour votre séance photo.`,
        }, rLocale);
        sendSMS(
          recipientPhone.phone,
          smsBody
        ).catch((err) => console.error("[propose-date] sms date confirmed error:", err));
      }
    } catch {}

    // Telegram to photographer (whether they proposed or accepted)
    import("@/lib/notify-photographer").then(m =>
      m.notifyPhotographerViaTelegram(booking.photographer_id, `✅ <b>Date confirmed!</b>\n\nSession with ${booking.client_name}: <b>${formattedDate}${acceptedTimeDisplay}</b>`)
    ).catch((err) => console.error("[propose-date] telegram date confirmed error:", err));

    return NextResponse.json({ success: true, action: "accepted" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
