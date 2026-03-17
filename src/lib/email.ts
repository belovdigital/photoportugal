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
      <p><a href="${BASE_URL}/dashboard/photographer" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
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
      <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Messages</a></p>
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
      <p><a href="${BASE_URL}/dashboard/photographer" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Review</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}
