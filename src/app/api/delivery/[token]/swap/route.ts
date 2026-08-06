import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import crypto from "crypto";
import { queryOne, withTransaction } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

/**
 * The client chooses WHICH photographs fill their package.
 *
 * The photographer decides how many — that is the promise they were paid for —
 * but they cannot know which frames the client will love. This swaps one photo
 * in and one photo out, leaving the count untouched.
 *
 * The whole security model is that last sentence. `is_included` is what
 * src/app/api/delivery/[token]/verify/route.ts reads to decide whether a photo
 * goes out watermarked or at full resolution, and getPresignedUrl does not
 * actually presign (src/lib/s3.ts) — the URL in that response IS the access
 * control, permanently. So an endpoint that lets a CLIENT flip that column is
 * one bad guard away from handing out the whole shoot. Hence:
 *
 *   - one in, one out, in a single transaction under an advisory lock, with
 *     the resulting count re-asserted against the promise before COMMIT;
 *   - a photo with purchased_at set never participates in either direction.
 *     It is already theirs; swapping it in would free a slot they had paid to
 *     fill, which is a refund with extra steps;
 *   - videos never participate — they were never part of a photo count;
 *   - nothing at all once the delivery is accepted: that is when the archive
 *     is written and the photographer is paid.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!checkRateLimit(`delivery-swap:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, try again in a minute" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password: string | undefined = body?.password;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const inId = typeof body?.in === "string" && UUID_RE.test(body.in) ? body.in : null;
  const outId = typeof body?.out === "string" && UUID_RE.test(body.out) ? body.out : null;
  if (!inId || !outId || inId === outId) {
    return NextResponse.json({ error: "Pick one photo to add and one to remove" }, { status: 400 });
  }

  const booking = await queryOne<{
    id: string;
    client_id: string;
    gift_recipient_user_id: string | null;
    delivery_password: string;
    delivery_expires_at: string | null;
    delivery_accepted: boolean;
    required_photos: number | null;
  }>(
    `SELECT b.id, b.client_id, b.gift_recipient_user_id, b.delivery_password,
            b.delivery_expires_at::text as delivery_expires_at,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            COALESCE(NULLIF(p.num_photos, 0), NULLIF(b.promised_photos, 0)) as required_photos
       FROM bookings b
       LEFT JOIN packages p ON p.id = b.package_id
      WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`,
    [token]
  );
  if (!booking) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });

  // Same recognition as the extras and verify endpoints: a signed-in owner, or
  // the gallery password everyone else was given.
  const session = await auth();
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id || null;
  const isOwner = !!sessionUserId &&
    (sessionUserId === booking.client_id || sessionUserId === booking.gift_recipient_user_id);
  if (!isOwner) {
    if (!password) return NextResponse.json({ error: "Password required" }, { status: 401 });
    const isBcrypt = booking.delivery_password?.startsWith("$2");
    const { compare: bcryptCompare } = await import("bcryptjs");
    const ok = isBcrypt
      ? await bcryptCompare(password, booking.delivery_password)
      : crypto.createHash("sha256").update(password).digest("hex") === booking.delivery_password;
    if (!ok) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  if (booking.delivery_expires_at && new Date(booking.delivery_expires_at) < new Date()) {
    return NextResponse.json({ error: "This gallery has expired" }, { status: 410 });
  }
  // After acceptance the archive is frozen and the payout has gone out.
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "This delivery has been accepted and can no longer be changed" }, { status: 409 });
  }
  const required = Number(booking.required_photos || 0);
  if (required <= 0) {
    return NextResponse.json({ error: "This delivery has no fixed photo count" }, { status: 409 });
  }

  const result = await withTransaction(async (client) => {
    // Serialise against a second tab and against the photographer editing the
    // same delivery. Same key the extras purchase path locks on.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.id]);

    const rows = await client.query(
      `SELECT id, is_included, purchased_at, COALESCE(media_type, 'image') AS media_type
         FROM delivery_photos
        WHERE booking_id = $1 AND id = ANY($2::uuid[])
        FOR UPDATE`,
      [booking.id, [inId, outId]]
    );
    const moveIn = rows.rows.find((r: { id: string }) => r.id === inId);
    const moveOut = rows.rows.find((r: { id: string }) => r.id === outId);
    if (!moveIn || !moveOut) return { error: "Those photos are not in this gallery", status: 404 };

    if (moveIn.media_type === "video" || moveOut.media_type === "video") {
      return { error: "Videos are always included and cannot be swapped", status: 400 };
    }
    // Already the client's — in either direction this would be nonsense.
    if (moveIn.purchased_at || moveOut.purchased_at) {
      return { error: "Photos you already own stay yours", status: 409 };
    }
    if (moveIn.is_included !== false) return { error: "That photo is already in your package", status: 409 };
    if (moveOut.is_included !== true) return { error: "That photo is not in your package", status: 409 };

    await client.query(
      "UPDATE delivery_photos SET is_included = TRUE WHERE id = $1 AND booking_id = $2",
      [inId, booking.id]
    );
    await client.query(
      "UPDATE delivery_photos SET is_included = FALSE WHERE id = $1 AND booking_id = $2",
      [outId, booking.id]
    );

    // The invariant, checked against the database rather than against our own
    // arithmetic: whatever else happened in this transaction, the package must
    // still hold exactly what was promised.
    const after = await client.query(
      `SELECT COUNT(*)::int AS n FROM delivery_photos
        WHERE booking_id = $1 AND is_included = TRUE
          AND COALESCE(media_type, 'image') <> 'video'`,
      [booking.id]
    );
    const n = after.rows[0]?.n ?? 0;
    if (n !== required) {
      throw new Error(`swap would leave ${n} included photos, expected ${required}`);
    }
    return { ok: true as const, included: n };
  }).catch((err: unknown) => {
    console.error("[delivery swap]", err);
    return { error: "Could not swap those photos", status: 500 };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // A pending checkout for the photo that just became part of the package
  // would sell the client something they now get for free.
  await queryOne(
    `UPDATE delivery_extra_purchases SET status = 'superseded'
      WHERE booking_id = $1 AND delivery_photo_id = $2 AND status = 'pending'
      RETURNING id`,
    [booking.id, inId]
  ).catch(() => null);

  return NextResponse.json({ success: true, included: result.included });
}
