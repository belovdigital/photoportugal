import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/gift-card/pause — clear the user's active_gift_card_id so
// they're no longer in gift mode. The card itself stays in 'claimed'
// state and can be re-activated later by clicking the original magic
// link from the email. Use this when the recipient wants to browse
// normally for a moment (or look at non-participating photographers,
// or check their dashboard) without prices being hidden.
export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await queryOne(
    "UPDATE users SET active_gift_card_id = NULL WHERE id = $1 RETURNING id",
    [userId]
  );
  return NextResponse.json({ ok: true });
}
