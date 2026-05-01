import { queryOne } from "@/lib/db";

/**
 * Notify a user of a real-time event via WebSocket.
 *
 * Fires `pg_notify('user_event', JSON)`. The WS server (ws-server.js)
 * is LISTENing on this channel and broadcasts the payload to every
 * WebSocket connection that user has open. Mobile + web clients then
 * invalidate the relevant React Query cache so dashboards / lists /
 * chat conversations refresh without a manual reload.
 *
 * Fire-and-forget: if WS server is down, the notification is dropped
 * silently — push notifications and emails still go through their own
 * paths, so the user won't miss the event entirely. They just won't
 * see the in-app surface auto-update.
 *
 * Event types (kept in sync with the mobile useUserSocket switch):
 *
 * - "booking_changed"     — status update / cancellation; data:
 *                           { bookingId, status? }
 * - "booking_created"     — new booking inquiry; data: { bookingId }
 * - "payment_received"    — Stripe webhook fired; data: { bookingId }
 * - "delivery_uploaded"   — photographer published gallery; data:
 *                           { bookingId }
 * - "new_message"         — chat message landed; data: { bookingId }
 * - "profile_approved"    — admin approved photographer profile
 * - "review_approved"     — admin approved a review for the photographer
 *
 * Mobile invalidates ["bookings"], ["booking", id], ["conversations"],
 * ["messages", id], ["my-profile"] etc based on the event type.
 */
export function notifyUser(
  userId: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!userId) return;
  const payload = JSON.stringify({ user_id: userId, event, data: data || null });
  // No await — pg_notify is sub-millisecond and the caller doesn't
  // care if it succeeds. Catch any errors so they never bubble up
  // into the API request flow.
  queryOne("SELECT pg_notify('user_event', $1)", [payload]).catch((err) => {
    console.warn("[realtime] notify failed:", (err as Error).message);
  });
}
