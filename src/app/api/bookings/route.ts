import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { sendBookingNotification, sendBookingRequestToClient, sendAdminNewBookingNotification } from "@/lib/email";
import { sendWhatsApp, sendAdminWhatsApp } from "@/lib/whatsapp";

// Create a booking request
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to book" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { photographer_id, package_id, location_slug, shoot_date, shoot_time, flexible_date_from, flexible_date_to, group_size, occasion, message, utm_source, utm_medium, utm_campaign, utm_term } = await req.json();

    if (!photographer_id) {
      return NextResponse.json({ error: "Photographer is required" }, { status: 400 });
    }

    // Verify photographer exists and is approved
    const photographerCheck = await queryOne<{ is_approved: boolean; user_id: string }>(
      "SELECT is_approved, user_id FROM photographer_profiles WHERE id = $1",
      [photographer_id]
    );
    if (!photographerCheck) {
      return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
    }
    if (!photographerCheck.is_approved) {
      return NextResponse.json({ error: "This photographer is not yet approved" }, { status: 400 });
    }

    // Prevent self-booking
    if (photographerCheck.user_id === userId) {
      return NextResponse.json({ error: "You cannot book yourself" }, { status: 400 });
    }

    // Check availability for non-flexible bookings
    const isFlexible = shoot_date === "flexible";
    if (!isFlexible && shoot_date) {
      const conflict = await queryOne<{ id: string }>(
        `SELECT id FROM photographer_unavailability
         WHERE photographer_id = $1 AND date_from <= $2::date AND date_to >= $2::date`,
        [photographer_id, shoot_date]
      );
      if (conflict) {
        return NextResponse.json({ error: "This photographer is not available on the selected date. Please choose a different date or check \"I'm flexible with dates\"." }, { status: 400 });
      }
    }

    // Get package price if selected
    let totalPrice = null;
    if (package_id) {
      const pkg = await queryOne<{ price: number }>(
        "SELECT price FROM packages WHERE id = $1 AND photographer_id = $2",
        [package_id, photographer_id]
      );
      if (pkg) totalPrice = pkg.price;
    }

    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (client_id, photographer_id, package_id, location_slug, shoot_date, shoot_time, flexible_date_from, flexible_date_to, group_size, occasion, message, total_price, status, utm_source, utm_medium, utm_campaign, utm_term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $14, $15, $16)
       RETURNING id`,
      [userId, photographer_id, package_id || null, location_slug || null, isFlexible ? null : shoot_date, (shoot_time && shoot_time !== "flexible") ? shoot_time : null, isFlexible ? (flexible_date_from || null) : null, isFlexible ? (flexible_date_to || null) : null, group_size || 2, occasion || null, message || null, totalPrice, utm_source || null, utm_medium || null, utm_campaign || null, utm_term || null]
    );

    // Send email notification to photographer (if enabled)
    try {
      const photographerInfo = await queryOne<{ email: string; display_name: string; user_id: string }>(
        `SELECT u.email, u.name as display_name, u.id as user_id FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
        [photographer_id]
      );
      const prefs = await queryOne<{ email_bookings: boolean; sms_bookings: boolean }>(
        "SELECT email_bookings, sms_bookings FROM notification_preferences WHERE user_id = $1",
        [photographerInfo?.user_id]
      );
      const clientInfo = await queryOne<{ name: string; email: string }>("SELECT name, email FROM users WHERE id = $1", [userId]);
      const pkgInfo = package_id ? await queryOne<{ name: string }>("SELECT name FROM packages WHERE id = $1", [package_id]) : null;

      const dateDisplay = isFlexible && flexible_date_from && flexible_date_to
        ? `flexible (${flexible_date_from} — ${flexible_date_to})`
        : shoot_date || null;

      if (photographerInfo && clientInfo && prefs?.email_bookings !== false) {
        sendBookingNotification(
          photographerInfo.email,
          photographerInfo.display_name,
          clientInfo.name,
          pkgInfo?.name || null,
          dateDisplay
        );
      }

      // Confirm to client that request was sent
      if (photographerInfo && clientInfo) {
        sendBookingRequestToClient(
          clientInfo.email,
          clientInfo.name,
          photographerInfo.display_name,
          pkgInfo?.name || null,
          dateDisplay
        );
      }

      // Notify admin about new booking
      if (photographerInfo && clientInfo) {
        sendAdminNewBookingNotification(
          clientInfo.name,
          photographerInfo.display_name,
          pkgInfo?.name || null,
          dateDisplay
        );
      }

      // Send SMS notification to photographer (if enabled and phone number exists)
      if (photographerInfo && clientInfo && prefs?.sms_bookings !== false) {
        const photographerPhone = await queryOne<{ phone: string | null }>(
          "SELECT phone FROM users WHERE id = $1",
          [photographerInfo.user_id]
        );
        if (photographerPhone?.phone) {
          sendWhatsApp(
            photographerPhone.phone,
            "new_booking_request",
            [clientInfo.name],
            `New booking request on Photo Portugal from ${clientInfo.name}. Log in to review: https://photoportugal.com/dashboard/bookings`
          ).catch(err => console.error("[whatsapp] new booking error:", err));
        }
      }

      // WhatsApp/SMS notification to all admin phones
      if (photographerInfo && clientInfo) {
        sendAdminWhatsApp(
          "admin_new_booking",
          [clientInfo.name, photographerInfo.display_name, dateDisplay || "flexible"],
          `New booking: ${clientInfo.name} → ${photographerInfo.display_name}${pkgInfo?.name ? ` (${pkgInfo.name})` : ""}${dateDisplay ? `, ${dateDisplay}` : ""}`
        );
      }
    } catch {}

    return NextResponse.json({ success: true, booking_id: booking?.id });
  } catch (error) {
    console.error("[bookings] create error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

// Get bookings for current user
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // Read role from DB (JWT may be stale)
  let role = user.role;
  try {
    const dbUser = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
    if (dbUser) role = dbUser.role;
  } catch {}

  try {
    let bookings;
    if (role === "photographer") {
      const profile = await queryOne<{ id: string }>(
        "SELECT id FROM photographer_profiles WHERE user_id = $1",
        [userId]
      );
      if (!profile) return NextResponse.json([]);

      bookings = await query(
        `SELECT b.*, u.name as client_name, u.email as client_email, u.avatar_url as client_avatar,
                p.name as package_name, p.duration_minutes, p.num_photos
         FROM bookings b
         JOIN users u ON u.id = b.client_id
         LEFT JOIN packages p ON p.id = b.package_id
         WHERE b.photographer_id = $1
         ORDER BY b.created_at DESC`,
        [profile.id]
      );
    } else {
      bookings = await query(
        `SELECT b.*, u.name as photographer_name, pp.slug as photographer_slug,
                u.avatar_url as photographer_avatar,
                p.name as package_name, p.duration_minutes, p.num_photos
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users u ON u.id = pp.user_id
         LEFT JOIN packages p ON p.id = b.package_id
         WHERE b.client_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
      );
    }

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("[bookings] get error:", error);
    return NextResponse.json({ error: "Failed to get bookings" }, { status: 500 });
  }
}
