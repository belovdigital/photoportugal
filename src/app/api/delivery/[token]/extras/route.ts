import { NextRequest, NextResponse } from "next/server";
import { resolveExtrasPricing } from "@/lib/extras-pricing";
import crypto from "crypto";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { country } from "@/lib/country";

export const dynamic = "force-dynamic";

// POST /api/delivery/[token]/extras  { photo_ids: string[], password? }
//
// Buys photographs the booking never promised. Only a photo the photographer
// left OUT of the delivery (is_included = FALSE) can be bought, which is why
// this is inert on every delivery that exists today: nothing has ever written
// that flag to FALSE, so no gallery currently has anything for sale.
//
// Money (decided 2026-08-05, see docs/DELIVERY-EXTRAS.md): the client pays a
// flat EUR 2.90 per photo, all in. EUR 2.00 goes to the photographer, EUR 0.90
// stays with the platform, on every plan — an extra frame costs the
// photographer nothing to produce, it is already shot and edited.
//
// The rows are written pending BEFORE the redirect and only the webhook marks
// them paid. Abandon the checkout, close the tab, have the card decline — no
// row is ever flipped, nothing unlocks.
const MAX_PHOTOS_PER_ORDER = 200;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!checkRateLimit(`delivery-extras:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, try again in a minute" }, { status: 429 });
  }

  let body: { photo_ids?: unknown; password?: unknown; gift?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const photoIds = Array.isArray(body.photo_ids)
    ? [...new Set(body.photo_ids.filter((v): v is string => typeof v === "string" && UUID_RE.test(v)))]
    : [];
  if (photoIds.length === 0) {
    return NextResponse.json({ error: "Select at least one photo" }, { status: 400 });
  }
  if (photoIds.length > MAX_PHOTOS_PER_ORDER) {
    return NextResponse.json({ error: `At most ${MAX_PHOTOS_PER_ORDER} photos per purchase` }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";

  const booking = await queryOne<{
    id: string;
    client_id: string;
    gift_recipient_user_id: string | null;
    delivery_password: string;
    delivery_expires_at: string | null;
    photographer_id: string;
    photographer_name: string;
    client_email: string;
    client_stripe_customer_id: string | null;
    locale: string | null;
    extra_photo_price_cents: number | null;
    extra_photo_payout_cents: number | null;
    profile_extra_photo_payout_cents: number | null;
  }>(
    `SELECT b.id, b.client_id, b.gift_recipient_user_id, b.delivery_password,
            b.delivery_expires_at::text as delivery_expires_at,
            b.photographer_id, u.name as photographer_name,
            cu.email as client_email, cu.stripe_customer_id as client_stripe_customer_id,
            cu.locale,
            b.extra_photo_price_cents, b.extra_photo_payout_cents,
            pp.extra_photo_payout_cents as profile_extra_photo_payout_cents
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`,
    [token]
  );
  if (!booking) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });

  // The booking's own snapshot wins, so a rate change never rewrites a price
  // the client has already been shown.
  const { priceCents: PRICE_CENTS, payoutCents: PAYOUT_CENTS, platformFeeCents: PLATFORM_FEE_CENTS } =
    resolveExtrasPricing(booking);

  // Auth: identical recognition to the verify and tip endpoints — a signed-in
  // owner, or the gallery password everyone else was given.
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

  // Selling access to a gallery that has already gone dark would take money
  // for something the client cannot open.
  if (booking.delivery_expires_at && new Date(booking.delivery_expires_at) < new Date()) {
    return NextResponse.json({ error: "This gallery has expired" }, { status: 410 });
  }

  // ── The photographer's gift ─────────────────────────────────────
  // N of the extras, free, photographer's choice of N, client's choice of
  // which. A redemption is a zero-amount PAID purchase: same table, same
  // one-paid-row-per-photo index, same purchased_at, same archive — so every
  // rule that protects a bought photo protects a gifted one, and no money
  // code runs at all (payout 0, transferred already true).
  if (body.gift === true) {
    const gifted = await withTransaction(async (client) => {
      // The advisory lock serialises concurrent redemptions per booking
      // without touching the bookings row — an UPDATE there would stamp
      // updated_at, which feeds the 14-day auto-accept.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.id]);
      const slotRow = await client.query(
        `SELECT COALESCE(b.extras_gift_slots, 0)::int AS slots,
                (SELECT COUNT(*)::int FROM delivery_extra_purchases g
                  WHERE g.booking_id = b.id AND g.status = 'paid' AND g.amount_cents = 0) AS used
           FROM bookings b WHERE b.id = $1`,
        [booking.id]
      );
      const slots = slotRow.rows[0]?.slots ?? 0;
      const used = slotRow.rows[0]?.used ?? 0;
      const remaining = Math.max(0, slots - used);
      if (remaining === 0) return { error: "No gift photos left on this delivery", status: 400 };
      if (photoIds.length > remaining) {
        return { error: `Only ${remaining} gift photo${remaining === 1 ? "" : "s"} left — unselect ${photoIds.length - remaining}`, status: 400 };
      }
      const rows = await client.query(
        `SELECT dp.id, dp.filename FROM delivery_photos dp
          WHERE dp.booking_id = $1 AND dp.id = ANY($2::uuid[])
            AND dp.is_included = FALSE AND dp.purchased_at IS NULL
            AND COALESCE(dp.media_type, 'image') <> 'video'`,
        [booking.id, photoIds]
      );
      if (rows.rows.length === 0) return { error: "Those photos are not available", status: 409 };
      const giftOrder = crypto.randomUUID();
      await client.query(
        `INSERT INTO delivery_extra_purchases
           (order_id, booking_id, delivery_photo_id, photo_filename, client_id, photographer_id,
            amount_cents, platform_fee_cents, payout_cents, status, transferred, paid_at)
         SELECT $1, $2, p.id, p.filename, $3, $4, 0, 0, 0, 'paid', TRUE, NOW()
           FROM UNNEST($5::uuid[], $6::text[]) AS p(id, filename)`,
        [giftOrder, booking.id, booking.client_id, booking.photographer_id,
         rows.rows.map((r: { id: string }) => r.id), rows.rows.map((r: { filename: string | null }) => r.filename ?? null)]
      );
      await client.query(
        "UPDATE delivery_photos SET purchased_at = NOW() WHERE id = ANY($1::uuid[]) AND purchased_at IS NULL",
        [rows.rows.map((r: { id: string }) => r.id)]
      );
      return { count: rows.rows.length, left: remaining - rows.rows.length };
    }).catch((err: unknown) => {
      // The unique index turns a concurrent double-redeem of the same photo
      // into a clean conflict rather than a duplicate gift.
      if (String(err).includes("23505") || String(err).includes("duplicate key")) {
        return { error: "Those photos are already yours", status: 409 };
      }
      throw err;
    });

    if ("error" in gifted) {
      return NextResponse.json({ error: gifted.error }, { status: gifted.status });
    }

    // Same follow-through as a paid order: the archive of owned photos is
    // stale now, and both sides should hear about it.
    await queryOne(
      `INSERT INTO delivery_extras_zip (booking_id, ready, updated_at)
       VALUES ($1, FALSE, NOW())
       ON CONFLICT (booking_id) DO UPDATE SET ready = FALSE, updated_at = NOW()
       RETURNING booking_id`,
      [booking.id]
    ).catch(() => null);
    import("@/lib/build-zip").then(({ buildDeliveryZip }) =>
      buildDeliveryZip(booking.id, "extras")
    ).catch(() => {});
    import("@/lib/realtime").then((m) => {
      m.notifyUser(booking.client_id, "delivery_uploaded", { bookingId: booking.id });
    }).catch(() => {});

    // Redemption is per photo now — a tap IS the gift — so notifying per photo
    // fired ten Telegram messages, ten emails and ten pushes for one client
    // picking ten photos. Coalesce: the last tap within the window wins and
    // reports the total. In-memory is enough; the process is long-lived under
    // pm2, and the worst case of a restart mid-pick is a lost notification,
    // not a lost photo.

    return NextResponse.json({ gifted: gifted.count });
  }

  // A retry after a cancelled checkout must work — the basket survives
  // cancellation on purpose, and "оплата не прошла, пробую ещё раз" is the
  // normal path, not the edge. So a new order SUPERSEDES any previous pending
  // one: its Stripe session is expired so the old payment page cannot be paid
  // later, and its rows stop blocking the sellable query. This is also the
  // stronger defence against the same photo sitting in two live checkouts —
  // the 24h guard below then only catches truly concurrent clicks.
  const prior = await query<{ order_id: string; stripe_session_id: string | null }>(
    `SELECT DISTINCT order_id, stripe_session_id FROM delivery_extra_purchases
      WHERE booking_id = $1 AND status = 'pending'`,
    [booking.id]
  );
  for (const o of prior) {
    if (o.stripe_session_id) {
      try {
        await requireStripe().checkout.sessions.expire(o.stripe_session_id);
      } catch {
        // Already expired or completed. If it completed in this same instant,
        // the webhook honours superseded rows, so the payment is not lost.
      }
    }
  }
  if (prior.length > 0) {
    await query(
      "UPDATE delivery_extra_purchases SET status = 'superseded' WHERE booking_id = $1 AND status = 'pending'",
      [booking.id]
    );
  }

  // What is actually for sale: rows of THIS booking, left out of the delivery,
  // not already bought. Anything else in the request is dropped rather than
  // silently charged for.
  const sellable = await query<{ id: string; filename: string | null }>(
    `SELECT dp.id, dp.filename
       FROM delivery_photos dp
      WHERE dp.booking_id = $1
        AND dp.id = ANY($2::uuid[])
        AND dp.is_included = FALSE
        AND dp.purchased_at IS NULL
        AND COALESCE(dp.media_type, 'image') <> 'video'
        -- Not already sitting in a live checkout. A Stripe session stays
        -- payable for about a day, and the basket deliberately survives a
        -- cancellation, so the same photo could otherwise be bought twice.
        AND NOT EXISTS (
          SELECT 1 FROM delivery_extra_purchases pending
           WHERE pending.delivery_photo_id = dp.id
             AND pending.status = 'pending'
             AND pending.created_at > NOW() - INTERVAL '24 hours'
        )`,
    [booking.id, photoIds]
  );
  if (sellable.length === 0) {
    return NextResponse.json(
      { error: "Those photos are not for sale — they may already be yours" },
      { status: 409 }
    );
  }

  const orderId = crypto.randomUUID();
  const totalCents = sellable.length * PRICE_CENTS;

  // One row per photo: a refund, a dispute or a deleted file can then be
  // reasoned about per item, and the money record outlives the photo.
  await query(
    `INSERT INTO delivery_extra_purchases
       (order_id, booking_id, delivery_photo_id, photo_filename, client_id, photographer_id,
        amount_cents, platform_fee_cents, payout_cents, status)
     SELECT $1, $2, p.id, p.filename, $3, $4, $5, $6, $7, 'pending'
       FROM UNNEST($8::uuid[], $9::text[]) AS p(id, filename)`,
    [
      orderId, booking.id, booking.client_id, booking.photographer_id,
      PRICE_CENTS, PLATFORM_FEE_CENTS, PAYOUT_CENTS,
      sellable.map((p) => p.id), sellable.map((p) => p.filename ?? null),
    ]
  );

  const BASE_URL = process.env.AUTH_URL || country.baseUrl;
  const firstName = booking.photographer_name.split(" ")[0];
  const loc = booking.locale && ["pt", "de", "es", "fr"].includes(booking.locale) ? booking.locale : null;
  const payerIsClient = sessionUserId === booking.client_id;

  const checkout = await requireStripe().checkout.sessions.create({
    mode: "payment",
    // Cards only, deliberately. Deferred methods (Multibanco and friends)
    // report the session complete while payment_status is still "unpaid" and
    // settle hours later; no branch in this webhook reads that field and there
    // are no async-payment handlers, so a deferred method would hand over the
    // photos before the money arrives.
    payment_method_types: ["card"],
    ...(payerIsClient && booking.client_stripe_customer_id
      ? { customer: booking.client_stripe_customer_id }
      : { customer_email: booking.client_email }),
    locale: loc ? (loc as "pt" | "de" | "es" | "fr") : "auto",
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: `${sellable.length} extra photo${sellable.length === 1 ? "" : "s"} — ${firstName}`,
          description: "Photographs from your session beyond the ones included in your package.",
        },
        unit_amount: PRICE_CENTS,
      },
      quantity: sellable.length,
    }],
    // Both metadata bags on purpose. The session one routes the webhook; the
    // payment-intent one is what stops payment_intent.succeeded from treating
    // this as the booking's own charge and overwriting its payment intent id —
    // exactly what tips did to three bookings before 2026-08-04.
    payment_intent_data: {
      metadata: { order_id: orderId, booking_id: booking.id, type: "extra_photos" },
    },
    success_url: `${BASE_URL}/delivery/${token}?extras=success`,
    cancel_url: `${BASE_URL}/delivery/${token}?extras=cancelled`,
    metadata: { type: "extra_photos", order_id: orderId, booking_id: booking.id },
  }, { idempotencyKey: `extras_checkout_${orderId}` });

  await query(
    "UPDATE delivery_extra_purchases SET stripe_session_id = $1 WHERE order_id = $2",
    [checkout.id, orderId]
  );

  return NextResponse.json({
    url: checkout.url,
    photos: sellable.length,
    total_eur: (totalCents / 100).toFixed(2),
  });
}
