import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? !!verifyToken(token) : false;
}

// Mark a gift card as refunded from admin UI. Note: this does NOT
// trigger a Stripe refund — admin still needs to issue the refund on
// the Stripe dashboard or via API. This endpoint only updates our
// database so the gift card stops being redeemable and admin reports
// reflect the chargeback/refund. Use for support cases or
// duplicate purchases.
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { gift_card_id } = await req.json();
  if (!gift_card_id) return NextResponse.json({ error: "gift_card_id required" }, { status: 400 });
  const row = await queryOne(
    `UPDATE gift_cards
        SET status = 'refunded'
      WHERE id = $1 AND status NOT IN ('redeemed')
      RETURNING id`,
    [gift_card_id]
  );
  if (!row) return NextResponse.json({ error: "Card is redeemed — cannot mark refunded (booking exists). Cancel the booking first." }, { status: 409 });
  await queryOne(
    "UPDATE users SET active_gift_card_id = NULL WHERE active_gift_card_id = $1 RETURNING id",
    [gift_card_id]
  ).catch(() => null);
  return NextResponse.json({ ok: true });
}
