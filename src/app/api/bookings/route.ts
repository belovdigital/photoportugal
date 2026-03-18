import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { sendBookingNotification, sendAdminNewBookingNotification } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { SERVICE_FEE_RATE } from "@/lib/stripe";

// Create a booking request
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to book" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const { photographer_id, package_id, location_slug, shoot_date, shoot_time, group_size, occasion, message } = await req.json();

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

    // Get package price if selected
    let totalPrice = null;
    if (package_id) {
      const pkg = await queryOne<{ price: number }>(
        "SELECT price FROM packages WHERE id = $1 AND photographer_id = $2",
        [package_id, photographer_id]
      );
      if (pkg) totalPrice = Math.round(pkg.price * (1 + SERVICE_FEE_RATE));
    }

    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (client_id, photographer_id, package_id, location_slug, shoot_date, shoot_time, group_size, occasion, message, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING id`,
      [userId, photographer_id, package_id || null, location_slug || null, shoot_date || null, shoot_time || null, group_size || 2, occasion || null, message || null, totalPrice]
    );

    // Send email notification to photographer (if enabled)
    try {
      const photographerInfo = await queryOne<{ email: string; display_name: string; user_id: string }>(
        `SELECT u.email, pp.display_name, u.id as user_id FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
        [photographer_id]
      );
      const prefs = await queryOne<{ email_bookings: boolean; sms_bookings: boolean }>(
        "SELECT email_bookings, sms_bookings FROM notification_preferences WHERE user_id = $1",
        [photographerInfo?.user_id]
      );
      const clientInfo = await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]);
      const pkgInfo = package_id ? await queryOne<{ name: string }>("SELECT name FROM packages WHERE id = $1", [package_id]) : null;

      if (photographerInfo && clientInfo && prefs?.email_bookings !== false) {
        sendBookingNotification(
          photographerInfo.email,
          photographerInfo.display_name,
          clientInfo.name,
          pkgInfo?.name || null,
          shoot_date || null
        );
      }

      // Notify admin about new booking
      if (photographerInfo && clientInfo) {
        sendAdminNewBookingNotification(
          clientInfo.name,
          photographerInfo.display_name,
          pkgInfo?.name || null,
          shoot_date || null
        );
      }

      // Send SMS notification to photographer (if enabled and phone number exists)
      if (photographerInfo && clientInfo && prefs?.sms_bookings !== false) {
        const profile = await queryOne<{ phone_number: string | null }>(
          "SELECT phone_number FROM photographer_profiles WHERE id = $1",
          [photographer_id]
        );
        if (profile?.phone_number) {
          sendSMS(
            profile.phone_number,
            `New booking request on Photo Portugal from ${clientInfo.name}. Log in to review: https://photoportugal.com/dashboard/bookings`
          );
        }
      }
    } catch {}

    return NextResponse.json({ success: true, booking_id: booking?.id });
  } catch (error) {
    console.error("[bookings] create error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

// Get bookings for current user
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  // Read role from DB (JWT may be stale)
  let role = (session.user as { role?: string }).role;
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
        `SELECT b.*, pp.display_name as photographer_name, pp.slug as photographer_slug,
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
