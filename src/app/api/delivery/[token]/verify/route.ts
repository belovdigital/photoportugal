import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";
import { verifyToken } from "@/app/api/admin/login/route";
import { auth } from "@/lib/auth";

// Admins (verified via the admin_token cookie) can pull any gallery
// without a password — used by the Recent Visitors panel to inspect
// what a client/photographer saw, without needing the gallery
// password each time.
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

// POST: Verify password and return gallery data
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { password } = await req.json();
  const admin = await isAdmin();
  // Pre-load session so the password-required gate below also recognises
  // a signed-in gift recipient (whose session we'll re-confirm against
  // the booking row right after fetching it).
  const sessionEarly = await auth();
  const sessionUserIdEarly = (sessionEarly?.user as { id?: string } | undefined)?.id || null;

  if (!password && !admin && !sessionUserIdEarly) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const booking = await queryOne<{
    id: string;
    client_id: string;
    gift_recipient_user_id: string | null;
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
    `SELECT b.id, b.client_id, b.gift_recipient_user_id, b.delivery_password, b.delivery_expires_at,
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

  // Bypass the password if the caller is signed in as the booking's
  // gift recipient — they reached this gallery from their dashboard,
  // they own the booking, asking them to retype a password they never
  // saw would be hostile UX.
  const sessionUserId = sessionUserIdEarly;
  const isGiftRecipientSignedIn = sessionUserId
    && booking.gift_recipient_user_id
    && booking.gift_recipient_user_id === sessionUserId;

  // Check password unless caller is an admin (admin cookie bypass) or
  // the signed-in gift recipient (booking-ownership bypass).
  if (!admin && !isGiftRecipientSignedIn) {
    const { compare: bcryptCompare } = await import("bcryptjs");
    const isBcrypt = booking.delivery_password.startsWith("$2");
    const passwordMatch = isBcrypt
      ? await bcryptCompare(password, booking.delivery_password)
      : crypto.createHash("sha256").update(password).digest("hex") === booking.delivery_password;
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
  }

  // Password correct — return gallery data
  const isAccepted = booking.delivery_accepted === true;

  const rawPhotos = await query<{
    id: string; url: string; preview_url: string | null; thumbnail_url: string | null;
    filename: string; file_size: number;
    media_type: string; duration_seconds: number | null; width: number | null; height: number | null;
  }>(
    `SELECT id, url, preview_url, thumbnail_url, filename, file_size,
            COALESCE(media_type, 'image') as media_type, duration_seconds, width, height
     FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at`,
    [booking.id]
  );

  // Two URLs per photo:
  //   - url:         the "best" version (after accept = original, before
  //                  = watermarked preview). Used by lightbox + download.
  //   - preview_url: ALWAYS the 1200px preview. Used by the gallery
  //                  grid as the thumbnail — because before this fix
  //                  we served originals (~15MB each, ×89 = 1.3GB) as
  //                  grid thumbs and mobile Safari ran out of memory
  //                  and silently failed to render any of them.
  // Videos: thumbnail_url is the poster frame, url is the playable mp4.
  const photos = await Promise.all(rawPhotos.map(async (photo) => {
    const isVideo = photo.media_type === "video";
    const rawUrl = isVideo
      ? photo.url
      : (isAccepted ? photo.url : (photo.preview_url || photo.url));
    let resolvedUrl = rawUrl;
    if (isS3Path(rawUrl)) resolvedUrl = await getPresignedUrl(s3KeyFromPath(rawUrl), 3600);

    let resolvedPreview: string | null = null;
    if (!isVideo && photo.preview_url) {
      resolvedPreview = isS3Path(photo.preview_url)
        ? await getPresignedUrl(s3KeyFromPath(photo.preview_url), 3600)
        : photo.preview_url;
    }

    let resolvedThumb: string | null = null;
    if (photo.thumbnail_url) {
      resolvedThumb = isS3Path(photo.thumbnail_url)
        ? await getPresignedUrl(s3KeyFromPath(photo.thumbnail_url), 3600)
        : photo.thumbnail_url;
    }
    return {
      id: photo.id,
      url: resolvedUrl,
      preview_url: resolvedPreview,
      thumbnail_url: resolvedThumb,
      filename: photo.filename,
      file_size: photo.file_size,
      media_type: photo.media_type,
      duration_seconds: photo.duration_seconds,
      width: photo.width,
      height: photo.height,
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
