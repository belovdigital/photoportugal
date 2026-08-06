import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { clientExtraPriceCents, DEFAULT_EXTRA_PHOTO_PAYOUT_CENTS } from "@/lib/extras-pricing";

// What the photographer earns per extra photo sold. Account-level, like their
// plan — one rate across all their packages, because a client comparing two
// packages from the same photographer should not find two different prices for
// the same thing.
//
// Separate endpoint rather than a field on /api/dashboard/profile for the same
// reason booking-settings is: that one replaces every profile field, and this
// nudges a single number.

/** €1 to €100 to the photographer. Below a euro the fees eat it; above a
 *  hundred it is a print sale, not an extra frame. */
const MIN_PAYOUT_CENTS = 100;
const MAX_PAYOUT_CENTS = 10_000;

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await queryOne<{ extra_photo_payout_cents: number }>(
    "SELECT COALESCE(extra_photo_payout_cents, $2) AS extra_photo_payout_cents FROM photographer_profiles WHERE user_id = $1",
    [user.id, DEFAULT_EXTRA_PHOTO_PAYOUT_CENTS]
  );
  if (!row) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({
    payout_cents: row.extra_photo_payout_cents,
    client_price_cents: clientExtraPriceCents(row.extra_photo_payout_cents),
  });
}

export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const cents = Math.round(Number(body?.payout_cents));
  if (!Number.isInteger(cents) || cents < MIN_PAYOUT_CENTS || cents > MAX_PAYOUT_CENTS) {
    return NextResponse.json(
      { error: `Your price must be between €${MIN_PAYOUT_CENTS / 100} and €${MAX_PAYOUT_CENTS / 100} per photo` },
      { status: 400 }
    );
  }

  const updated = await queryOne<{ id: string }>(
    `UPDATE photographer_profiles SET extra_photo_payout_cents = $2
      WHERE user_id = $1 RETURNING id`,
    [user.id, cents]
  );
  if (!updated) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Deliberately does NOT touch bookings.extra_photo_price_cents. Every booking
  // carries the rate that was current when it was made; changing it under a
  // client who is already looking at a gallery would be a bait and switch.
  return NextResponse.json({
    success: true,
    payout_cents: cents,
    client_price_cents: clientExtraPriceCents(cents),
  });
}
