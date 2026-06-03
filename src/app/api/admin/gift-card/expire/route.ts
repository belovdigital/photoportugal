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

// Force-expire a gift card from admin. Used when buyer requests it, or
// when we want to clean up a stuck 'sent'/'claimed' card. Silent — no
// recipient email (the card was effectively cancelled by admin choice).
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { gift_card_id } = await req.json();
  if (!gift_card_id) return NextResponse.json({ error: "gift_card_id required" }, { status: 400 });
  const row = await queryOne(
    `UPDATE gift_cards
        SET status = 'expired'
      WHERE id = $1 AND status IN ('sent','claimed','purchased')
      RETURNING id`,
    [gift_card_id]
  );
  if (!row) return NextResponse.json({ error: "Card not in expirable state" }, { status: 409 });
  // Clear recipient's gift-mode flag if it pointed at this card.
  await queryOne(
    "UPDATE users SET active_gift_card_id = NULL WHERE active_gift_card_id = $1 RETURNING id",
    [gift_card_id]
  ).catch(() => null);
  return NextResponse.json({ ok: true });
}
