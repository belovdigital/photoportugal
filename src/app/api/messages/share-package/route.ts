import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { booking_id, package_id } = await req.json();
  if (!booking_id || !package_id) {
    return NextResponse.json({ error: "booking_id and package_id required" }, { status: 400 });
  }

  // Verify user is the photographer in this booking
  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string; client_id: string }>(
    `SELECT b.photographer_id, pp.user_id as photographer_user_id, b.client_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.id = $1`,
    [booking_id]
  );

  if (!booking || booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Only the photographer can share packages" }, { status: 403 });
  }

  // Get the package (must belong to this photographer)
  const pkg = await queryOne<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number }>(
    "SELECT id, name, price, duration_minutes, num_photos FROM packages WHERE id = $1 AND photographer_id = $2",
    [package_id, booking.photographer_id]
  );

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Get photographer slug for the booking link
  const profile = await queryOne<{ slug: string }>(
    "SELECT slug FROM photographer_profiles WHERE id = $1",
    [booking.photographer_id]
  );

  const cardData = JSON.stringify({
    package_id: pkg.id,
    name: pkg.name,
    price: pkg.price,
    duration_minutes: pkg.duration_minutes,
    num_photos: pkg.num_photos,
    slug: profile?.slug || "",
  });

  // Insert as a system message from the photographer
  const message = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO messages (booking_id, sender_id, text, is_system)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, created_at`,
    [booking_id, user.id, `BOOKING_CARD:${cardData}`]
  );

  // Notify via WebSocket
  try {
    const senderInfo = await queryOne<{ name: string; avatar_url: string | null }>(
      "SELECT name, avatar_url FROM users WHERE id = $1", [user.id]
    );
    await queryOne("SELECT pg_notify('new_message', $1)", [
      JSON.stringify({
        booking_id,
        message: {
          id: message!.id,
          text: `BOOKING_CARD:${cardData}`,
          media_url: null,
          sender_id: user.id,
          sender_name: senderInfo?.name || "",
          sender_avatar: senderInfo?.avatar_url || null,
          created_at: message!.created_at,
          read_at: null,
          is_system: true,
        },
      }),
    ]);
  } catch {}

  return NextResponse.json({
    success: true,
    message: {
      id: message!.id,
      text: `BOOKING_CARD:${cardData}`,
      media_url: null,
      sender_id: user.id,
      created_at: message!.created_at,
      read_at: null,
      is_system: true,
    },
  });
}

// GET: return photographer's packages for the share picker
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookingId = req.nextUrl.searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string }>(
    `SELECT b.photographer_id, pp.user_id as photographer_user_id
     FROM bookings b JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking || booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Not the photographer" }, { status: 403 });
  }

  const packages = await query<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number }>(
    "SELECT id, name, price, duration_minutes, num_photos FROM packages WHERE photographer_id = $1 ORDER BY sort_order, price",
    [booking.photographer_id]
  );

  return NextResponse.json(packages);
}
