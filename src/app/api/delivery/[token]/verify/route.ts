import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne, query } from "@/lib/db";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";

// POST: Verify password and return gallery data
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const booking = await queryOne<{
    id: string;
    client_id: string;
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
    zip_ready: boolean;
    zip_size: number | null;
  }>(
    `SELECT b.id, b.client_id, b.delivery_password, b.delivery_expires_at,
            u.name as photographer_name, u.avatar_url as photographer_avatar,
            pp.slug as photographer_slug, cu.name as client_name,
            b.shoot_date, b.location_slug,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            b.payment_status,
            COALESCE(b.zip_ready, FALSE) as zip_ready, b.zip_size
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`,
    [token]
  );

  if (!booking) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  // Check expiry
  if (new Date(booking.delivery_expires_at) < new Date()) {
    return NextResponse.json({ error: "This gallery has expired" }, { status: 410 });
  }

  // Check password (bcrypt, with SHA256 fallback for old deliveries)
  const { compare: bcryptCompare } = await import("bcryptjs");
  const isBcrypt = booking.delivery_password.startsWith("$2");
  const passwordMatch = isBcrypt
    ? await bcryptCompare(password, booking.delivery_password)
    : crypto.createHash("sha256").update(password).digest("hex") === booking.delivery_password;
  if (!passwordMatch) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Password correct — return gallery data
  const isAccepted = booking.delivery_accepted === true;

  const rawPhotos = await query<{ id: string; url: string; preview_url: string | null; filename: string; file_size: number }>(
    "SELECT id, url, preview_url, filename, file_size FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
    [booking.id]
  );

  // If delivery not yet accepted, return preview URLs instead of full-res URLs
  // For S3-stored photos, generate presigned URLs
  const photos = await Promise.all(rawPhotos.map(async (photo) => {
    const rawUrl = isAccepted ? photo.url : (photo.preview_url || photo.url);
    let resolvedUrl = rawUrl;
    if (isS3Path(rawUrl)) {
      resolvedUrl = await getPresignedUrl(s3KeyFromPath(rawUrl), 3600);
    }
    return {
      id: photo.id,
      url: resolvedUrl,
      filename: photo.filename,
      file_size: photo.file_size,
    };
  }));

  return NextResponse.json({
    booking_id: booking.id,
    client_id: booking.client_id,
    photographer_name: booking.photographer_name,
    photographer_avatar: booking.photographer_avatar,
    client_name: booking.client_name,
    shoot_date: booking.shoot_date,
    location_slug: booking.location_slug,
    expires_at: booking.delivery_expires_at,
    photos,
    photo_count: photos.length,
    delivery_accepted: isAccepted,
    payment_status: booking.payment_status,
    zip_ready: isAccepted && booking.zip_ready,
    zip_size: booking.zip_size ? Number(booking.zip_size) : null,
  });
}
