import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { verifySignature } from "@/lib/makealbum/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MakeAlbum → PhotoPortugal handshake. Spec: docs/photoportugal-checkout.md
// (mirror copy lives in the makealbum repo). MakeAlbum calls us when the
// customer clicks "Order album" in the editor; we create a Stripe Checkout
// session, persist a tracking row, and return the URL for the redirect.
//
// Inert until PHOTO_PORTUGAL_API_KEY is configured — otherwise the route
// 404s so the integration doesn't leak in prod before launch.

interface InboundBody {
  version?: string;
  source?: string;
  orderId?: string;
  albumId?: string;
  title?: string;
  pageCount?: number;
  amountCents?: number;
  currency?: string;
  customer?: { email?: string; name?: string };
  urls?: {
    successUrl?: string;
    cancelUrl?: string;
    webhookUrl?: string;
  };
}

const ALLOWED_SHIPPING_COUNTRIES = [
  // Saal Digital ships worldwide; this is the union of EU + main English-
  // speaking markets where we expect early adopters. Add more as needed.
  "PT", "ES", "FR", "DE", "IT", "NL", "BE", "IE", "AT", "LU", "DK", "SE",
  "FI", "NO", "PL", "CZ", "HU", "GR", "RO", "BG", "HR", "SI", "SK", "EE",
  "LV", "LT", "MT", "CY", "CH", "GB", "US", "CA", "AU", "NZ",
] as const;

function unauthorized(reason: string) {
  console.warn(`[makealbum/checkout] rejected: ${reason}`);
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.PHOTO_PORTUGAL_API_KEY;
  // Hard inert: if the integration isn't enabled, pretend the route
  // doesn't exist so we don't leak the contract before launch.
  if (!apiKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ---- auth: bearer token ----
  const authHeader = req.headers.get("authorization") || "";
  const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!presented) return unauthorized("missing bearer");
  // Constant-time compare on equal-length buffers; mismatched lengths short-
  // circuit to false to keep the timing-safe contract.
  const expected = Buffer.from(apiKey);
  const got = Buffer.from(presented);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    return unauthorized("bearer mismatch");
  }

  // We must read the raw body BEFORE JSON.parse for HMAC verification —
  // any whitespace change between read paths would invalidate the
  // signature, even if both bodies parse to equivalent JSON.
  const rawBody = await req.text();

  // ---- auth: HMAC signature (when configured) ----
  const sharedSecret = process.env.PHOTO_PORTUGAL_SHARED_SECRET;
  if (sharedSecret) {
    const verdict = verifySignature({
      secret: sharedSecret,
      timestamp: req.headers.get("x-makealbum-timestamp"),
      signatureHeader: req.headers.get("x-makealbum-signature"),
      rawBody,
    });
    if (!verdict.ok) return unauthorized(`hmac: ${verdict.reason}`);
  }

  // ---- payload ----
  let body: InboundBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = (body.orderId || "").trim();
  const albumId = (body.albumId || "").trim();
  const amountCents = Number(body.amountCents);
  const currency = (body.currency || "EUR").toUpperCase();
  const successUrl = body.urls?.successUrl?.trim() || "";
  const cancelUrl = body.urls?.cancelUrl?.trim() || "";
  const webhookUrl = body.urls?.webhookUrl?.trim() || "";

  if (!orderId || !albumId) {
    return NextResponse.json({ error: "orderId and albumId are required" }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
  }
  if (currency !== "EUR") {
    // The handshake spec pins EUR; if MakeAlbum starts supporting more
    // currencies we'll relax this with a documented allowlist.
    return NextResponse.json({ error: "currency must be EUR" }, { status: 400 });
  }
  if (!successUrl || !cancelUrl || !webhookUrl) {
    return NextResponse.json({ error: "urls.successUrl, cancelUrl and webhookUrl required" }, { status: 400 });
  }

  // ---- idempotency: same (orderId, albumId) → reuse pending row ----
  const existing = await queryOne<{
    id: string;
    status: string;
    stripe_session_id: string | null;
    amount_cents: number;
  }>(
    `SELECT id, status, stripe_session_id, amount_cents
       FROM makealbum_orders
      WHERE makealbum_order_id = $1 AND makealbum_album_id = $2`,
    [orderId, albumId],
  );

  if (existing && existing.status === "pending" && existing.stripe_session_id) {
    // Re-fetch the Stripe session to confirm it's still usable.
    try {
      const stripe = requireStripe();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await (stripe.checkout.sessions.retrieve as any)(existing.stripe_session_id);
      if (session?.url && session.status === "open") {
        return NextResponse.json({ checkoutUrl: session.url, checkoutId: existing.id });
      }
    } catch (err) {
      console.warn("[makealbum/checkout] failed to reuse Stripe session, creating new:", err);
    }
    // Fall through and create a new session below.
  }
  if (existing && existing.status === "paid") {
    return NextResponse.json({ error: "Order already paid" }, { status: 409 });
  }

  // ---- create Stripe Checkout session ----
  const ppCheckoutId = existing?.id || `pp_chk_${crypto.randomBytes(16).toString("hex")}`;
  const stripe = requireStripe();

  // success_url must carry session_id so the makealbum side can correlate
  // the redirect back with the session if it needs to poll status.
  const successWithSession = successUrl.includes("session_id=")
    ? successUrl
    : successUrl + (successUrl.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}";

  let session: { id: string; url: string | null; payment_intent: string | null };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session = await (stripe.checkout.sessions.create as any)({
      mode: "payment",
      currency: "eur",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: body.title ? `Photo album — ${body.title}` : "Photo album",
              description: body.pageCount ? `${body.pageCount} pages` : undefined,
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ALLOWED_SHIPPING_COUNTRIES },
      phone_number_collection: { enabled: true },
      customer_email: body.customer?.email || undefined,
      success_url: successWithSession,
      cancel_url: cancelUrl,
      metadata: {
        source: "makealbum",
        makealbum_order_id: orderId,
        makealbum_album_id: albumId,
        pp_checkout_id: ppCheckoutId,
        webhook_url: webhookUrl,
      },
      payment_intent_data: {
        // Mirror metadata onto the PI so the post-payment webhook can find
        // its way back to us even if Stripe sends only the PI event.
        metadata: {
          source: "makealbum",
          makealbum_order_id: orderId,
          makealbum_album_id: albumId,
          pp_checkout_id: ppCheckoutId,
        },
      },
    });
  } catch (err) {
    console.error("[makealbum/checkout] Stripe session create failed:", err);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 502 });
  }

  // ---- persist row ----
  await query(
    `INSERT INTO makealbum_orders
        (id, makealbum_order_id, makealbum_album_id, title, page_count,
         amount_cents, currency, customer_email, customer_name,
         success_url, cancel_url, webhook_url,
         stripe_session_id, raw_request)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (makealbum_order_id, makealbum_album_id) DO UPDATE
        SET title             = EXCLUDED.title,
            page_count        = EXCLUDED.page_count,
            amount_cents      = EXCLUDED.amount_cents,
            stripe_session_id = EXCLUDED.stripe_session_id,
            raw_request       = EXCLUDED.raw_request`,
    [
      ppCheckoutId,
      orderId,
      albumId,
      body.title || null,
      Number.isFinite(body.pageCount) ? body.pageCount : null,
      amountCents,
      currency,
      body.customer?.email || null,
      body.customer?.name || null,
      successUrl,
      cancelUrl,
      webhookUrl,
      session.id,
      JSON.stringify(body),
    ],
  );

  if (!session.url) {
    return NextResponse.json({ error: "Stripe returned no checkout URL" }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl: session.url, checkoutId: ppCheckoutId });
}
