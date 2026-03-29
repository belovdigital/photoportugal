import { queryOne } from "@/lib/db";

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: "📋 Booking confirmed by the photographer. Payment link has been sent.",
  completed: "📸 Session marked as completed. Photographer will upload photos soon.",
  delivered: "📦 Photo previews have been uploaded and are ready for review.",
  cancelled: "❌ Booking has been cancelled.",
  disputed: "⚠️ A delivery issue has been reported. Our team will review and respond within 48 hours.",
  refunded: "💸 Refund has been processed.",
  payment_paid: "✅ Payment received. Your session is secured!",
  payment_failed: "⚠️ Payment could not be processed. Please try again.",
  delivery_accepted: "🎉 Delivery accepted! Full-resolution photos are now available for download.",
};

export async function sendBookingStatusMessage(
  bookingId: string,
  status: string,
  senderId?: string
) {
  const message = STATUS_MESSAGES[status];
  if (!message) return;

  try {
    // If no senderId provided, use the client's ID
    let finalSenderId = senderId;
    if (!finalSenderId) {
      const booking = await queryOne<{ client_id: string }>(
        "SELECT client_id FROM bookings WHERE id = $1", [bookingId]
      );
      finalSenderId = booking?.client_id;
    }
    if (!finalSenderId) return;

    await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
      [bookingId, finalSenderId, message]
    );
  } catch (err) {
    console.error("[booking-messages] error:", err);
  }
}
