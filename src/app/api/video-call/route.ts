import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { maskSurname } from "@/lib/photographer-name";
import { notifyPairMessage } from "@/lib/chat-notify";

export const dynamic = "force-dynamic";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "wss://meet.photoportugal.com";

// POST /api/video-call  { booking_id, action: "start" | "join" }
//
// "start" drops a VIDEO_CALL: system card into the conversation thread (the
// other side sees it via the SSE stream) and returns a join token for the
// caller. "join" only mints a token — used by the recipient clicking the card.
//
// Rooms are per conversation pair (client + photographer), matching how chat
// threads merge across bookings. No payment gate — calls are deliberately
// allowed pre-booking-payment; the transcript pipeline is the
// anti-disintermediation control, not a gate.
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { booking_id, action } = await req.json().catch(() => ({}));
  if (!booking_id || !["start", "join"].includes(action)) {
    return NextResponse.json({ error: "booking_id and action required" }, { status: 400 });
  }

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "Video calls are not configured" }, { status: 503 });
  }

  const booking = await queryOne<{
    client_id: string;
    photographer_id: string;
    photographer_user_id: string;
    photographer_name: string;
    client_name: string;
    any_paid: boolean;
  }>(
    `SELECT b.client_id, b.photographer_id, u.id as photographer_user_id,
            u.name as photographer_name, cu.name as client_name,
            EXISTS (
              SELECT 1 FROM bookings bp
              WHERE bp.client_id = b.client_id
                AND bp.photographer_id = b.photographer_id
                AND bp.payment_status = 'paid'
            ) as any_paid
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.id = $1`,
    [booking_id]
  );

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const isPhotographer = user.id === booking.photographer_user_id;
  const isClient = user.id === booking.client_id;
  if (!isPhotographer && !isClient) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Stable room per pair — repeat calls reuse it; empty rooms expire in 5 min.
  const room = `pp-${booking.client_id.slice(0, 8)}-${booking.photographer_id.slice(0, 8)}`;

  // Anti-disintermediation: before any paid booking exists between the pair,
  // the photographer appears as "First L." — same rule as chat notifications.
  const displayName = isPhotographer && !booking.any_paid
    ? maskSurname(booking.photographer_name)
    : isPhotographer
      ? booking.photographer_name
      : booking.client_name;

  // livekit.yaml has room.auto_create: false (stray tokens can't spawn
  // rooms), so the room must exist before the client connects. createRoom
  // is idempotent — an existing room is returned as-is.
  try {
    const svc = new RoomServiceClient(
      LIVEKIT_URL.replace(/^wss:/, "https:"),
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );
    // Short emptyTimeout: the pair's room name is stable, so a lingering
    // empty room would swallow the next call's room_started/track events
    // into the previous instance. 30s still covers accidental refreshes.
    await svc.createRoom({ name: room, emptyTimeout: 30, maxParticipants: 4 });
  } catch (e) {
    console.error("[video-call] createRoom failed:", e);
    return NextResponse.json({ error: "Video service unavailable" }, { status: 502 });
  }

  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: user.id,
    name: displayName,
    ttl: "2h",
  });
  token.addGrant({
    room,
    roomJoin: true,
    roomCreate: true,
    canPublish: true,
    canSubscribe: true,
  });

  if (action === "start") {
    // One card per call, not per click: retries/re-opens within 30 min
    // reuse the existing invite instead of spamming the thread.
    const recentCard = await queryOne<{ id: string }>(
      `SELECT id FROM messages
       WHERE client_id = $1 AND photographer_id = $2 AND is_system = TRUE
         AND text LIKE 'VIDEO_CALL:%' AND created_at > NOW() - INTERVAL '30 minutes'
       LIMIT 1`,
      [booking.client_id, booking.photographer_id]
    );
    if (!recentCard) {
      const cardText = `VIDEO_CALL:${JSON.stringify({ room, by: user.id, at: new Date().toISOString() })}`;
      const inserted = await queryOne<{ id: string; created_at: string }>(
        `INSERT INTO messages (booking_id, sender_id, text, is_system, client_id, photographer_id)
         VALUES ($1, $2, $3, TRUE, $4, $5) RETURNING id, created_at`,
        [booking_id, user.id, cardText, booking.client_id, booking.photographer_id]
      );
      if (inserted) {
        await notifyPairMessage({
          clientId: booking.client_id,
          photographerId: booking.photographer_id,
          message: {
            id: inserted.id,
            text: cardText,
            sender_id: user.id,
            sender_name: displayName,
            created_at: inserted.created_at,
            is_system: true,
          },
        });
      }
    }
  }

  return NextResponse.json({
    token: await token.toJwt(),
    url: LIVEKIT_URL,
    room,
  });
}
