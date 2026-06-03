import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { verifyGiftToken } from "@/lib/gift-token";

export const runtime = "nodejs";

// GET /api/gift/claim?token=... — verifies a claim token, returns
// non-secret info the page needs to render the right form (email,
// name, whether the recipient already has a password set).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const payload = verifyGiftToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  const user = await queryOne<{
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
  }>(
    "SELECT id, email, name, password_hash FROM users WHERE id = $1",
    [payload.userId]
  );
  if (!user) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  // Confirm the booking still names this user as the gift recipient —
  // protects against token re-use after the booking is cancelled or the
  // recipient is reassigned.
  const booking = await queryOne<{
    id: string;
    gift_recipient_user_id: string | null;
    is_gift: boolean;
  }>(
    "SELECT id, gift_recipient_user_id, is_gift FROM bookings WHERE id = $1",
    [payload.bookingId]
  );
  if (!booking || !booking.is_gift || booking.gift_recipient_user_id !== user.id) {
    return NextResponse.json({ error: "This gift is no longer available" }, { status: 410 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    has_password: !!user.password_hash,
    booking_id: booking.id,
  });
}

// POST /api/gift/claim — token + password. If the recipient is dormant
// (no password yet), this sets it. If they have one, we validate it.
// Either way the response is "ok"; the client then NextAuth-signs-in
// with email + the same password.
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const payload = verifyGiftToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

    const user = await queryOne<{
      id: string;
      email: string;
      password_hash: string | null;
    }>(
      "SELECT id, email, password_hash FROM users WHERE id = $1",
      [payload.userId]
    );
    if (!user) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

    const booking = await queryOne<{
      id: string;
      gift_recipient_user_id: string | null;
      is_gift: boolean;
    }>(
      "SELECT id, gift_recipient_user_id, is_gift FROM bookings WHERE id = $1",
      [payload.bookingId]
    );
    if (!booking || !booking.is_gift || booking.gift_recipient_user_id !== user.id) {
      return NextResponse.json({ error: "This gift is no longer available" }, { status: 410 });
    }

    if (user.password_hash) {
      // Existing user — verify the password they typed matches.
      const match = await compare(password, user.password_hash);
      if (!match) return NextResponse.json({ error: "Incorrect password for this account" }, { status: 401 });
    } else {
      // Dormant — set the password they chose. Mark email_verified=true
      // because clicking the link proves they own the inbox.
      const hashed = await hash(password, 12);
      await queryOne(
        "UPDATE users SET password_hash = $1, email_verified = TRUE, last_seen_at = NOW() WHERE id = $2 RETURNING id",
        [hashed, user.id]
      );
    }

    return NextResponse.json({ ok: true, email: user.email, booking_id: booking.id });
  } catch (error) {
    console.error("[gift/claim] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
