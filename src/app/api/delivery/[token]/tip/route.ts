import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/delivery/[token]/tip  { amount_eur, password? }
//
// Creates a Stripe Checkout session for an OPTIONAL tip after the client
// accepted the delivery. Auth mirrors the verify endpoint: gallery
// password OR a signed-in booking owner (client / gift recipient).
//
// Money model (user decision 2026-07-02): the client pays the tip amount
// straight; the platform keeps 10% (covers Stripe processing + margin),
// the photographer receives 90% via a Connect transfer fired from the
// checkout.session.completed webhook. One PAID tip per booking (partial
// unique index) — the UI hides the card once tipped.
const MIN_TIP_EUR = 5;
const MAX_TIP_EUR = 500;
const TIP_PLATFORM_RATE = 0.10;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!checkRateLimit(`delivery-tip:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, try again in a minute" }, { status: 429 });
  }

  let body: { amount_eur?: unknown; password?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amountEur = Math.round(Number(body.amount_eur));
  if (!Number.isFinite(amountEur) || amountEur < MIN_TIP_EUR || amountEur > MAX_TIP_EUR) {
    return NextResponse.json({ error: `Tip must be €${MIN_TIP_EUR}-${MAX_TIP_EUR}` }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";

  const booking = await queryOne<{
    id: string;
    client_id: string;
    gift_recipient_user_id: string | null;
    delivery_password: string;
    delivery_accepted: boolean;
    photographer_id: string;
    photographer_name: string;
    photographer_stripe_id: string | null;
    client_email: string;
    client_stripe_customer_id: string | null;
    locale: string | null;
  }>(
    `SELECT b.id, b.client_id, b.gift_recipient_user_id, b.delivery_password,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            b.photographer_id, u.name as photographer_name,
            pp.stripe_account_id as photographer_stripe_id,
            cu.email as client_email, cu.stripe_customer_id as client_stripe_customer_id,
            cu.locale
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`,
    [token]
  );
  if (!booking) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });

  // Auth: signed-in owner (client or gift recipient) OR gallery password —
  // same recognition logic as the verify endpoint.
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

  // Tips only make sense once the photos were accepted (the card only
  // renders then, but don't trust the client).
  if (!booking.delivery_accepted) {
    return NextResponse.json({ error: "Accept the delivery first" }, { status: 400 });
  }

  // One paid tip per booking.
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM tips WHERE booking_id = $1 AND status = 'paid' LIMIT 1",
    [booking.id]
  );
  if (existing) return NextResponse.json({ error: "Already tipped — thank you!" }, { status: 409 });

  const amountCents = amountEur * 100;
  const platformFeeCents = Math.round(amountCents * TIP_PLATFORM_RATE);
  const payoutCents = amountCents - platformFeeCents;

  const tip = await queryOne<{ id: string }>(
    `INSERT INTO tips (booking_id, client_id, photographer_id, amount_cents, platform_fee_cents, payout_cents, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
    [booking.id, booking.client_id, booking.photographer_id, amountCents, platformFeeCents, payoutCents]
  );
  if (!tip) return NextResponse.json({ error: "Failed to create tip" }, { status: 500 });

  const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
  const firstName = booking.photographer_name.split(" ")[0];
  const loc = booking.locale && ["pt", "de", "es", "fr"].includes(booking.locale) ? booking.locale : null;

  // Attach the saved Stripe customer ONLY when the signed-in payer IS the
  // booking client — the gallery is often opened by family members via the
  // shared token+password, and they must never see the client's saved
  // payment details. Everyone else pays as a guest.
  const payerIsClient = sessionUserId === booking.client_id;
  const checkout = await requireStripe().checkout.sessions.create({
    mode: "payment",
    ...(payerIsClient && booking.client_stripe_customer_id
      ? { customer: booking.client_stripe_customer_id }
      : { customer_email: booking.client_email }),
    locale: loc ? (loc as "pt" | "de" | "es" | "fr") : "auto",
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: `Tip for ${firstName} — Photo Portugal`,
          description: "A thank-you for your photographer. Goes to them, minus a small processing fee.",
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    payment_intent_data: {
      metadata: { tip_id: tip.id, booking_id: booking.id, type: "tip" },
    },
    success_url: `${BASE_URL}/delivery/${token}?tip=success`,
    cancel_url: `${BASE_URL}/delivery/${token}?tip=cancelled`,
    metadata: { type: "tip", tip_id: tip.id, booking_id: booking.id },
  }, { idempotencyKey: `tip_checkout_${tip.id}` });

  await queryOne("UPDATE tips SET stripe_session_id = $1 WHERE id = $2 RETURNING id", [checkout.id, tip.id]);

  return NextResponse.json({ url: checkout.url });
}
