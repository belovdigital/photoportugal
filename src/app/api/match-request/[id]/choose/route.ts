import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendEmail, sendBookingConfirmationWithPayment, sendAdminBookingConfirmedNotification } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { formatShootDate } from "@/lib/format-shoot-date";
import { getLocationDisplayName } from "@/lib/location-hierarchy";

const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { photographer_id } = body;

  if (!photographer_id) {
    return NextResponse.json({ error: "photographer_id is required" }, { status: 400 });
  }

  try {
    // Verify match request belongs to this user and is in 'matched' status
    const matchReq = await queryOne<{
      id: string; user_id: string; status: string;
      location_slug: string; shoot_date: string | null; shoot_time: string | null;
      group_size: number; shoot_type: string; message: string | null;
      budget_range: string; name: string; email: string;
    }>(
      "SELECT * FROM match_requests WHERE id = $1 AND user_id = $2 AND status = 'matched'",
      [id, user.id]
    );

    if (!matchReq) {
      return NextResponse.json({ error: "Match request not found or already booked" }, { status: 404 });
    }

    // Verify photographer is in the match list
    const mrPhotographer = await queryOne<{ photographer_id: string }>(
      "SELECT photographer_id FROM match_request_photographers WHERE match_request_id = $1 AND photographer_id = $2",
      [id, photographer_id]
    );

    if (!mrPhotographer) {
      return NextResponse.json({ error: "Photographer not found in your matches" }, { status: 400 });
    }

    // Get price from match_request_photographers (admin-set), falling back to min package price
    const priceRow = await queryOne<{ price: number | null }>(
      `SELECT COALESCE(mrp.price, (SELECT MIN(price) FROM packages WHERE photographer_id = $1 AND is_public = TRUE)) as price
       FROM match_request_photographers mrp
       WHERE mrp.match_request_id = $2 AND mrp.photographer_id = $1`,
      [photographer_id, id]
    );
    const price = priceRow?.price || null;

    // Get photographer details
    const photographerInfo = await queryOne<{
      profile_id: string; user_id: string; name: string; email: string;
      phone: string | null; slug: string;
    }>(
      `SELECT pp.id as profile_id, pp.user_id, u.name, u.email, u.phone, pp.slug
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = $1`,
      [photographer_id]
    );

    if (!photographerInfo) {
      return NextResponse.json({ error: "Photographer not found" }, { status: 400 });
    }

    // Create confirmed booking
    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (client_id, photographer_id, location_slug, shoot_date, shoot_time, group_size, occasion, total_price, status, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9)
       RETURNING id`,
      [
        user.id,
        photographer_id,  // photographer_profiles.id
        matchReq.location_slug,
        matchReq.shoot_date || null,
        matchReq.shoot_time || null,
        matchReq.group_size,
        matchReq.shoot_type,
        price,
        matchReq.message || null,
      ]
    );

    if (!booking) {
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }

    // Update match request status
    await queryOne(
      "UPDATE match_requests SET status = 'booked', chosen_photographer_id = $1, booking_id = $2 WHERE id = $3",
      [photographer_id, booking.id, id]
    );

    // === Notifications ===
    const locationName = getLocationDisplayName(matchReq.location_slug);
    const shootTypeLabel = matchReq.shoot_type.charAt(0).toUpperCase() + matchReq.shoot_type.slice(1);

    // Email to photographer about new confirmed booking
    sendEmail(
      photographerInfo.email,
      `New confirmed booking from ${matchReq.name}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">New Booking Confirmed!</h2>
        <p>Hi ${photographerInfo.name.split(" ")[0]},</p>
        <p>Great news! <strong>${matchReq.name}</strong> has chosen you for their ${shootTypeLabel.toLowerCase()} photoshoot in ${locationName}.</p>
        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <p style="margin:0 0 8px;font-size:14px;"><strong>Location:</strong> ${locationName}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Type:</strong> ${shootTypeLabel}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Group size:</strong> ${matchReq.group_size} people</p>
          ${(() => { const d = formatShootDate(matchReq.shoot_date, "en"); return d ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Date:</strong> ${d}</p>` : ""; })()}
          ${price ? `<p style="margin:0;font-size:14px;"><strong>Price:</strong> €${price}</p>` : ""}
        </div>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    ).catch((err) => console.error("[match-request/choose] photographer email error:", err));

    // Email to client with booking confirmation / payment link
    sendBookingConfirmationWithPayment(
      user.email,
      matchReq.name,
      photographerInfo.name,
      matchReq.shoot_date,
      null, // no payment URL yet — photographer will confirm and trigger Stripe checkout
      price || 0,
    ).catch((err) => console.error("[match-request/choose] client email error:", err));

    // Admin notification email
    sendAdminBookingConfirmedNotification(
      matchReq.name,
      photographerInfo.name,
      matchReq.shoot_date,
      price,
      null, // no package name — concierge match
    ).catch((err) => console.error("[match-request/choose] admin email error:", err));

    // Telegram to admin
    import("@/lib/telegram").then(({ sendTelegram }) => {
      sendTelegram(
        `🎯 <b>Match Chosen!</b>\n\n<b>Client:</b> ${matchReq.name}\n<b>Photographer:</b> ${photographerInfo!.name}\n<b>Location:</b> ${locationName}\n<b>Type:</b> ${shootTypeLabel}\n${price ? `<b>Price:</b> €${price}\n` : ""}\n<a href="${BASE_URL}/admin#matchRequests">Open Admin →</a>`,
        "match_requests"
      );
    }).catch((err) => console.error("[match-request/choose] telegram error:", err));

    // SMS to photographer
    try {
      const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
        "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
        [photographerInfo.user_id]
      );
      if (photographerInfo.phone && smsPrefs?.sms_bookings !== false) {
        sendSMS(
          photographerInfo.phone,
          `Photo Portugal: ${matchReq.name} chose you for a ${shootTypeLabel.toLowerCase()} shoot in ${locationName}! Check your dashboard: ${BASE_URL}/dashboard/bookings`
        ).catch((err) => console.error("[match-request/choose] sms error:", err));
      }
    } catch (smsErr) {
      console.error("[match-request/choose] sms lookup error:", smsErr);
    }

    return NextResponse.json({ success: true, booking_id: booking.id });
  } catch (error) {
    console.error("[match-request/choose] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/match-request/:id/choose", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to process your selection" }, { status: 500 });
  }
}
