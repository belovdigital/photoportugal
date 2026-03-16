import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

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
    const { photographer_id, package_id, location_slug, shoot_date, shoot_time, message } = await req.json();

    if (!photographer_id) {
      return NextResponse.json({ error: "Photographer is required" }, { status: 400 });
    }

    // Prevent self-booking
    const selfCheck = await queryOne(
      "SELECT id FROM photographer_profiles WHERE id = $1 AND user_id = $2",
      [photographer_id, userId]
    );
    if (selfCheck) {
      return NextResponse.json({ error: "You cannot book yourself" }, { status: 400 });
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
      `INSERT INTO bookings (client_id, photographer_id, package_id, location_slug, shoot_date, shoot_time, message, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id`,
      [userId, photographer_id, package_id || null, location_slug || null, shoot_date || null, shoot_time || null, message || null, totalPrice]
    );

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
