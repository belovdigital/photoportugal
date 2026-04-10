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
