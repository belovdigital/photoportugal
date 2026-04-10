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
    return setting?.value || "";
  } catch {
    return "";
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
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject.slice(0, 100), "sent")).catch(() => {});
  } catch (error) {
    console.error(`[email] Failed: ${subject} → ${to}`, error);
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject.slice(0, 100), "failed", undefined, String(error))).catch(() => {});
  }
}

// === Email template wrapper ===
function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #F3EDE6;">
          <a href="https://photoportugal.com" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
            <img src="https://photoportugal.com/logo-icon.png" width="28" height="28" alt="" style="border-radius:6px;">
            <span style="font-size:17px;font-weight:700;color:#1F1F1F;letter-spacing:-0.3px;">Photo Portugal</span>
          </a>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px 32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#FAFAF8;border-top:1px solid #F3EDE6;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#9B8E82;">
                <a href="https://photoportugal.com" style="color:#9B8E82;text-decoration:none;font-weight:500;">photoportugal.com</a>
              </td>
              <td align="right" style="font-size:13px;color:#C4B8AD;">
                <a href="https://photoportugal.com/support" style="color:#C4B8AD;text-decoration:none;">Help</a>
                <span style="margin:0 6px;">·</span>
                <a href="https://photoportugal.com/privacy" style="color:#C4B8AD;text-decoration:none;">Privacy</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailButton(href: string, label: string, color: string = "#C94536"): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center">
    <a href="${href}" style="display:inline-block;background:${color};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>
  </td></tr></table>`;
}

// === Email templates ===

export async function sendBookingNotification(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  packageName: string | null,
  shootDate: string | null
) {
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `New booking request from ${clientFirstName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Booking Request</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${clientFirstName}</strong> has requested a photoshoot${packageName ? ` (${packageName})` : ""}${shootDate ? ` on ${shootDate}` : ""}.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking")}
    `)
  );
}

export async function sendBookingRequestToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  packageName: string | null,
  shootDate: string | null
) {
  await sendEmail(
    clientEmail,
    `Booking request sent to ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Booking Request Sent!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your booking request has been sent to <strong>${photographerName}</strong>${packageName ? ` for ${packageName}` : ""}${shootDate ? ` on ${shootDate}` : ""}.</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>What happens next?</strong> ${photographerName} will review your request and get back to you shortly. You can also message them directly to discuss details.</p>
      </div>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Your Booking")}
    `)
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
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Booking Confirmed!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${photographerName}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">You can message your photographer to discuss the details.</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>Next step:</strong> Discuss the meeting point, outfit ideas, and any special requests with your photographer through our messaging system.</p>
      </div>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Open Messages")}
    `)
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
  const price = totalPrice ? Math.round(Number(totalPrice)) : null;
  const paymentSection = paymentUrl && price
    ? `<div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>Payment required:</strong> Please pay &euro;${price} to secure your session. Your payment is held safely until you receive and accept your photos.</p>
      </div>
      ${emailButton(paymentUrl, "Pay Now — €" + price, "#16A34A")}`
    : emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking");

  await sendEmail(
    clientEmail,
    `${photographerName} confirmed your booking${totalPrice ? ` — pay now to secure` : ""}!`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Booking Confirmed!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${photographerName}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.</p>
      ${paymentSection}
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>Tip:</strong> We also recommend messaging your photographer to discuss meeting point, outfit ideas, and any special requests.</p>
      </div>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Open Messages")}
    `)
  );
}

export async function sendPaymentReceivedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  bookingId: string,
  amount: number,
  clientPhone?: string | null
) {
  const firstName = clientName.split(" ")[0];
  const contactSection = clientPhone
    ? `<div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong style="color:#16A34A;">Client phone:</strong> ${clientPhone}</p>
      </div>`
    : "";

  await sendEmail(
    photographerEmail,
    `Payment received from ${firstName} — €${amount}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Received!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${firstName}</strong> has paid <strong>&euro;${amount}</strong> for their booking.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">The funds are held securely until the client accepts the photo delivery.</p>
      ${contactSection}
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking")}
    `)
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
    `Payment confirmed — €${amount} for your session with ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Confirmed!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your payment of <strong>&euro;${amount}</strong> for your photoshoot with <strong>${photographerName}</strong> has been confirmed.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your funds are held securely. After your photoshoot, your photographer will deliver your edited photos. Once you accept the delivery, the payment will be released to the photographer.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking")}
    `)
  );
}

export async function sendDeliveryAcceptedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  payoutAmount: number
) {
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `${clientFirstName} accepted delivery — €${payoutAmount.toFixed(2)} transferred to you`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Transferred!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${clientFirstName}</strong> has accepted the photo delivery. A payment of <strong style="color:#16A34A;">&euro;${payoutAmount.toFixed(2)}</strong> has been transferred to your Stripe account.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">The funds should arrive in your bank account within 2-7 business days, depending on your Stripe payout schedule.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Dashboard")}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Enjoyed working with this client? Leave a quick review to help build your reputation on the platform:</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "Leave a Review", "#3B82F6")}
    `)
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
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Thank You!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">You've accepted the photo delivery from <strong>${photographerName}</strong>. We hope you love your photos!</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;">Your photos will be available for download for <strong>60 days</strong>. Make sure to download them before then!</p>
      </div>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">If you enjoyed your experience, we'd love to hear from you! A quick review helps other travelers find great photographers:</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "Leave a Review")}
    `)
  );
}

export async function sendTrustpilotFollowUpToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string
) {
  await sendEmail(
    clientEmail,
    `One last thing, ${clientName} — it means a lot to us`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Thank You for Your Review!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We really appreciate you sharing your experience with <strong>${photographerName}</strong> on our platform.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We have one small favour to ask — it would mean the world to our small business if you could leave a quick review on Google or Trustpilot. It takes less than a minute and helps other travelers discover Photo Portugal:</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBI/review", "Review Us on Google", "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton("https://www.trustpilot.com/evaluate/photoportugal.com", "Review Us on Trustpilot", "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">Even a few words make a huge difference. Thank you for supporting independent photography in Portugal!</p>
    `)
  );
}

export async function sendTrustpilotFollowUpToPhotographer(
  photographerEmail: string,
  photographerName: string
) {
  await sendEmail(
    photographerEmail,
    `Quick favour, ${photographerName}?`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Help Us Grow!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for being part of Photo Portugal. Your work is what makes this platform great.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We'd love it if you could share your experience as a photographer on Google or Trustpilot. A genuine review from a professional like you helps build trust and brings more clients to the platform — which means more bookings for everyone:</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBI/review", "Review Us on Google", "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton("https://www.trustpilot.com/evaluate/photoportugal.com", "Review Us on Trustpilot", "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">It takes less than a minute. Thank you for your support!</p>
    `)
  );
}

export async function sendNewMessageNotification(
  recipientEmail: string,
  recipientName: string,
  senderName: string
) {
  await sendEmail(
    recipientEmail,
    `You have new messages from ${senderName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Messages</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${recipientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">You have new messages from <strong>${senderName}</strong>.</p>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Read Messages")}
    `)
  );
}

export async function sendReviewNotification(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  rating: number
) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `New ${rating}-star review from ${clientFirstName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Review</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${clientFirstName}</strong> left you a review:</p>
      <p style="margin:0 0 12px;font-size:24px;color:#F59E0B;">${stars}</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Review")}
    `)
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
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Reset Your Password</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#4A4A4A;">We received a request to reset your password. Click the button below to set a new one:</p>
      ${emailButton(resetUrl, "Reset Password")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
    `)
  );
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  const firstName = name.split(" ")[0];
  await sendEmail(
    to,
    "Verify your email — Photo Portugal",
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Verify Your Email</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for signing up! Please verify your email address to activate your account:</p>
      ${emailButton(verifyUrl, "Verify Email Address")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    `)
  );
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  role: "client" | "photographer"
) {
  const isPhotographer = role === "photographer";

  if (isPhotographer) {
    await sendEmail(
      to,
      "Welcome to Photo Portugal — Let's get you started!",
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Welcome to Photo Portugal!</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for joining Photo Portugal! We're excited to have you on the platform. Here's how to get your profile live and start receiving bookings:</p>

        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <p style="margin:0 0 12px;font-weight:bold;color:#1F1F1F;">Your setup checklist:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#9B8E82;">1.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Complete your profile</strong> — Add a photo, bio, and tagline</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">2.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Upload a cover image</strong> — This appears on your card</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">3.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Add portfolio photos</strong> — At least 5, we recommend 10+</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">4.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Create packages</strong> — Set up 2-3 at different price points</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">5.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Select your locations</strong> — Where you're available to shoot</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">6.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Connect Stripe</strong> — Required to receive payments</td></tr>
          </table>
        </div>

        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Once your profile is complete and approved by our team, you'll appear in search results and can start receiving bookings.</p>

        <div style="margin:16px 0;padding:16px;background:#FEF2F2;border-radius:10px;border:1px solid #FECACA;">
          <p style="margin:0 0 10px;font-weight:bold;color:#991B1B;">Important rules:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#7F1D1D;">
            <tr><td style="padding:4px 0;vertical-align:top;">1.</td><td style="padding:4px 8px;"><strong>Complete your profile within 7 days</strong> — accounts that remain incomplete will be automatically deactivated</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;">2.</td><td style="padding:4px 8px;"><strong>Never work with clients off-platform</strong> — soliciting clients outside Photo Portugal or accepting direct payments results in a permanent ban</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;">3.</td><td style="padding:4px 8px;"><strong>Respond to booking requests within 24 hours</strong> — clients expect fast communication</td></tr>
          </table>
        </div>

        ${emailButton(`${BASE_URL}/dashboard/profile`, "Complete Your Profile")}

        <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">
          <strong>Helpful links:</strong><br>
          <a href="${BASE_URL}/support" style="color:#C94536;">Help Center</a> — answers to common questions<br>
          <a href="${BASE_URL}/for-photographers/pricing" style="color:#C94536;">Pricing &amp; Plans</a> — commission rates and features<br>
          <a href="${BASE_URL}/contact" style="color:#C94536;">Contact Us</a> — we're here to help
        </p>
      `)
    );
  } else {
    await sendEmail(
      to,
      "Welcome to Photo Portugal!",
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Welcome to Photo Portugal!</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">You're all set! Here's how to book your perfect photoshoot in Portugal:</p>

        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#C94536;font-weight:bold;vertical-align:top;">1.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Browse photographers</strong> — Find your style in Lisbon, Porto, Algarve, and 20 more locations</td></tr>
            <tr><td style="padding:6px 0;color:#C94536;font-weight:bold;vertical-align:top;">2.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Pick a package</strong> — Choose the session length and number of photos</td></tr>
            <tr><td style="padding:6px 0;color:#C94536;font-weight:bold;vertical-align:top;">3.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Book &amp; pay securely</strong> — Your payment is held in escrow until you approve the photos</td></tr>
          </table>
        </div>

        ${emailButton(`${BASE_URL}/photographers`, "Browse Photographers")}

        <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">
          Questions? <a href="${BASE_URL}/support" style="color:#C94536;">Visit our Help Center</a> or <a href="${BASE_URL}/contact" style="color:#C94536;">contact us</a>.
        </p>
      `)
    );
  }
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
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Plan ${action === "cancelled" ? "Cancelled" : "Updated"}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${messages[action]}</p>
      ${emailButton(`${BASE_URL}/dashboard/subscriptions`, "View Subscription")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">Invoices are available in your Stripe billing portal.</p>
    `)
  );
}

// === Admin notification emails ===

// Send to all admin emails (Telegram is handled separately per notification for better formatting)
async function sendToAllAdmins(subject: string, html: string) {
  const adminEmail = await getAdminEmail();
  const emails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
  await Promise.allSettled(emails.map((email) => sendEmail(email, subject, html)));
}

export async function sendAdminNewPhotographerNotification(
  photographerName: string,
  photographerEmail: string
) {
  await sendToAllAdmins(
    `[New Photographer] ${photographerName} has joined`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Photographer Registration</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">A new photographer has registered and is setting up their profile:</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Name:</strong> ${photographerName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Email:</strong> ${photographerEmail}</p>
      </div>
      ${emailButton(`${BASE_URL}/admin`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminNewClientNotification(
  clientName: string,
  clientEmail: string
) {
  await sendToAllAdmins(
    `[New Client] ${clientName} has signed up`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Client Registration</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">A new client has signed up:</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Name:</strong> ${clientName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Email:</strong> ${clientEmail}</p>
      </div>
      ${emailButton(`${BASE_URL}/admin#clients`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminNewBookingNotification(
  clientName: string,
  photographerName: string,
  packageName: string | null,
  shootDate: string | null
) {
  await sendToAllAdmins(
      `[New Booking] ${clientName} \u2192 ${photographerName}`,
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Booking Created</h2>
        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
          <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
          ${packageName ? `<p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Package:</strong> ${packageName}</p>` : ""}
          ${shootDate ? `<p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Date:</strong> ${shootDate}</p>` : ""}
        </div>
        ${emailButton(`${BASE_URL}/admin`, "Go to Admin Panel")}
      `)
    );
}

export async function sendPaymentReminderToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  paymentUrl: string | null,
  totalPrice: number | null
) {
  const ctaSection = paymentUrl && totalPrice
    ? emailButton(paymentUrl, `Pay Now — \u20AC${totalPrice}`, "#16A34A")
    : emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking");

  await sendEmail(
    clientEmail,
    `Reminder: Complete your payment for the session with ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Reminder</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your booking with <strong>${photographerName}</strong> has been confirmed, but we haven't received your payment yet.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please complete your payment to secure your photoshoot session.</p>
      ${ctaSection}
    `)
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
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Your Photoshoot is Tomorrow!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Just a reminder that your photoshoot with <strong>${photographerName}</strong> is scheduled for <strong>${shootDate}</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Make sure to confirm the meeting point and any last-minute details with your photographer.</p>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Open Messages")}
    `)
  );
}

export async function sendShootReminderToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  shootDate: string
) {
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `Tomorrow: Photoshoot with ${clientFirstName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Photoshoot Tomorrow!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Reminder: you have a photoshoot with <strong>${clientFirstName}</strong> scheduled for <strong>${shootDate}</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Make sure to confirm the meeting point and any details with your client.</p>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Open Messages")}
    `)
  );
}

export async function sendDeliveryReminderToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string
) {
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `Reminder: ${clientFirstName} is waiting for their photos`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Delivery Reminder</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your client <strong>${clientFirstName}</strong> is waiting for their photos. The expected delivery time has passed.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please upload and deliver the photos as soon as possible.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "Go to Bookings")}
    `)
  );
}

// === Additional notifications ===

export async function sendAdminBookingConfirmedNotification(
  clientName: string,
  photographerName: string,
  shootDate: string | null,
  totalPrice: number | null,
  packageName: string | null
) {
  const dateStr = shootDate
    ? new Date(shootDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Flexible dates";
  await sendToAllAdmins(
    `[Booking Confirmed] ${clientName} ↔ ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#16A34A;">Booking Confirmed</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Date:</strong> ${dateStr}</p>
        ${packageName ? `<p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Package:</strong> ${packageName}</p>` : ""}
        ${totalPrice ? `<p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Price:</strong> &euro;${Math.round(totalPrice)}</p>` : ""}
      </div>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Payment link has been sent to the client.</p>
      ${emailButton(`${BASE_URL}/admin#bookings`, "Go to Admin Panel", "#16A34A")}
    `)
  );
}

export async function sendAdminBookingCancelledNotification(
  clientName: string,
  photographerName: string,
  cancelledBy: "client" | "photographer" | "admin",
  refundAmount: number | null
) {
  const refundLine = refundAmount && refundAmount > 0
    ? `<p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Refund:</strong> &euro;${refundAmount.toFixed(2)}</p>`
    : `<p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Refund:</strong> None</p>`;
  await sendToAllAdmins(
    `[Booking Cancelled] ${clientName} \u2194 ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Booking Cancelled</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Cancelled by:</strong> ${cancelledBy}</p>
        ${refundLine}
      </div>
      ${emailButton(`${BASE_URL}/admin#bookings`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminAutoCancelNotification(
  clientName: string,
  photographerName: string
) {
  await sendToAllAdmins(
    `[Auto-Cancelled] ${clientName} ↔ ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#C94536;">Booking Auto-Cancelled</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Reason:</strong> Payment not received within 48 hours</p>
      </div>
      ${emailButton(`${BASE_URL}/admin#bookings`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminNewInquiryNotification(
  clientName: string,
  photographerName: string,
  messagePreview: string
) {
  await sendToAllAdmins(
    `[New Inquiry] ${clientName} → ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Inquiry</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;font-style:italic;">"${messagePreview}"</p>
      </div>
      ${emailButton(`${BASE_URL}/admin`, "Go to Admin Panel")}
    `)
  );
}

export async function sendPaymentFailedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string
) {
  await sendEmail(
    clientEmail,
    `Payment failed for your booking with ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Failed</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your payment for the photoshoot with <strong>${photographerName}</strong> could not be processed.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please try again with a different payment method or contact your bank for details.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "Retry Payment")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">
        Need help? <a href="${BASE_URL}/support" style="color:#C94536;">Contact support</a>
      </p>
    `)
  );
}

export async function sendAbandonedBookingReminder(
  clientEmail: string,
  clientName: string,
  photographers: { name: string; slug: string }[]
) {
  const firstName = clientName.split(" ")[0];
  const single = photographers.length === 1;
  const subject = single
    ? `Still thinking about your photoshoot with ${photographers[0].name}?`
    : `Still looking for a photographer in Portugal?`;
  const photographerLinks = photographers
    .map(p => `<a href="${BASE_URL}/photographers/${p.slug}" style="color:#C94536;font-weight:600;text-decoration:none;">${p.name}</a>`)
    .join(", ");
  await sendEmail(
    clientEmail,
    subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Hi ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We noticed you were checking out ${single ? `<strong>${photographers[0].name}</strong>` : `some of our photographers: ${photographerLinks}`}. Great taste!</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Schedules fill up quickly during peak season. You can message any photographer directly with questions before booking.</p>
      ${emailButton(`${BASE_URL}/photographers/${photographers[0].slug}`, single ? "View " + photographers[0].name + "'s Profile" : "View Photographers")}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#9A9A9A;">Need help choosing? Reply to this email and we'll personally help you find the perfect photographer for your trip.</p>
    `)
  );
}

export async function sendNoBookingNudge(
  clientEmail: string,
  clientName: string
) {
  const firstName = clientName.split(" ")[0];
  await sendEmail(
    clientEmail,
    `Need help finding a photographer in Portugal?`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Hi ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Welcome to Photo Portugal! We noticed you signed up but haven't booked a session yet.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Not sure where to start? Tell us your dates, group size, and preferred location, and we'll recommend the perfect photographer for your trip.</p>
      ${emailButton(`${BASE_URL}/photographers`, "Browse Photographers")}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#9A9A9A;">Just reply to this email with your plans and we'll take care of the rest!</p>
    `)
  );
}

export async function sendReviewApprovedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  rating: number,
  profileSlug: string
) {
  const stars = "\u2605".repeat(rating) + "\u2606".repeat(5 - rating);
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `New ${rating}-star review published on your profile!`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Review Published!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">A review from <strong>${clientFirstName}</strong> has been approved and is now visible on your profile.</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:20px;color:#F59E0B;">${stars}</p>
      </div>
      ${emailButton(`${BASE_URL}/photographers/${profileSlug}`, "View Your Profile")}
    `)
  );
}
