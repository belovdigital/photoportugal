import { NextRequest } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";
import { maskSurname } from "@/lib/photographer-name";

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

  // Resolve the conversation (client+photographer pair) once. The
  // chat thread is conversation-scoped, NOT per-booking — messages
  // sent under one booking_id appear in the shared thread for all
  // bookings between the same pair. Without this fix, opening the
  // chat under booking A and getting a reply that lands in booking B
  // would NOT stream into the open chat.
  const booking = await queryOne<{ client_id: string; photographer_id: string; photographer_user_id: string }>(
    `SELECT b.client_id, b.photographer_id, u.id as photographer_user_id
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

  // Anti-disintermediation: precompute once whether the CLIENT viewer should
  // see the photographer's surname masked on live messages (no paid booking
  // with this pair yet). Photographer viewers always see full client names.
  const viewerIsClient = userId === booking.client_id;
  const paidRow = viewerIsClient
    ? await queryOne<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM bookings WHERE client_id = $1 AND photographer_id = $2 AND payment_status = 'paid') as exists`,
        [booking.client_id, booking.photographer_id]
      )
    : null;
  const maskPhotographer = viewerIsClient && !paidRow?.exists;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastCheck = new Date().toISOString();
      controller.enqueue(encoder.encode(": connected\n\n"));

      const interval = setInterval(async () => {
        try {
          // Stream both new messages AND translation-completed updates.
          // Translation arrives a second or two AFTER the row is inserted,
          // so we poll on GREATEST(created_at, translated_at) and let the
          // client merge by id.
          const newMessages = await query<{ id: string; created_at: string; translated_at: string | null }>(
            `SELECT m.id, m.text, m.media_url, m.sender_id, m.created_at, m.read_at,
                    m.detected_language, m.translated_text, m.translated_to_lang, m.translated_at,
                    COALESCE(m.is_system, FALSE) as is_system,
                    u.name as sender_name, u.avatar_url as sender_avatar
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.client_id = $1 AND m.photographer_id = $2
               AND (m.created_at > $3 OR (m.translated_at IS NOT NULL AND m.translated_at > $3))
             ORDER BY m.created_at ASC`,
            [booking.client_id, booking.photographer_id, lastCheck]
          );

          if (newMessages.length > 0) {
            // Advance the watermark to the latest update we just emitted.
            const maxTs = newMessages.reduce((acc, m) => {
              const c = new Date(m.created_at).getTime();
              const t = m.translated_at ? new Date(m.translated_at).getTime() : 0;
              return Math.max(acc, c, t);
            }, new Date(lastCheck).getTime());
            lastCheck = new Date(maxTs).toISOString();
            await query(
              `UPDATE messages SET read_at = NOW()
                WHERE client_id = $1 AND photographer_id = $2
                  AND sender_id != $3 AND read_at IS NULL`,
              [booking.client_id, booking.photographer_id, userId]
            );
            if (maskPhotographer) {
              for (const m of newMessages as Array<Record<string, unknown>>) {
                if (m.sender_id === booking.photographer_user_id && typeof m.sender_name === "string") {
                  m.sender_name = maskSurname(m.sender_name as string);
                }
              }
            }
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
