import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendCancellationMessage } from "@/lib/booking-messages";

export const dynamic = "force-dynamic";

/**
 * Cancel an UNPAID booking. Either party (photographer or client) can do
 * this — paid bookings go through the refund/dispute flow instead.
 *
 * Body: { reason: string }  // required, 5-500 chars, free-text from
 *                              the canceller — surfaced to the other party
 *                              by email, to admins via Telegram, and into
 *                              the chat as a system message.
 *
 * Returns 200 + { success: true } on success.
 * Returns 400 with { code, error } on validation issues.
 * Returns 403 if the caller isn't the photographer or client of the booking.
 * Returns 409 if the booking is already paid (use refund flow) or already
 *   cancelled / completed (no-op).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { reason?: unknown } = {};
  try { body = await req.json(); } catch {}
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json({
      error: "Please tell the other side why — at least a few words.",
      code: "reason_required",
    }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({
      error: "Reason is too long (max 500 characters).",
      code: "reason_too_long",
    }, { status: 400 });
  }

  // Pull booking + parties + photographer slug for the email/Telegram payload.
  const booking = await queryOne<{
    id: string;
    status: string;
    payment_status: string;
    client_id: string;
    photographer_id: string;
    photographer_user_id: string;
    photographer_name: string;
    photographer_email: string;
    photographer_slug: string;
    client_name: string;
    client_email: string;
    shoot_date: string | null;
    total_price: string | null;
  }>(
    `SELECT b.id, b.status, b.payment_status, b.client_id, b.photographer_id,
            pu.id as photographer_user_id, pu.name as photographer_name,
            pu.email as photographer_email, pp.slug as photographer_slug,
            cu.name as client_name, cu.email as client_email,
            b.shoot_date, b.total_price::text
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.id = $1`,
    [id]
  );
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Authorisation: only the booking's photographer or client can cancel.
  const isPhotographer = booking.photographer_user_id === user.id;
  const isClient = booking.client_id === user.id;
  if (!isPhotographer && !isClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cancelledBy: "photographer" | "client" = isPhotographer ? "photographer" : "client";

  // State guards. Only unpaid + not-yet-cancelled bookings.
  if (booking.payment_status === "paid") {
    return NextResponse.json({
      error: "This booking is already paid — please request a refund or open a dispute instead.",
      code: "already_paid",
    }, { status: 409 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ success: true, alreadyCancelled: true });
  }
  if (booking.status === "completed" || booking.status === "delivered") {
    return NextResponse.json({
      error: "Cannot cancel a completed or delivered booking.",
      code: "already_completed",
    }, { status: 409 });
  }

  // Apply the cancellation.
  await queryOne(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW(),
         cancelled_by = $1, cancelled_reason = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
    [cancelledBy, reason, id]
  );

  // System message in the existing chat — fire-and-forget. Chat lives
  // independently of the booking lifecycle (booking_id is now ON DELETE
  // SET NULL, never CASCADE), so this message persists even if the
  // booking is later hard-deleted.
  sendCancellationMessage(id, cancelledBy, reason, user.id).catch(() => {});

  // Email the OTHER side with the reason, in plain language.
  import("@/lib/email").then(({ sendEmail, emailLayout, emailButton }) => {
    const recipientEmail = cancelledBy === "photographer" ? booking.client_email : booking.photographer_email;
    const cancellerName = cancelledBy === "photographer" ? booking.photographer_name : booking.client_name;
    const otherFirstName = (cancelledBy === "photographer" ? booking.client_name : booking.photographer_name).split(" ")[0] || "there";
    const dateLine = booking.shoot_date ? `<p style="margin:0 0 8px;color:#666;">Date: ${booking.shoot_date}</p>` : "";
    const priceLine = booking.total_price ? `<p style="margin:0 0 8px;color:#666;">Amount: €${Math.round(Number(booking.total_price))}</p>` : "";
    const subject = cancelledBy === "photographer"
      ? `Your booking with ${booking.photographer_name} was cancelled`
      : `${booking.client_name} cancelled their booking`;
    sendEmail(recipientEmail, subject,
      emailLayout(`
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${otherFirstName},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${cancellerName}</strong> cancelled the unpaid booking. Their reason:</p>
        <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #C94536;background:#FFF5F2;color:#4A4A4A;font-size:14px;line-height:1.5;font-style:italic;">${reason.replace(/[<>]/g, "")}</blockquote>
        ${dateLine}
        ${priceLine}
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4A4A4A;">If you'd like to reach out — the chat between you stays open.</p>
        ${emailButton(`https://photoportugal.com/dashboard/messages`, "Open conversation")}
      `)
    ).catch((e) => console.error("[bookings/cancel] email error:", e));
  }).catch(() => {});

  // Telegram admins — short structured ping with the full reason.
  import("@/lib/telegram").then(({ sendTelegram }) => {
    const role = cancelledBy === "photographer" ? "photographer" : "client";
    const dateText = booking.shoot_date ? ` · ${booking.shoot_date}` : "";
    const priceText = booking.total_price ? ` · €${Math.round(Number(booking.total_price))}` : "";
    sendTelegram(
      `❌ <b>Booking cancelled</b> (by ${role})\n\n${booking.client_name} ↔ ${booking.photographer_name}${dateText}${priceText}\n\nReason: <i>${reason.replace(/[<>]/g, "")}</i>`,
      "bookings"
    ).catch(() => {});
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
