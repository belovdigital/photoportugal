import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { sendBookingNotification, sendBookingRequestToClient, sendAdminNewBookingNotification } from "@/lib/email";
import { sendSMS, sendAdminSMS } from "@/lib/sms";

// Create a booking request
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to book" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { photographer_id, package_id, location_slug, location_detail, shoot_date, shoot_time, flexible_date_from, flexible_date_to, group_size, occasion, message, utm_source, utm_medium, utm_campaign, utm_term, gclid } = await req.json();

    if (!photographer_id) {
      return NextResponse.json({ error: "Photographer is required" }, { status: 400 });
    }

    // Verify photographer exists and is approved. Pull min_lead_time_hours
    // here too so we can validate the shoot date in a single roundtrip.
    const photographerCheck = await queryOne<{
      is_approved: boolean; user_id: string; min_lead_time_hours: number;
    }>(
      "SELECT is_approved, user_id, COALESCE(min_lead_time_hours, 0) as min_lead_time_hours FROM photographer_profiles WHERE id = $1",
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

    // Notice-period validation. Photographers can require N hours of
    // advance notice before a shoot (set in dashboard/settings). 0 = no
    // restriction. Compared against shoot_date at midnight UTC, which is
    // good enough for a "X hours ahead" gate (a few hours of TZ skew
    // doesn't change a 24/48/120h window).
    const isFlexible = shoot_date === "flexible";
    const minLeadHours = photographerCheck.min_lead_time_hours || 0;
    if (!isFlexible && shoot_date && minLeadHours > 0) {
      const shootStart = new Date(`${shoot_date}T00:00:00Z`).getTime();
      const earliestAllowed = Date.now() + minLeadHours * 3600 * 1000;
      if (shootStart < earliestAllowed) {
        const days = Math.round(minLeadHours / 24);
        const niceWindow = minLeadHours < 24
          ? `${minLeadHours} hours`
          : days === 1 ? "1 day" : `${days} days`;
        return NextResponse.json({
          error: `This photographer requires at least ${niceWindow} of advance notice. Please pick a later date.`,
          code: "min_lead_time",
          minLeadTimeHours: minLeadHours,
        }, { status: 400 });
      }
    }

    // Check availability for non-flexible bookings
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

    // Get package price if selected. Also enforce one-off proposal
    // targeting: a custom package (custom_for_user_id IS NOT NULL) can
    // only be booked by the user it was sent to. This stops a different
    // client from booking another client's negotiated price by guessing
    // the package_id.
    let totalPrice = null;
    if (package_id) {
      const pkg = await queryOne<{ price: number; custom_for_user_id: string | null }>(
        "SELECT price, custom_for_user_id FROM packages WHERE id = $1 AND photographer_id = $2",
        [package_id, photographer_id]
      );
      if (pkg) {
        if (pkg.custom_for_user_id && pkg.custom_for_user_id !== userId) {
          return NextResponse.json({
            error: "This proposal isn't available to you.",
            code: "custom_proposal_mismatch",
          }, { status: 403 });
        }
        totalPrice = pkg.price;
      }
    }

    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (client_id, photographer_id, package_id, location_slug, location_detail, shoot_date, shoot_time, flexible_date_from, flexible_date_to, group_size, occasion, message, total_price, status, utm_source, utm_medium, utm_campaign, utm_term, gclid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15, $16, $17, $18)
       RETURNING id`,
      [userId, photographer_id, package_id || null, location_slug || null, location_detail?.trim() || null, isFlexible ? null : shoot_date, (shoot_time && shoot_time !== "flexible") ? shoot_time : null, isFlexible ? (flexible_date_from || null) : null, isFlexible ? (flexible_date_to || null) : null, group_size || 2, occasion || null, message || null, totalPrice, utm_source || null, utm_medium || null, utm_campaign || null, utm_term || null, gclid || null]
    );

    // Upload "Booking Created" offline conversion to Google Ads if gclid present
    if (gclid && booking?.id) {
      const clientUser = await queryOne<{ email: string; phone: string | null }>(
        "SELECT email, phone FROM users WHERE id = $1",
        [userId]
      ).catch(() => null);
      import("@/lib/google-ads-conversions").then(({ uploadBookingCreatedConversion }) => {
        uploadBookingCreatedConversion(gclid, totalPrice ? Number(totalPrice) : 0, {
          email: clientUser?.email,
          phone: clientUser?.phone,
        });
      }).catch((err) => console.error("[bookings] gads conversion upload error:", err));
    }

    // Convert any inquiry between same client & photographer to point to this booking
    await queryOne(
      "UPDATE bookings SET converted_to_booking_id = $3 WHERE client_id = $1 AND photographer_id = $2 AND status = 'inquiry' AND id != $3 RETURNING id",
      [userId, photographer_id, booking!.id]
    ).catch(() => {});

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
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`📅 <b>New Booking!</b>\n\n<b>Client:</b> ${clientInfo!.name}\n<b>Photographer:</b> ${photographerInfo!.display_name}\n<b>Package:</b> ${pkgInfo?.name || "Custom"}\n<b>Date:</b> ${dateDisplay || "Flexible"}\n\n<a href="https://photoportugal.com/admin">Open Admin →</a>`, "bookings");
        }).catch((err) => console.error("[bookings] telegram new booking error:", err));
      }

      // Check if this client came from ads
      try {
        const clientUtm = await queryOne<{utm_source: string | null}>(
          "SELECT utm_source FROM users WHERE id = $1", [userId]
        );
        if (clientUtm?.utm_source) {
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`🎯 <b>Ad Visitor Booked!</b>\n\nSource: ${clientUtm!.utm_source}\n${clientInfo!.name} → ${photographerInfo!.display_name}`, "bookings");
          }).catch((err) => console.error("[bookings] telegram ad visitor error:", err));
        }
      } catch {}

      // Send SMS notification to photographer (if enabled and phone number exists)
      if (photographerInfo && clientInfo && prefs?.sms_bookings !== false) {
        const photographerPhone = await queryOne<{ phone: string | null }>(
          "SELECT phone FROM users WHERE id = $1",
          [photographerInfo.user_id]
        );
        if (photographerPhone?.phone) {
          sendSMS(
            photographerPhone.phone,
            `New booking request on Photo Portugal from ${clientInfo.name}. Log in to review: https://photoportugal.com/dashboard/bookings`
          ).catch(err => console.error("[sms] new booking error:", err));
        }
      }

      // SMS notification to all admin phones
      if (photographerInfo && clientInfo) {
        sendAdminSMS(
          `New booking: ${clientInfo.name} → ${photographerInfo.display_name}${pkgInfo?.name ? ` (${pkgInfo.name})` : ""}${dateDisplay ? `, ${dateDisplay}` : ""}`
        );
      }

      // Push notification to photographer
      if (photographerInfo && clientInfo) {
        import("@/lib/push").then(m =>
          m.sendPushNotification(
            photographerInfo!.user_id,
            "New Booking Request",
            `${clientInfo!.name} wants to book a session`,
            { type: "booking", bookingId: booking?.id || "" }
          )
        ).catch((err) => console.error("[bookings] push notification error:", err));
      }

      // Telegram notification to photographer
      if (clientInfo) {
        const clientFirst = clientInfo.name.split(" ")[0];
        import("@/lib/notify-photographer").then(m =>
          m.notifyPhotographerViaTelegram(
            photographer_id,
            `New booking request from ${clientFirst}!\n\nPackage: ${pkgInfo?.name || "Custom"}\nDate: ${dateDisplay || "Flexible"}\n\nView: https://photoportugal.com/dashboard/bookings`
          )
        ).catch((err) => console.error("[bookings] telegram photographer notify error:", err));
      }
    } catch {}

    return NextResponse.json({ success: true, booking_id: booking?.id });
  } catch (error) {
    console.error("[bookings] create error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings", method: req.method, statusCode: 500 }); } catch {}
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
         WHERE b.photographer_id = $1 AND b.status != 'inquiry'
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
         WHERE b.client_id = $1 AND b.status != 'inquiry'
         ORDER BY b.created_at DESC`,
        [userId]
      );
    }

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("[bookings] get error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to get bookings" }, { status: 500 });
  }
}
