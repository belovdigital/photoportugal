import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";

// Toggle the photographer's gift-card participation flag. Doesn't affect
// their existing standard packages — if they re-enable later, the same
// tier packages are still in the DB and immediately become bookable.
// Recipient-side filter on /photographers/ reads this flag, so a flip
// to FALSE removes the photographer from the gift-mode grid instantly.
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { accepts_gift_cards } = await req.json();
    if (typeof accepts_gift_cards !== "boolean") {
      return NextResponse.json({ error: "accepts_gift_cards must be a boolean" }, { status: 400 });
    }

    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!profile) return NextResponse.json({ error: "Photographer profile not found" }, { status: 404 });

    await queryOne(
      "UPDATE photographer_profiles SET accepts_gift_cards = $1 WHERE id = $2 RETURNING id",
      [accepts_gift_cards, profile.id]
    );

    return NextResponse.json({ ok: true, accepts_gift_cards });
  } catch (error) {
    console.error("[gift-cards-toggle] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
