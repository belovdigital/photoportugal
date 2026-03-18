import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.migadu.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "info@photoportugal.com",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = "Photo Portugal <info@photoportugal.com>";
const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_PASS) {
    console.log(`[email] SMTP not configured, skipping: ${subject} → ${to}`);
    return;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[email] Sent: ${subject} → ${to}`);
  } catch (error) {
    console.error(`[email] Failed: ${subject} → ${to}`, error);
  }
}

// === Email templates ===

export async function sendBookingNotification(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  packageName: string | null,
  shootDate: string | null
) {
  await sendEmail(
    photographerEmail,
    `New booking request from ${clientName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Booking Request</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientName}</strong> has requested a photoshoot${packageName ? ` (${packageName})` : ""}${shootDate ? ` on ${shootDate}` : ""}.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendBookingConfirmation(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  shootDate: string | null
) {
  await sendEmail(
    clientEmail,
    `Booking confirmed with ${photographerName}!`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Booking Confirmed!</h2>
      <p>Hi ${clientName},</p>
      <p><strong>${photographerName}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.</p>
      <p>You can message your photographer to discuss the details.</p>
      <p style="margin-top: 12px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px; color: #5f4a3d;">
        <strong>Next step:</strong> Discuss the meeting point, outfit ideas, and any special requests with your photographer through our messaging system.
      </p>
      <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Messages</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendBookingConfirmationWithPayment(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  shootDate: string | null,
  paymentUrl: string | null,
  totalPrice: number | null
) {
  const paymentSection = paymentUrl && totalPrice
    ? `<p style="margin-top: 16px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 14px; color: #166534;">
        <strong>Payment required:</strong> Please pay &euro;${totalPrice} to secure your session. Your payment is held safely until you receive and accept your photos.
      </p>
      <p><a href="${paymentUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now — &euro;${totalPrice}</a></p>`
    : `<p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>`;

  await sendEmail(
    clientEmail,
    `${photographerName} confirmed your booking${totalPrice ? ` — pay now to secure` : ""}!`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Booking Confirmed!</h2>
      <p>Hi ${clientName},</p>
      <p><strong>${photographerName}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.</p>
      ${paymentSection}
      <p style="margin-top: 12px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px; color: #5f4a3d;">
        <strong>Tip:</strong> We also recommend messaging your photographer to discuss meeting point, outfit ideas, and any special requests.
      </p>
      <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Messages</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendPaymentReceivedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  bookingId: string,
  amount: number
) {
  await sendEmail(
    photographerEmail,
    `Payment received from ${clientName} — &euro;${amount}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Received!</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientName}</strong> has paid <strong>&euro;${amount}</strong> for their booking.</p>
      <p>The funds are held securely until the client accepts the photo delivery.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendPaymentConfirmedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  amount: number
) {
  await sendEmail(
    clientEmail,
    `Payment confirmed — &euro;${amount} for your session with ${photographerName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Confirmed!</h2>
      <p>Hi ${clientName},</p>
      <p>Your payment of <strong>&euro;${amount}</strong> for your photoshoot with <strong>${photographerName}</strong> has been confirmed.</p>
      <p>Your funds are held securely. After your photoshoot, your photographer will deliver your edited photos. Once you accept the delivery, the payment will be released to the photographer.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendDeliveryAcceptedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  payoutAmount: number
) {
  await sendEmail(
    photographerEmail,
    `${clientName} accepted delivery — &euro;${payoutAmount.toFixed(2)} transferred to you`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Transferred!</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientName}</strong> has accepted the photo delivery. A payment of <strong>&euro;${payoutAmount.toFixed(2)}</strong> has been transferred to your Stripe account.</p>
      <p>The funds should arrive in your bank account within 2-7 business days, depending on your Stripe payout schedule.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Dashboard</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendDeliveryAcceptedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string
) {
  await sendEmail(
    clientEmail,
    `Delivery accepted — thank you!`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Thank You!</h2>
      <p>Hi ${clientName},</p>
      <p>You've accepted the photo delivery from <strong>${photographerName}</strong>. We hope you love your photos!</p>
      <p style="margin-top: 12px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px; color: #5f4a3d;">
        Your photos will be available for download for <strong>60 days</strong>. Make sure to download them before then!
      </p>
      <p>If you enjoyed your experience, please consider leaving a review.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Leave a Review</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendNewMessageNotification(
  recipientEmail: string,
  recipientName: string,
  senderName: string
) {
  await sendEmail(
    recipientEmail,
    `New message from ${senderName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Message</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${senderName}</strong> sent you a message.</p>
      <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Read Message</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendReviewNotification(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  rating: number
) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  await sendEmail(
    photographerEmail,
    `New ${rating}-star review from ${clientName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Review</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientName}</strong> left you a review:</p>
      <p style="font-size: 24px; color: #F59E0B;">${stars}</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Review</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendSubscriptionEmail(
  email: string, name: string, plan: string, action: "upgraded" | "downgraded" | "cancelled"
) {
  const subjects: Record<string, string> = {
    upgraded: `Welcome to Photo Portugal ${plan}!`,
    downgraded: `Your plan has been changed to ${plan}`,
    cancelled: "Your subscription has been cancelled",
  };
  const messages: Record<string, string> = {
    upgraded: `You've been upgraded to the <strong>${plan}</strong> plan. Enjoy lower commission rates and more features!`,
    downgraded: `Your plan has been changed to <strong>${plan}</strong>. Your features have been updated accordingly.`,
    cancelled: `Your subscription has been cancelled. You've been moved to the <strong>Free</strong> plan. You can upgrade again anytime.`,
  };
  await sendEmail(email, subjects[action],
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Plan ${action === "cancelled" ? "Cancelled" : "Updated"}</h2>
      <p>Hi ${name},</p>
      <p>${messages[action]}</p>
      <p><a href="${BASE_URL}/dashboard/subscriptions" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Subscription</a></p>
      <p style="color: #999; font-size: 12px;">Invoices are available in your Stripe billing portal.</p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>`
  );
}
