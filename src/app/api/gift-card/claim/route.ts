import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { verifyGiftCardClaimToken, GIFT_CARD_TIERS, isGiftCardTier } from "@/lib/gift-card";

export const runtime = "nodejs";

// GET — verify the claim token and return non-secret data the page
// needs to render the right form (dormant user vs existing one + tier
// preview). The page also uses this to detect a stale/expired card.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const payload = verifyGiftCardClaimToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  const user = await queryOne<{ id: string; email: string; name: string; password_hash: string | null }>(
    "SELECT id, email, name, password_hash FROM users WHERE id = $1",
    [payload.recipientUserId]
  );
  if (!user) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  const card = await queryOne<{
    id: string; tier: string; status: string; expires_at: string; buyer_name: string;
    recipient_user_id: string | null; personal_message: string | null;
  }>(
    `SELECT id, tier, status, expires_at, buyer_name, recipient_user_id, personal_message
       FROM gift_cards WHERE id = $1`,
    [payload.giftCardId]
  );
  if (!card || card.recipient_user_id !== user.id) {
    return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
  }
  if (card.status === "redeemed") {
    return NextResponse.json({ error: "This gift card has already been used." }, { status: 410 });
  }
  if (card.status === "expired" || new Date(card.expires_at) < new Date()) {
    return NextResponse.json({ error: "This gift card has expired." }, { status: 410 });
  }
  if (!isGiftCardTier(card.tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 500 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    has_password: !!user.password_hash,
    gift_card_id: card.id,
    tier: card.tier,
    tier_meta: GIFT_CARD_TIERS[card.tier],
    buyer_name: card.buyer_name,
    personal_message: card.personal_message,
    expires_at: card.expires_at,
  });
}

// POST — token + password. Same shape as /api/gift/claim: set or
// validate password, then mark the user as "in gift mode" by writing
// active_gift_card_id. Client then NextAuth-signs-in with the same
// password and lands on /photographers/ in gift-mode.
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const payload = verifyGiftCardClaimToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

    const user = await queryOne<{ id: string; email: string; password_hash: string | null }>(
      "SELECT id, email, password_hash FROM users WHERE id = $1",
      [payload.recipientUserId]
    );
    if (!user) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

    const card = await queryOne<{ id: string; status: string; expires_at: string; recipient_user_id: string | null }>(
      "SELECT id, status, expires_at, recipient_user_id FROM gift_cards WHERE id = $1",
      [payload.giftCardId]
    );
    if (!card || card.recipient_user_id !== user.id) {
      return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
    }
    if (card.status === "redeemed") {
      return NextResponse.json({ error: "This gift card has already been used." }, { status: 410 });
    }
    if (card.status === "expired" || new Date(card.expires_at) < new Date()) {
      return NextResponse.json({ error: "This gift card has expired." }, { status: 410 });
    }

    if (user.password_hash) {
      const match = await compare(password, user.password_hash);
      if (!match) return NextResponse.json({ error: "Incorrect password for this account" }, { status: 401 });
    } else {
      const hashed = await hash(password, 12);
      await queryOne(
        "UPDATE users SET password_hash = $1, email_verified = TRUE, last_seen_at = NOW() WHERE id = $2 RETURNING id",
        [hashed, user.id]
      );
    }

    // Activate gift mode + flip card to 'claimed' if it was still 'sent'.
    await queryOne(
      "UPDATE users SET active_gift_card_id = $1 WHERE id = $2 RETURNING id",
      [card.id, user.id]
    );
    await queryOne(
      "UPDATE gift_cards SET status = 'claimed', claimed_at = COALESCE(claimed_at, NOW()) WHERE id = $1 AND status IN ('sent','purchased') RETURNING id",
      [card.id]
    );

    return NextResponse.json({ ok: true, email: user.email, gift_card_id: card.id });
  } catch (error) {
    console.error("[gift-card/claim] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
