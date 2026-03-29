import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

const BASE_URL = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { id: bookingId } = await params;
  const { action, proposed_date, date_note } = await req.json();

  // Get booking with both parties' info
  const booking = await queryOne<{
    id: string; status: string; client_id: string; photographer_id: string;
    shoot_date: string | null; proposed_date: string | null; proposed_by: string | null;
    client_name: string; client_email: string;
    photographer_name: string; photographer_email: string; photographer_user_id: string;
  }>(
    `SELECT b.id, b.status, b.client_id, b.photographer_id,
            b.shoot_date, b.proposed_date, b.proposed_by,
            cu.name as client_name, cu.email as client_email,
            pu.name as photographer_name, pu.email as photographer_email, pp.user_id as photographer_user_id
     FROM bookings b
     JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Only pending/inquiry bookings can have date negotiation
  if (!["pending", "inquiry"].includes(booking.status)) {
    return NextResponse.json({ error: "Date can only be changed for pending bookings" }, { status: 400 });
  }

  // Determine who is making the request
  const isPhotographer = userId === booking.photographer_user_id;
  const isClient = userId === booking.client_id;
  if (!isPhotographer && !isClient) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  if (action === "propose") {
    if (!proposed_date) return NextResponse.json({ error: "Date required" }, { status: 400 });

    const proposedBy = isPhotographer ? "photographer" : "client";

    await queryOne(
      `UPDATE bookings SET proposed_date = $1, proposed_by = $2, date_note = $3, updated_at = NOW() WHERE id = $4 RETURNING id`,
      [proposed_date, proposedBy, date_note || null, bookingId]
    );

    // Notify the other party
    const recipientEmail = isPhotographer ? booking.client_email : booking.photographer_email;
    const recipientName = isPhotographer ? booking.client_name : booking.photographer_name;
    const senderName = isPhotographer ? booking.photographer_name : booking.client_name;
    const formattedDate = new Date(proposed_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    await sendEmail(
      recipientEmail,
      `Date Change Proposed — ${senderName}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">New Date Proposed</h2>
        <p>Hi ${recipientName.split(" ")[0]},</p>
        <p><strong>${senderName}</strong> has proposed a new date for your photoshoot:</p>
        <div style="background: #FFF9F0; border: 1px solid #F0E6D6; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 18px; font-weight: bold; margin: 0;">${formattedDate}</p>
          ${date_note ? `<p style="color: #666; margin: 8px 0 0;">"${date_note}"</p>` : ""}
        </div>
        <p>You can accept this date or propose a different one.</p>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    ).catch(console.error);

    // SMS to the other party.
    // NOTE: This SMS is intentionally NOT idempotent — each date proposal is a distinct
    // user action, so sending one SMS per proposal is correct behavior.
    try {
      const recipientUserId = isPhotographer ? booking.client_id : booking.photographer_user_id;
      const recipientPhone = await queryOne<{ phone: string | null }>(
        "SELECT phone FROM users WHERE id = $1",
        [recipientUserId]
      );
      if (recipientPhone?.phone) {
        const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
          "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
          [recipientUserId]
        );
        if (smsPrefs?.sms_bookings !== false) {
          sendWhatsApp(
            recipientPhone.phone,
            "new_message",
            [senderName],
            `Photo Portugal: ${senderName} proposed a new date (${formattedDate}) for your photoshoot. Log in to respond.`
          ).catch(err => console.error("[whatsapp] error:", err));
        }
      }
    } catch (smsErr) {
      console.error("[propose-date] sms error:", smsErr);
    }

    return NextResponse.json({ success: true, action: "proposed" });
  }

  if (action === "accept") {
    // Accept the proposed date — update shoot_date, clear proposal
    if (!booking.proposed_date) return NextResponse.json({ error: "No date proposal to accept" }, { status: 400 });

    await queryOne(
      `UPDATE bookings SET shoot_date = proposed_date, proposed_date = NULL, proposed_by = NULL, date_note = NULL, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [bookingId]
    );

    // Notify the proposer that their date was accepted
    const recipientEmail = isPhotographer ? booking.client_email : booking.photographer_email;
    const recipientName = isPhotographer ? booking.client_name : booking.photographer_name;
    const accepterName = isPhotographer ? booking.photographer_name : booking.client_name;
    const formattedDate = new Date(booking.proposed_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    await sendEmail(
      recipientEmail,
      `Date Confirmed — ${formattedDate}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #22C55E;">Date Accepted!</h2>
        <p>Hi ${recipientName.split(" ")[0]},</p>
        <p><strong>${accepterName}</strong> has accepted the proposed date:</p>
        <div style="background: #F0FFF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 18px; font-weight: bold; margin: 0; color: #166534;">${formattedDate}</p>
        </div>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    ).catch(console.error);

    return NextResponse.json({ success: true, action: "accepted" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
