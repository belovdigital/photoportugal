import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const bookingId = req.nextUrl.searchParams.get("booking_id");

  if (!bookingId) {
    return new Response("booking_id required", { status: 400 });
  }

  // Verify access
  const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
    `SELECT b.client_id, u.id as photographer_user_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking || (booking.client_id !== userId && booking.photographer_user_id !== userId)) {
    return new Response("Not authorized", { status: 403 });
  }

  const encoder = new TextEncoder();
  let lastTimestamp = new Date(0).toISOString();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial messages
      try {
        const messages = await query(
          `SELECT m.id, m.text, m.sender_id, m.created_at, m.read_at,
                  u.name as sender_name, u.avatar_url as sender_avatar
           FROM messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.booking_id = $1
           ORDER BY m.created_at ASC`,
          [bookingId]
        );

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", messages })}\n\n`));

        if (messages.length > 0) {
          lastTimestamp = (messages[messages.length - 1] as { created_at: string }).created_at;
        }

        // Mark as read
        await query(
          "UPDATE messages SET read_at = NOW() WHERE booking_id = $1 AND sender_id != $2 AND read_at IS NULL",
          [bookingId, userId]
        );
      } catch (e) {
        console.error("[stream] init error:", e);
      }

      // Poll every 3 seconds (not 1 — reduces DB load)
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const newMessages = await query(
            `SELECT m.id, m.text, m.sender_id, m.created_at, m.read_at,
                    u.name as sender_name, u.avatar_url as sender_avatar
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.booking_id = $1 AND m.created_at > $2
             ORDER BY m.created_at ASC`,
            [bookingId, lastTimestamp]
          );

          if (newMessages.length > 0) {
            lastTimestamp = (newMessages[newMessages.length - 1] as { created_at: string }).created_at;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "new", messages: newMessages })}\n\n`)
            );

            await query(
              "UPDATE messages SET read_at = NOW() WHERE booking_id = $1 AND sender_id != $2 AND read_at IS NULL",
              [bookingId, userId]
            );
          }
        } catch (e) {
          console.error("[stream] poll error:", e);
        }
      }, 3000);

      // Cleanup after 5 minutes
      setTimeout(() => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      }, 5 * 60 * 1000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
