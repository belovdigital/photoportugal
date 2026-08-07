import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import crypto from "crypto";
import { query, queryOne, withTransaction } from "@/lib/db";
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
  // Two modes behind one set of guards: exchange a photo, or just rearrange.
  // Reordering is the client putting their own favourites first; it moves
  // nothing between the free and paid sides, so it needs no count assertion.
  const ungiftId = typeof body?.ungift === "string" && UUID_RE.test(body.ungift) ? body.ungift : null;
  const order: string[] | null = Array.isArray(body?.order)
    ? [...new Set((body.order as unknown[]).filter((v): v is string => typeof v === "string" && UUID_RE.test(v)))]
    : null;
  if (!order && !ungiftId && (!inId || !outId || inId === outId)) {
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
  // Hand a gifted photo back and get the slot returned. Only a gift can be
  // given back — a paid photo is a purchase — and only before acceptance,
  // while it is still a watermarked preview and nothing has been downloaded.
  // This is what makes redeeming safe to do without a confirmation.
  if (ungiftId) {
    const removed = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.id]);
      const row = await client.query(
        `SELECT id FROM delivery_extra_purchases
          WHERE booking_id = $1 AND delivery_photo_id = $2 AND status = 'paid' AND amount_cents = 0
          FOR UPDATE`,
        [booking.id, ungiftId]
      );
      if (row.rows.length === 0) return { error: "That photo was not part of the gift", status: 409 };
      await client.query("DELETE FROM delivery_extra_purchases WHERE id = $1", [row.rows[0].id]);
      await client.query(
        "UPDATE delivery_photos SET purchased_at = NULL WHERE id = $1 AND booking_id = $2",
        [ungiftId, booking.id]
      );
      return { ok: true as const };
    }).catch((err: unknown) => {
      console.error("[delivery ungift]", err);
      return { error: "Could not give that photo back", status: 500 };
    });
    if ("error" in removed) {
      return NextResponse.json({ error: removed.error }, { status: removed.status });
    }
    return NextResponse.json({ success: true, ungifted: true });
  }

  if (order) {
    if (order.length === 0 || order.length > 1000) {
      return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });
    }
    const updated = await query<{ id: string }>(
      `UPDATE delivery_photos dp
          SET sort_order = o.rn - 1
         FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, rn)
        WHERE dp.id = o.id AND dp.booking_id = $1
        RETURNING dp.id`,
      [booking.id, order]
    );
    return NextResponse.json({ success: true, reordered: updated.length });
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
    // A PAID photo can never move. Its original is served the moment the money
    // lands, so letting it trade places would mean buying one frame,
    // downloading it, swapping, downloading the next — the whole shoot for the
    // price of one.
    const paidRow = await client.query(
      `SELECT delivery_photo_id, amount_cents FROM delivery_extra_purchases
        WHERE booking_id = $1 AND delivery_photo_id = ANY($2::uuid[]) AND status = 'paid'`,
      [booking.id, [inId, outId]]
    );
    const isPaid = (id: string) =>
      paidRow.rows.some((r: { delivery_photo_id: string; amount_cents: number }) =>
        r.delivery_photo_id === id && r.amount_cents > 0);
    if (isPaid(inId) || isPaid(outId)) {
      return { error: "Photos you have paid for stay yours", status: 409 };
    }

    // A GIFT is different. Before acceptance it is still a watermarked preview
    // — nothing has been downloaded — so exchanging it is the client changing
    // their mind about which frames the photographer's gift applies to, not a
    // refund. Re-point the redemption instead of touching is_included: the
    // package count is not involved on either side.
    const giftOut = paidRow.rows.find((r: { delivery_photo_id: string; amount_cents: number }) =>
      r.delivery_photo_id === outId && r.amount_cents === 0);
    if (giftOut) {
      if (moveIn.is_included !== false || moveIn.purchased_at) {
        return { error: "Pick a photo that is still on offer", status: 409 };
      }
      await client.query(
        "UPDATE delivery_photos SET purchased_at = NULL WHERE id = $1 AND booking_id = $2",
        [outId, booking.id]
      );
      await client.query(
        "UPDATE delivery_photos SET purchased_at = NOW() WHERE id = $1 AND booking_id = $2",
        [inId, booking.id]
      );
      await client.query(
        `UPDATE delivery_extra_purchases
            SET delivery_photo_id = $1,
                photo_filename = (SELECT filename FROM delivery_photos WHERE id = $1)
          WHERE booking_id = $2 AND delivery_photo_id = $3 AND status = 'paid' AND amount_cents = 0`,
        [inId, booking.id, outId]
      );
      return { ok: true as const, included: -1, gift: true };
    }

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
  // 'superseded' is claimed by the webhook (it accepts pending OR superseded,
  // so a retry after a cancelled checkout still works), which made this guard
  // a no-op: the client could still pay for a photo they had just swapped in
  // for free. 'voided' is claimed by nothing, and the session is expired so
  // the page cannot be paid from a stale tab either.
  const voided = await queryOne<{ stripe_session_id: string | null }>(
    `UPDATE delivery_extra_purchases SET status = 'voided'
      WHERE booking_id = $1 AND delivery_photo_id = $2 AND status = 'pending'
      RETURNING stripe_session_id`,
    [booking.id, inId]
  ).catch(() => null);
  if (voided?.stripe_session_id) {
    try {
      const { requireStripe } = await import("@/lib/stripe");
      await requireStripe().checkout.sessions.expire(voided.stripe_session_id);
    } catch { /* already expired or completed — the status change is the guard */ }
  }

  return NextResponse.json({ success: true, included: result.included });
}
