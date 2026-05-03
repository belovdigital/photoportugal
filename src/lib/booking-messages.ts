import { queryOne } from "@/lib/db";

function getStatusMessage(status: string, photographerName: string, clientName: string): string | null {
  const pName = photographerName.split(" ")[0];
  const cName = clientName.split(" ")[0];

  const messages: Record<string, string> = {
    confirmed: `📋 Booking confirmed by ${pName}. Payment link has been sent.`,
    completed: `📸 Session marked as completed. ${pName} will upload photos soon.`,
    delivered: "📦 Photo previews have been uploaded and are ready for review.",
    cancelled: "❌ Booking has been cancelled.",
    disputed: "⚠️ A delivery issue has been reported. Our team will review and respond within 48 hours.",
    refunded: "💸 Refund has been processed.",
    payment_paid: `✅ Payment received. Your session with ${pName} is secured!`,
    payment_failed: "⚠️ Payment could not be processed. Please try again.",
    delivery_accepted: "🎉 Delivery accepted! Full-resolution photos are now available for download.",
  };

  return messages[status] || null;
}

export async function sendBookingStatusMessage(
  bookingId: string,
  status: string,
  senderId?: string
) {
  try {
    // Get booking with names
    const booking = await queryOne<{
      client_id: string;
      photographer_name: string;
      client_name: string;
    }>(
      `SELECT b.client_id, pu.name as photographer_name, cu.name as client_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!booking) return;

    const message = getStatusMessage(status, booking.photographer_name, booking.client_name);
    if (!message) return;

    const finalSenderId = senderId || booking.client_id;

    await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
      [bookingId, finalSenderId, message]
    );
  } catch (err) {
    console.error("[booking-messages] error:", err);
  }
}

/**
 * Cancellation-specific system message that includes the reason given by
 * the canceller. Differs from the generic "❌ Booking cancelled" status
 * message because the reason is user-provided and matters — surfacing it
 * in chat keeps both parties on the same page.
 *
 * cancelledBy = 'photographer' | 'client' | 'system'. The senderId is used
 * for the messages table; for system cancellations we fall back to the
 * client's user_id (we always have that, and it just labels the message
 * source — it's marked is_system=TRUE either way).
 */
export async function sendCancellationMessage(
  bookingId: string,
  cancelledBy: "photographer" | "client" | "system",
  reason: string,
  senderId?: string
) {
  try {
    const booking = await queryOne<{
      client_id: string;
      photographer_user_id: string;
      photographer_name: string;
      client_name: string;
    }>(
      `SELECT b.client_id, pu.id as photographer_user_id,
              pu.name as photographer_name, cu.name as client_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.id = $1`,
      [bookingId]
    );
    if (!booking) return;

    const who =
      cancelledBy === "photographer" ? booking.photographer_name.split(" ")[0]
      : cancelledBy === "client" ? booking.client_name.split(" ")[0]
      : "Photo Portugal";
    const trimmedReason = (reason || "").trim().slice(0, 500);
    const text = `❌ Booking cancelled by ${who}.\nReason: ${trimmedReason || "(no reason given)"}`;

    const finalSenderId = senderId
      || (cancelledBy === "photographer" ? booking.photographer_user_id : booking.client_id);

    await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
      [bookingId, finalSenderId, text]
    );
  } catch (err) {
    console.error("[booking-messages] cancellation error:", err);
  }
}

// Kate's user_id — Photo Portugal co-founder. Used as sender for
// review-request system messages so her name + avatar render on the card.
// If Kate's account is ever deleted/replaced, swap this constant.
export const KATE_USER_ID = "1fe40315-bd00-4530-a6be-39fa970617bd";

/**
 * Insert a Kate-voice review-request system message into the booking's
 * chat. Idempotent at the caller level via bookings.review_chat_sent.
 *
 * Payload: `REVIEW_REQUEST:<bookingId>[:<urlEncodedFirstName>]` — the
 * first name is embedded so renderers can greet the client by name without
 * an extra DB lookup.
 */
export async function sendReviewRequestMessage(bookingId: string, firstName?: string): Promise<boolean> {
  try {
    const trimmed = (firstName || "").trim();
    const payload = trimmed
      ? `REVIEW_REQUEST:${bookingId}:${encodeURIComponent(trimmed)}`
      : `REVIEW_REQUEST:${bookingId}`;
    await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
      [bookingId, KATE_USER_ID, payload]
    );
    return true;
  } catch (err) {
    console.error("[booking-messages] review request error:", err);
    return false;
  }
}
