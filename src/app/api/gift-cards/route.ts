import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { authFromRequest } from "@/lib/mobile-auth";
import { requireStripe } from "@/lib/stripe";
import { GIFT_CARD_TIERS, isGiftCardTier, generateGiftCardCode, defaultGiftCardExpiry } from "@/lib/gift-card";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/gift-cards — start a gift card purchase. Creates the
// gift_card row in 'purchased' state (Stripe-pending) and returns a
// Stripe Checkout URL. The actual recipient email/SMS is fired by the
// Stripe webhook on payment_intent.succeeded — never before, so we
// don't promise gifts that didn't pay.
export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per IP per minute. Stops a flaky-network or
  // malicious client from creating dozens of gift_card rows + Stripe
  // sessions in seconds. Stripe idempotency only catches re-submits
  // of the SAME card.id; a new POST creates a new card.id each time.
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`gift-cards:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute and try again." }, { status: 429 });
  }
  try {
    const body = await req.json();
    const {
      tier, recipient_name, recipient_email, recipient_phone,
      personal_message, buyer_name, buyer_email, locale,
    } = body || {};

    if (!isGiftCardTier(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    const meta = GIFT_CARD_TIERS[tier];

    // Recipient validation — same minimums as the gift-booking flow.
    const rn = typeof recipient_name === "string" ? recipient_name.trim() : "";
    const re = typeof recipient_email === "string" ? recipient_email.trim().toLowerCase() : "";
    if (!rn) return NextResponse.json({ error: "Recipient name is required" }, { status: 400 });
    if (!re || !re.includes("@") || !re.includes(".")) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    // Buyer can be a signed-in user OR a guest who provides name+email.
    // Either way we record name/email on the card row for the recipient
    // to see "Gift from X" and for support to reach the buyer.
    const sessionUser = await authFromRequest(req);
    const bn = (typeof buyer_name === "string" && buyer_name.trim()) || sessionUser?.email?.split("@")[0] || "";
    const be = (typeof buyer_email === "string" && buyer_email.trim().toLowerCase()) || sessionUser?.email || "";
    if (!bn) return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    if (!be || !be.includes("@")) return NextResponse.json({ error: "Your email is required" }, { status: 400 });

    // Same email guard: applies whether buyer is signed in or anonymous.
    // Without this, an anonymous attacker can repeatedly buy a card for
    // an existing user's email — they can't hijack the account (claim
    // requires the existing password), but they could spam the inbox.
    if (be.toLowerCase() === re) {
      return NextResponse.json({ error: "Recipient email matches your own — enter the gift recipient's email." }, { status: 400 });
    }

    // Phone optional (used for SMS nudge); strip non-digits before storing.
    const rp = typeof recipient_phone === "string" ? recipient_phone.trim() : "";
    const rpDigits = rp.replace(/\D/g, "");
    const recipientPhoneSafe = rpDigits.length >= 6 ? rp : null;

    const message = typeof personal_message === "string" ? personal_message.trim().slice(0, 500) : null;

    // Unique code with collision retry (extremely unlikely with 8-char base32).
    let code = generateGiftCardCode();
    for (let i = 0; i < 5; i++) {
      const collision = await queryOne("SELECT id FROM gift_cards WHERE code = $1", [code]);
      if (!collision) break;
      code = generateGiftCardCode();
    }

    const expiresAt = defaultGiftCardExpiry();

    const card = await queryOne<{ id: string }>(
      `INSERT INTO gift_cards (
         code, tier, amount, photographer_payout, status,
         buyer_user_id, buyer_name, buyer_email,
         recipient_name, recipient_email, recipient_phone, personal_message,
         expires_at
       ) VALUES ($1, $2, $3, $4, 'purchased', $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        code, tier, meta.buyerPrice, meta.photographerPayout,
        sessionUser?.id || null, bn, be,
        rn, re, recipientPhoneSafe, message,
        expiresAt.toISOString(),
      ]
    );
    if (!card) return NextResponse.json({ error: "Could not create gift card" }, { status: 500 });

    // Stripe checkout — single line item at the buyer-facing tier price.
    // metadata.gift_card_id is the webhook hook that triggers the
    // recipient email/SMS once payment_intent.succeeded fires.
    const localeNorm = ["pt","de","es","fr"].includes(locale) ? locale : "auto";
    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

    const stripe = requireStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: localeNorm as "pt" | "de" | "es" | "fr" | "auto",
      customer_email: be,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Photo Portugal — ${meta.label} Gift Session`,
            description: meta.description,
          },
          unit_amount: Math.round(meta.buyerPrice * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        metadata: {
          gift_card_id: card.id,
          gift_card_code: code,
          gift_card_tier: tier,
          recipient_email: re,
        },
      },
      metadata: {
        gift_card_id: card.id,
        type: "gift_card",
      },
      success_url: `${BASE_URL}/gift-cards/success?card=${card.id}`,
      cancel_url: `${BASE_URL}/gift-cards?cancelled=1`,
    }, {
      idempotencyKey: `giftcard_${card.id}`,
    });

    // Store session id on the card so the webhook can de-dup if needed.
    await queryOne(
      "UPDATE gift_cards SET stripe_checkout_session_id = $1 WHERE id = $2 RETURNING id",
      [checkoutSession.id, card.id]
    );

    return NextResponse.json({ url: checkoutSession.url, gift_card_id: card.id, code });
  } catch (error) {
    console.error("[gift-cards] POST error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/gift-cards", method: "POST", statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to create gift card" }, { status: 500 });
  }
}
