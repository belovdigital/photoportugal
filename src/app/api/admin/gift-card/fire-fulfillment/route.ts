import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";
import { handleGiftCardPaymentSuccess } from "@/lib/gift-card-fulfillment";

export const runtime = "nodejs";

// Admin tool — manually re-fire the gift-card-paid webhook side-effects
// for a given card. Used for:
//   - Stripe webhook missed/delayed (rare but happens)
//   - E2E testing without a real Stripe payment
//   - Support cases where the buyer reports the recipient never got the email
//
// Idempotent: handleGiftCardPaymentSuccess no-ops if the card isn't in
// 'purchased' status, so re-firing on a 'sent' card is safe.
async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? !!verifyToken(token) : false;
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { gift_card_id } = await req.json();
    if (!gift_card_id) return NextResponse.json({ error: "gift_card_id required" }, { status: 400 });
    await handleGiftCardPaymentSuccess(gift_card_id, "admin-fire");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/gift-card/fire-fulfillment] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
