import { NextRequest } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  const bookingId = req.nextUrl.searchParams.get("booking_id");

  if (!bookingId) {
    return new Response(JSON.stringify({ error: "booking_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
    `SELECT b.client_id, u.id as photographer_user_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastCheck = new Date().toISOString();
      controller.enqueue(encoder.encode(": connected\n\n"));

      const interval = setInterval(async () => {
        try {
          const newMessages = await query(
            `SELECT m.id, m.text, m.media_url, m.sender_id, m.created_at, m.read_at,
                    u.name as sender_name, u.avatar_url as sender_avatar
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.booking_id = $1 AND m.created_at > $2
             ORDER BY m.created_at ASC`,
            [bookingId, lastCheck]
          );

          if (newMessages.length > 0) {
            lastCheck = (newMessages[newMessages.length - 1] as { created_at: string }).created_at;
            await query(
              "UPDATE messages SET read_at = NOW() WHERE booking_id = $1 AND sender_id != $2 AND read_at IS NULL",
              [bookingId, userId]
            );
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(newMessages)}\n\n`));
          }
        } catch (err) {
          console.error("[messages/stream] poll error:", err);
        }
      }, 1000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
