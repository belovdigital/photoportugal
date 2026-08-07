import { NextRequest, NextResponse } from "next/server";
import { maskSurname } from "@/lib/photographer-name";
export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";
import { verifyToken } from "@/app/api/admin/login/route";
import { auth } from "@/lib/auth";
import { resolveExtrasPricing } from "@/lib/extras-pricing";

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
    auto_accept_at: string | null;
    photographer_name: string;
    photographer_avatar: string | null;
    photographer_slug: string;
    client_name: string;
    shoot_date: string | null;
    location_slug: string | null;
    delivery_accepted: boolean;
    payment_status: string;
    zip_ready: boolean;
    extras_zip_ready: boolean;
    extras_zip_size: number | null;
    gift_slots: number;
    gift_used: number;
    extras_in_archive: number;
    extra_photo_price_cents: number | null;
    extra_photo_payout_cents: number | null;
    profile_extra_photo_payout_cents: number | null;
    zip_size: number | null;
  }>(
    `SELECT b.id, b.client_id, b.gift_recipient_user_id, b.delivery_password, b.delivery_expires_at,
            (b.updated_at + INTERVAL '14 days')::text AS auto_accept_at,
            u.name as photographer_name, u.avatar_url as photographer_avatar,
            pp.slug as photographer_slug, cu.name as client_name,
            b.shoot_date, b.location_slug,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            b.payment_status,
            COALESCE(b.zip_ready, FALSE) as zip_ready, b.zip_size,
            COALESCE(ez.ready, FALSE) as extras_zip_ready, ez.zip_size as extras_zip_size,
            b.extra_photo_price_cents, b.extra_photo_payout_cents,
            pp.extra_photo_payout_cents as profile_extra_photo_payout_cents,
            COALESCE(b.extras_gift_slots, 0) as gift_slots,
            (SELECT COUNT(*)::int FROM delivery_extra_purchases g
              WHERE g.booking_id = b.id AND g.status = 'paid' AND g.amount_cents = 0) as gift_used,
            (SELECT COUNT(*)::int FROM delivery_photos dp
              WHERE dp.booking_id = b.id AND dp.purchased_at IS NOT NULL
                AND (b.delivery_accepted_at IS NULL OR dp.purchased_at > b.delivery_accepted_at)
                AND EXISTS (SELECT 1 FROM delivery_extra_purchases x
                             WHERE x.delivery_photo_id = dp.id AND x.status = 'paid'
                               AND x.amount_cents > 0)) as extras_in_archive
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     LEFT JOIN delivery_extras_zip ez ON ez.booking_id = b.id
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
    is_included: boolean; purchased_at: string | null; paid_for: boolean;
  }>(
    `SELECT dp.id, dp.url, dp.preview_url, dp.thumbnail_url, dp.filename, dp.file_size,
            COALESCE(dp.media_type, 'image') as media_type, dp.duration_seconds, dp.width, dp.height,
            dp.is_included, dp.purchased_at,
            EXISTS (SELECT 1 FROM delivery_extra_purchases x
                     WHERE x.delivery_photo_id = dp.id AND x.status = 'paid'
                       AND x.amount_cents > 0) AS paid_for
     FROM delivery_photos dp WHERE dp.booking_id = $1 ORDER BY dp.sort_order, dp.created_at`,
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
  const photosRaw = await Promise.all(rawPhotos.map(async (photo) => {
    const isVideo = photo.media_type === "video";
    // Locked = shot but not part of this delivery and not bought. It is sent
    // to the browser so the client can see what is on offer, but it carries
    // ONLY the watermarked preview — in every URL field, including the
    // thumbnail and the one the lightbox opens. This matters more than it
    // looks: getPresignedUrl does not actually presign (src/lib/s3.ts), it
    // returns a permanent public link, so whatever string ends up in this
    // payload is the access control. There is no second gate behind it.
    const isLocked = !photo.is_included && !photo.purchased_at && !isVideo;
    // Without a watermarked file there is nothing to show a non-buyer, and the
    // original must never stand in for it. Preview generation is best-effort
    // (a HEIC that sharp refuses still gets a row), so this really happens.
    if (isLocked && !photo.preview_url) return null;
    // A photo with no watermarked file has nothing safe to show, so it is
    // never offered for sale (see the sellable query in /extras) and never
    // falls back to the original here.
    const rawUrl: string = isLocked
      ? (photo.preview_url as string)
      : isVideo
        ? photo.url
        // Bought photographs are the client's the moment they PAY — the receipt
        // promises full resolution and acceptance is a separate decision.
        //
        // A GIFTED photo is not a purchase. Handing over its original before
        // acceptance blows a hole through the acceptance gate: a photographer
        // could gift a hundred frames, the client downloads them at full
        // resolution and never accepts, and nobody is ever paid for the shoot.
        // Gifts stay watermarked and unlock with the rest of the delivery.
        : (isAccepted || photo.paid_for ? photo.url : (photo.preview_url || photo.url));
    let resolvedUrl = rawUrl;
    if (isS3Path(rawUrl)) resolvedUrl = await getPresignedUrl(s3KeyFromPath(rawUrl), 3600);

    let resolvedPreview: string | null = null;
    if (!isVideo && photo.preview_url) {
      resolvedPreview = isS3Path(photo.preview_url)
        ? await getPresignedUrl(s3KeyFromPath(photo.preview_url), 3600)
        : photo.preview_url;
    }

    // thumbnail_url is a CLEAN 1200px copy — it is uploaded from the same
    // buffer BEFORE the watermark is composited (delivery/route.ts, "Upload
    // the CLEAN 1200px buffer FIRST"). It exists so the grid does not have to
    // load 15MB originals. But the grid prefers it over preview_url, so
    // before the client accepted anything they were being shown, and could
    // save, unwatermarked 1200px images — the watermark was built and then
    // never displayed. Until acceptance an image's thumbnail is therefore the
    // watermarked preview; the clean one is only handed over once the
    // delivery is accepted. Videos keep their poster frame either way: it is
    // a still, and withholding it would leave the grid blank.
    const thumbSource = isLocked
      ? photo.preview_url
      // Same rule for the grid: the clean 1200px copy is an original in every
      // way that matters — it is what a screenshot would capture.
      : (isVideo || isAccepted || photo.paid_for)
        ? photo.thumbnail_url
        : (photo.preview_url || photo.thumbnail_url);

    let resolvedThumb: string | null = null;
    if (thumbSource) {
      resolvedThumb = isS3Path(thumbSource)
        ? await getPresignedUrl(s3KeyFromPath(thumbSource), 3600)
        : thumbSource;
    }
    return {
      id: photo.id,
      locked: isLocked,
      purchased: !!photo.purchased_at,
      paid: photo.paid_for,
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
  // A locked photo with no watermarked file is dropped above; it is not for
  // sale and there is nothing safe to show.
  const photos = photosRaw.filter((p): p is NonNullable<typeof p> => p !== null);

  // Tip card state: hide once a tip is PAID for this booking, and never
  // ask for a tip while a dispute is open (tone-deaf).
  const tipRow = await queryOne<{ id: string }>(
    "SELECT id FROM tips WHERE booking_id = $1 AND status = 'paid' LIMIT 1",
    [booking.id]
  ).catch(() => null);
  const openDispute = await queryOne<{ id: string }>(
    "SELECT id FROM disputes WHERE booking_id = $1 AND status IN ('open', 'under_review') LIMIT 1",
    [booking.id]
  ).catch(() => null);

  return NextResponse.json({
    booking_id: booking.id,
    client_id: booking.client_id,
    tipped: !!tipRow,
    tip_allowed: !openDispute && booking.payment_status === "paid",
    photographer_name: maskSurname(booking.photographer_name),
    photographer_avatar: booking.photographer_avatar,
    client_name: booking.client_name,
    shoot_date: booking.shoot_date,
    location_slug: booking.location_slug,
    expires_at: booking.delivery_expires_at,
    auto_accept_at: booking.auto_accept_at,
    photos,
    photo_count: photos.length,
    // What the extras strip needs to price a basket without hardcoding the
    // number in the browser. The server charges from its own constant either
    // way; this is display only.
    extras_price_cents: resolveExtrasPricing(booking).priceCents,
    gift_remaining: Math.max(0, booking.gift_slots - booking.gift_used),
    extras_available: photos.filter((p) => p.locked).length,
    // Split so the client can be told WHERE their photos came from: the
    // package they paid for, and whatever the photographer added on top.
    package_photos: photos.filter((p) => !p.locked && !p.purchased && p.media_type !== "video").length,
    gifted_photos: photos.filter((p) => p.purchased && !p.paid).length,
    delivery_accepted: isAccepted,
    payment_status: booking.payment_status,
    zip_ready: isAccepted && booking.zip_ready,
    // Bought photos are downloadable whether or not the delivery was
    // accepted — the client already paid for them.
    extras_zip_ready: booking.extras_zip_ready,
    extras_zip_size: booking.extras_zip_size,
    // Must agree with the archive's own predicate (src/lib/build-zip.ts), or
    // the client is offered a download of photos that file does not contain.
    extras_owned: booking.extras_in_archive,
    zip_size: booking.zip_size ? Number(booking.zip_size) : null,
  });
}
