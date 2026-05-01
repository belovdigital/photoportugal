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
    photographer_id: booking.photographer_id,
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

// GET: return photographer's packages for the share picker (only public
// ones — the custom-proposal flow uses its own POST below).
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

  // Only the photographer's "regular" public packages — custom one-offs
  // are created on demand via PUT below, never re-shared from this list.
  const packages = await query<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number }>(
    `SELECT id, name, price, duration_minutes, num_photos
     FROM packages
     WHERE photographer_id = $1 AND custom_for_user_id IS NULL
     ORDER BY sort_order, price`,
    [booking.photographer_id]
  );

  return NextResponse.json(packages);
}

// PUT: create a one-off custom proposal for this client and share it as a
// chat card in one shot. Body: { booking_id, name, price, duration_minutes,
// num_photos, description? }. The package row is private (is_public=FALSE)
// and tied to the client via custom_for_user_id — only that client can see
// it on /book/[slug] or create a booking against it.
export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    booking_id?: string;
    name?: unknown;
    price?: unknown;
    duration_minutes?: unknown;
    num_photos?: unknown;
    description?: unknown;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const bookingId = body.booking_id;
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  // Same auth check as the regular share endpoint.
  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string; client_id: string }>(
    `SELECT b.photographer_id, pp.user_id as photographer_user_id, b.client_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!booking || booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Only the photographer can create a custom proposal" }, { status: 403 });
  }

  // Validate inputs. Bounds: price 1-99999€, duration 5-1440 min, photos
  // 1-9999. Name 3-80 chars. Description optional, max 500.
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const durationMinutes = Number(body.duration_minutes);
  const numPhotos = Number(body.num_photos);
  const description = String(body.description ?? "").trim().slice(0, 500) || null;
  if (name.length < 3 || name.length > 80) {
    return NextResponse.json({ error: "Name must be 3-80 characters." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 1 || price > 99999) {
    return NextResponse.json({ error: "Price must be between €1 and €99,999." }, { status: 400 });
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
    return NextResponse.json({ error: "Duration must be 5-1440 minutes." }, { status: 400 });
  }
  if (!Number.isFinite(numPhotos) || numPhotos < 1 || numPhotos > 9999) {
    return NextResponse.json({ error: "Photo count must be 1-9999." }, { status: 400 });
  }

  // Insert as a private one-off targeted at this booking's client.
  // CRITICAL: is_public=FALSE explicitly. Production DB has the column
  // default at TRUE (schema drift vs schema.sql which says FALSE) so
  // omitting it here would leak the proposal to every visitor of /book.
  const pkg = await queryOne<{ id: string }>(
    `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price,
                           is_public, is_popular, delivery_days, sort_order, custom_for_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE, 7, 0, $7)
     RETURNING id`,
    [booking.photographer_id, name, description, Math.round(durationMinutes), Math.round(numPhotos), Math.round(price), booking.client_id]
  );
  if (!pkg) return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });

  // Photographer slug for the booking link inside the card.
  const profile = await queryOne<{ slug: string }>(
    "SELECT slug FROM photographer_profiles WHERE id = $1",
    [booking.photographer_id]
  );

  // Same BOOKING_CARD payload as the public-package share, with `is_custom`
  // so the chat UI can render the small "Custom proposal" badge.
  const cardData = JSON.stringify({
    package_id: pkg.id,
    name,
    price: Math.round(price),
    duration_minutes: Math.round(durationMinutes),
    num_photos: Math.round(numPhotos),
    slug: profile?.slug || "",
    photographer_id: booking.photographer_id,
    is_custom: true,
    description,
  });

  const message = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO messages (booking_id, sender_id, text, is_system)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, created_at`,
    [bookingId, user.id, `BOOKING_CARD:${cardData}`]
  );

  // WebSocket fan-out — same shape as the public-package share so the
  // chat UI doesn't need to differentiate at the transport level.
  try {
    const senderInfo = await queryOne<{ name: string; avatar_url: string | null }>(
      "SELECT name, avatar_url FROM users WHERE id = $1", [user.id]
    );
    await queryOne("SELECT pg_notify('new_message', $1)", [
      JSON.stringify({
        booking_id: bookingId,
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
    package_id: pkg.id,
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
