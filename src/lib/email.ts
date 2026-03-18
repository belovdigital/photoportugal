import nodemailer from "nodemailer";
import { queryOne } from "@/lib/db";

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

export async function getAdminEmail(): Promise<string> {
  try {
    const setting = await queryOne<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'admin_notification_email'"
    );
    return setting?.value || "info@photoportugal.com";
  } catch {
    return "info@photoportugal.com";
  }
}

export async function sendEmail(to: string, subject: string, html: string, options?: { replyTo?: string }) {
  if (!process.env.SMTP_PASS) {
    console.log(`[email] SMTP not configured, skipping: ${subject} → ${to}`);
    return;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, html, ...(options?.replyTo ? { replyTo: options.replyTo } : {}) });
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

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
) {
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Reset your Photo Portugal password",
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Reset Your Password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to set a new one:</p>
      <p><a href="${resetUrl}" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reset Password</a></p>
      <p style="color: #666; font-size: 13px;">This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  role: "client" | "photographer"
) {
  const isPhotographer = role === "photographer";
  const subject = "Welcome to Photo Portugal!";
  const message = isPhotographer
    ? "Welcome to Photo Portugal! Complete your profile to start receiving bookings from tourists visiting Portugal."
    : "Welcome to Photo Portugal! Browse our talented photographers and book your perfect photo session in Portugal.";
  const ctaText = isPhotographer ? "Complete Your Profile" : "Browse Photographers";
  const ctaUrl = isPhotographer
    ? `${BASE_URL}/dashboard/profile`
    : `${BASE_URL}/photographers`;

  await sendEmail(
    to,
    subject,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Welcome to Photo Portugal!</h2>
      <p>Hi ${name},</p>
      <p>${message}</p>
      <p><a href="${ctaUrl}" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">${ctaText}</a></p>
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

// === Admin notification emails ===

export async function sendAdminNewPhotographerNotification(
  photographerName: string,
  photographerEmail: string
) {
  const adminEmail = await getAdminEmail();
  const emails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
  for (const email of emails) {
    await sendEmail(
      email,
      `[New Photographer] ${photographerName} is waiting for approval`,
      `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">New Photographer Registration</h2>
        <p>A new photographer has registered and is waiting for approval:</p>
        <ul style="line-height: 1.8;">
          <li><strong>Name:</strong> ${photographerName}</li>
          <li><strong>Email:</strong> ${photographerEmail}</li>
        </ul>
        <p><a href="${BASE_URL}/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin Panel</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>
      `
    );
  }
}

export async function sendAdminNewBookingNotification(
  clientName: string,
  photographerName: string,
  packageName: string | null,
  shootDate: string | null
) {
  const adminEmail = await getAdminEmail();
  const emails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
  for (const email of emails) {
    await sendEmail(
      email,
      `[New Booking] ${clientName} \u2192 ${photographerName}`,
      `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">New Booking Created</h2>
        <ul style="line-height: 1.8;">
          <li><strong>Client:</strong> ${clientName}</li>
          <li><strong>Photographer:</strong> ${photographerName}</li>
          ${packageName ? `<li><strong>Package:</strong> ${packageName}</li>` : ""}
          ${shootDate ? `<li><strong>Date:</strong> ${shootDate}</li>` : ""}
        </ul>
        <p><a href="${BASE_URL}/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin Panel</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>
      `
    );
  }
}

export async function sendPaymentReminderToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  paymentUrl: string | null,
  totalPrice: number | null
) {
  const ctaSection = paymentUrl && totalPrice
    ? `<p><a href="${paymentUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now &mdash; &euro;${totalPrice}</a></p>`
    : `<p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>`;

  await sendEmail(
    clientEmail,
    `Reminder: Complete your payment for the session with ${photographerName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Reminder</h2>
      <p>Hi ${clientName},</p>
      <p>Your booking with <strong>${photographerName}</strong> has been confirmed, but we haven't received your payment yet.</p>
      <p>Please complete your payment to secure your photoshoot session.</p>
      ${ctaSection}
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendShootReminderToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  shootDate: string
) {
  await sendEmail(
    clientEmail,
    `Tomorrow: Your photoshoot with ${photographerName}!`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Your Photoshoot is Tomorrow!</h2>
      <p>Hi ${clientName},</p>
      <p>Just a reminder that your photoshoot with <strong>${photographerName}</strong> is scheduled for <strong>${shootDate}</strong>.</p>
      <p>Make sure to confirm the meeting point and any last-minute details with your photographer.</p>
      <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Messages</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendShootReminderToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  shootDate: string
) {
  await sendEmail(
    photographerEmail,
    `Tomorrow: Photoshoot with ${clientName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Photoshoot Tomorrow!</h2>
      <p>Hi ${photographerName},</p>
      <p>Reminder: you have a photoshoot with <strong>${clientName}</strong> scheduled for <strong>${shootDate}</strong>.</p>
      <p>Make sure to confirm the meeting point and any details with your client.</p>
      <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Messages</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendDeliveryReminderToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string
) {
  await sendEmail(
    photographerEmail,
    `Reminder: ${clientName} is waiting for their photos`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Delivery Reminder</h2>
      <p>Hi ${photographerName},</p>
      <p>Your client <strong>${clientName}</strong> is waiting for their photos. The expected delivery time has passed.</p>
      <p>Please upload and deliver the photos as soon as possible.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Bookings</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}
