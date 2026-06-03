import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records the outcome of an AI-chips suggestion round so we can tune the
// prompt over time. `chip_chosen` null = miss ("none of these fit");
// otherwise it's the exact text the photographer used.

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    booking_id?: string;
    chips_offered?: string[];
    chip_chosen?: string | null;
  } = {};
  try { body = await req.json(); } catch {}
  const { booking_id, chips_offered, chip_chosen } = body;
  if (!booking_id || !Array.isArray(chips_offered) || chips_offered.length === 0) {
    return NextResponse.json({ error: "booking_id and chips_offered required" }, { status: 400 });
  }

  const booking = await queryOne<{ client_id: string; photographer_id: string; photographer_user_id: string }>(
    `SELECT b.client_id, b.photographer_id, u.id AS photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
      WHERE b.id = $1`,
    [booking_id]
  );
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Photographer-only" }, { status: 403 });
  }

  // Capture the most recent client message for context — useful when reading
  // back the log to understand what the chips were RESPONDING to.
  const lastMsg = await queryOne<{ id: string; text: string | null }>(
    `SELECT id, text FROM messages
      WHERE client_id = $1 AND photographer_id = $2
        AND sender_id != $3 AND text IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
    [booking.client_id, booking.photographer_id, booking.photographer_user_id]
  );

  await query(
    `INSERT INTO chat_chip_feedback
       (photographer_id, client_id, booking_id, last_message_id, last_message_text,
        chips_offered, chip_chosen, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      booking.photographer_id,
      booking.client_id,
      booking_id,
      lastMsg?.id || null,
      lastMsg?.text || null,
      chips_offered,
      chip_chosen || null,
      chip_chosen ? "hit" : "miss",
    ]
  );

  return NextResponse.json({ ok: true });
}
