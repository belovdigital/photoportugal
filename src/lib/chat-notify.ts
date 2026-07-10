import { query, queryOne } from "@/lib/db";

/**
 * Live-delivers a chat message to open chat windows via the ws-server
 * (pg_notify 'new_message' → broadcastToRoom). The normal send path in
 * /api/messages does this inline; server-inserted system messages (video-call
 * cards, call transcripts) must call this too or they only appear after a
 * chat re-open.
 *
 * WS rooms are keyed by booking_id while chat threads are conversation-scoped
 * (client+photographer pair), so we notify EVERY booking of the pair — the
 * viewer's open chat may be joined under any of them.
 */
export async function notifyPairMessage(opts: {
  clientId: string;
  photographerId: string; // photographer_profiles.id
  message: {
    id: string;
    text: string | null;
    media_url?: string | null;
    sender_id: string;
    sender_name: string;
    sender_avatar?: string | null;
    created_at: string;
    is_system?: boolean;
  };
}): Promise<void> {
  try {
    const bookings = await query<{ id: string }>(
      "SELECT id FROM bookings WHERE client_id = $1 AND photographer_id = $2",
      [opts.clientId, opts.photographerId]
    );
    await Promise.all(
      bookings.map((b) =>
        queryOne("SELECT pg_notify('new_message', $1)", [
          JSON.stringify({
            booking_id: b.id,
            message: {
              media_url: null,
              sender_avatar: null,
              read_at: null,
              is_system: false,
              ...opts.message,
            },
          }),
        ])
      )
    );
  } catch (err) {
    // Delivery-on-reopen still works via the normal message load — never
    // let the live push break the caller.
    console.error("[chat-notify] pg_notify failed:", err);
  }
}
