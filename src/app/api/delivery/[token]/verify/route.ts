import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne, query } from "@/lib/db";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

// POST: Verify password and return gallery data
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`delivery-verify:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { token } = await params;
  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const booking = await queryOne<{
    id: string;
    delivery_password: string;
    delivery_expires_at: string;
    photographer_name: string;
    photographer_avatar: string | null;
    photographer_slug: string;
    client_name: string;
    shoot_date: string | null;
    location_slug: string | null;
    delivery_accepted: boolean;
    payment_status: string;
  }>(
    `SELECT b.id, b.delivery_password, b.delivery_expires_at,
            pp.display_name as photographer_name, u.avatar_url as photographer_avatar,
            pp.slug as photographer_slug, cu.name as client_name,
            b.shoot_date, b.location_slug,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            b.payment_status
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.delivery_token = $1 AND b.status = 'delivered'`,
    [token]
  );

  if (!booking) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  // Check expiry
  if (new Date(booking.delivery_expires_at) < new Date()) {
    return NextResponse.json({ error: "This gallery has expired" }, { status: 410 });
  }

  // Check password (compare SHA256 hashes)
  const hashedInput = crypto.createHash("sha256").update(password).digest("hex");
  if (booking.delivery_password !== hashedInput) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Password correct — return gallery data
  const photos = await query<{ id: string; url: string; filename: string; file_size: number }>(
    "SELECT id, url, filename, file_size FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
    [booking.id]
  );

  return NextResponse.json({
    booking_id: booking.id,
    photographer_name: booking.photographer_name,
    photographer_avatar: booking.photographer_avatar,
    client_name: booking.client_name,
    shoot_date: booking.shoot_date,
    location_slug: booking.location_slug,
    expires_at: booking.delivery_expires_at,
    photos,
    photo_count: photos.length,
    delivery_accepted: booking.delivery_accepted,
    payment_status: booking.payment_status,
  });
}
