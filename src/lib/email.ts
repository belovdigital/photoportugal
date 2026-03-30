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
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject.slice(0, 100), "sent")).catch(() => {});
  } catch (error) {
    console.error(`[email] Failed: ${subject} → ${to}`, error);
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject.slice(0, 100), "failed", undefined, String(error))).catch(() => {});
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
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `New booking request from ${clientFirstName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Booking Request</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientFirstName}</strong> has requested a photoshoot${packageName ? ` (${packageName})` : ""}${shootDate ? ` on ${shootDate}` : ""}.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
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
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Booking Request Sent!</h2>
      <p>Hi ${clientName},</p>
      <p>Your booking request has been sent to <strong>${photographerName}</strong>${packageName ? ` for ${packageName}` : ""}${shootDate ? ` on ${shootDate}` : ""}.</p>
      <p style="margin-top: 12px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px; color: #5f4a3d;">
        <strong>What happens next?</strong> ${photographerName} will review your request and get back to you shortly. You can also message them directly to discuss details.
      </p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Your Booking</a></p>
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
  const price = totalPrice ? Math.round(Number(totalPrice)) : null;
  const paymentSection = paymentUrl && price
    ? `<p style="margin-top: 16px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 14px; color: #166534;">
        <strong>Payment required:</strong> Please pay &euro;${price} to secure your session. Your payment is held safely until you receive and accept your photos.
      </p>
      <p><a href="${paymentUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now &mdash; &euro;${price}</a></p>`
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
  amount: number,
  clientPhone?: string | null
) {
  const firstName = clientName.split(" ")[0];
  const contactSection = clientPhone
    ? `<div style="margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 13px;">
        <strong style="color: #166534;">Client phone:</strong> ${clientPhone}
      </div>`
    : "";

  await sendEmail(
    photographerEmail,
    `Payment received from ${firstName} — €${amount}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Received!</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${firstName}</strong> has paid <strong>&euro;${amount}</strong> for their booking.</p>
      <p>The funds are held securely until the client accepts the photo delivery.</p>
      ${contactSection}
      <p style="margin-top: 12px;"><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
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
    `Payment confirmed — €${amount} for your session with ${photographerName}`,
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
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `${clientFirstName} accepted delivery — €${payoutAmount.toFixed(2)} transferred to you`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Transferred!</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientFirstName}</strong> has accepted the photo delivery. A payment of <strong>&euro;${payoutAmount.toFixed(2)}</strong> has been transferred to your Stripe account.</p>
      <p>The funds should arrive in your bank account within 2-7 business days, depending on your Stripe payout schedule.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Dashboard</a></p>
      <p style="margin-top: 16px;">Enjoyed working with this client? Leave a quick review to help build your reputation on the platform:</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="color: #C94536; font-weight: bold; text-decoration: none;">Leave a Review</a></p>
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
      <p>If you enjoyed your experience, we'd love to hear from you! A quick review helps other travelers find great photographers:</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Leave a Review</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
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
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Thank you for your review! 🙏</h2>
      <p>Hi ${clientName},</p>
      <p>We really appreciate you sharing your experience with <strong>${photographerName}</strong> on our platform.</p>
      <p>We have one small favour to ask — it would mean the world to our small business if you could also leave a quick review on Trustpilot. It takes less than a minute and helps other travelers discover Photo Portugal:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="https://www.trustpilot.com/evaluate/photoportugal.com" style="display: inline-block; background: #00b67a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">⭐ Review us on Trustpilot</a>
      </p>
      <p style="color: #666; font-size: 13px;">Even a few words make a huge difference. Thank you for supporting independent photography in Portugal!</p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
  );
}

export async function sendTrustpilotFollowUpToPhotographer(
  photographerEmail: string,
  photographerName: string
) {
  await sendEmail(
    photographerEmail,
    `Quick favour, ${photographerName}?`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Help us grow! 🙏</h2>
      <p>Hi ${photographerName},</p>
      <p>Thank you for being part of Photo Portugal. Your work is what makes this platform great.</p>
      <p>We'd love it if you could share your experience as a photographer on Trustpilot. A genuine review from a professional like you helps build trust and brings more clients to the platform — which means more bookings for everyone:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="https://www.trustpilot.com/evaluate/photoportugal.com" style="display: inline-block; background: #00b67a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">⭐ Review us on Trustpilot</a>
      </p>
      <p style="color: #666; font-size: 13px;">It takes less than a minute. Thank you for your support!</p>
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
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `New ${rating}-star review from ${clientFirstName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Review</h2>
      <p>Hi ${photographerName},</p>
      <p><strong>${clientFirstName}</strong> left you a review:</p>
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

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  await sendEmail(
    to,
    "Verify your email — Photo Portugal",
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Verify Your Email</h2>
      <p>Hi ${name},</p>
      <p>Thank you for signing up! Please verify your email address to activate your account:</p>
      <p style="margin: 24px 0; text-align: center;">
        <a href="${verifyUrl}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">Verify Email Address</a>
      </p>
      <p style="color: #666; font-size: 13px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
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

  if (isPhotographer) {
    await sendEmail(
      to,
      "Welcome to Photo Portugal — Let's get you started!",
      `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #C94536;">Welcome to Photo Portugal!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for joining Photo Portugal! We're excited to have you on the platform. Here's how to get your profile live and start receiving bookings:</p>

        <div style="margin: 24px 0; padding: 20px; background: #faf8f5; border-radius: 12px;">
          <p style="margin: 0 0 12px; font-weight: bold; color: #333;">Your setup checklist:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #666;">1.</td><td style="padding: 6px 8px;"><strong>Complete your profile</strong> — Add a photo, bio, and tagline</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">2.</td><td style="padding: 6px 8px;"><strong>Upload a cover image</strong> — This appears on your card</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">3.</td><td style="padding: 6px 8px;"><strong>Add portfolio photos</strong> — At least 5, we recommend 10+</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">4.</td><td style="padding: 6px 8px;"><strong>Create packages</strong> — Set up 2–3 at different price points</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">5.</td><td style="padding: 6px 8px;"><strong>Select your locations</strong> — Where you're available to shoot</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">6.</td><td style="padding: 6px 8px;"><strong>Connect Stripe</strong> — Required to receive payments</td></tr>
          </table>
        </div>

        <p>Once your profile is complete and approved by our team, you'll appear in search results and can start receiving bookings.</p>

        <div style="margin: 20px 0; padding: 16px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
          <p style="margin: 0 0 10px; font-weight: bold; color: #991b1b;">Important rules:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #7f1d1d;">
            <tr><td style="padding: 4px 0; vertical-align: top;">⏰</td><td style="padding: 4px 8px;"><strong>Complete your profile within 7 days</strong> — accounts that remain incomplete will be automatically deactivated</td></tr>
            <tr><td style="padding: 4px 0; vertical-align: top;">🚫</td><td style="padding: 4px 8px;"><strong>Never work with clients off-platform</strong> — soliciting clients outside Photo Portugal or accepting direct payments results in a permanent ban</td></tr>
            <tr><td style="padding: 4px 0; vertical-align: top;">⏱️</td><td style="padding: 4px 8px;"><strong>Respond to booking requests within 24 hours</strong> — clients expect fast communication</td></tr>
          </table>
        </div>

        <p><a href="${BASE_URL}/dashboard/profile" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Complete Your Profile</a></p>

        <p style="margin-top: 20px; font-size: 13px; color: #666;">
          <strong>Helpful links:</strong><br>
          <a href="${BASE_URL}/support" style="color: #C94536;">Help Center</a> — answers to common questions<br>
          <a href="${BASE_URL}/pricing" style="color: #C94536;">Pricing & Plans</a> — commission rates and features<br>
          <a href="${BASE_URL}/contact" style="color: #C94536;">Contact Us</a> — we're here to help
        </p>

        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>
      `
    );
  } else {
    await sendEmail(
      to,
      "Welcome to Photo Portugal!",
      `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">Welcome to Photo Portugal!</h2>
        <p>Hi ${name},</p>
        <p>You're all set! Here's how to book your perfect photoshoot in Portugal:</p>

        <div style="margin: 20px 0; padding: 16px; background: #faf8f5; border-radius: 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #C94536; font-weight: bold; vertical-align: top;">1.</td><td style="padding: 6px 8px;"><strong>Browse photographers</strong> — Find your style in Lisbon, Porto, Algarve, and 20 more locations</td></tr>
            <tr><td style="padding: 6px 0; color: #C94536; font-weight: bold; vertical-align: top;">2.</td><td style="padding: 6px 8px;"><strong>Pick a package</strong> — Choose the session length and number of photos</td></tr>
            <tr><td style="padding: 6px 0; color: #C94536; font-weight: bold; vertical-align: top;">3.</td><td style="padding: 6px 8px;"><strong>Book & pay securely</strong> — Your payment is held in escrow until you approve the photos</td></tr>
          </table>
        </div>

        <p><a href="${BASE_URL}/photographers" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Browse Photographers</a></p>

        <p style="margin-top: 16px; font-size: 13px; color: #666;">
          Questions? <a href="${BASE_URL}/support" style="color: #C94536;">Visit our Help Center</a> or <a href="${BASE_URL}/contact" style="color: #C94536;">contact us</a>.
        </p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>
      `
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

// Send to all admin emails in parallel, failures don't block each other
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
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Photographer Registration</h2>
      <p>A new photographer has registered and is setting up their profile:</p>
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

export async function sendAdminNewClientNotification(
  clientName: string,
  clientEmail: string
) {
  await sendToAllAdmins(
    `[New Client] ${clientName} has signed up`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Client Registration</h2>
      <p>A new client has signed up:</p>
      <ul style="line-height: 1.8;">
        <li><strong>Name:</strong> ${clientName}</li>
        <li><strong>Email:</strong> ${clientEmail}</li>
      </ul>
      <p><a href="${BASE_URL}/admin#clients" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin Panel</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
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
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `Tomorrow: Photoshoot with ${clientFirstName}`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Photoshoot Tomorrow!</h2>
      <p>Hi ${photographerName},</p>
      <p>Reminder: you have a photoshoot with <strong>${clientFirstName}</strong> scheduled for <strong>${shootDate}</strong>.</p>
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
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `Reminder: ${clientFirstName} is waiting for their photos`,
    `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Delivery Reminder</h2>
      <p>Hi ${photographerName},</p>
      <p>Your client <strong>${clientFirstName}</strong> is waiting for their photos. The expected delivery time has passed.</p>
      <p>Please upload and deliver the photos as soon as possible.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Bookings</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `
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
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #22C55E;">Booking Confirmed ✓</h2>
      <ul style="line-height: 1.8;">
        <li><strong>Client:</strong> ${clientName}</li>
        <li><strong>Photographer:</strong> ${photographerName}</li>
        <li><strong>Date:</strong> ${dateStr}</li>
        ${packageName ? `<li><strong>Package:</strong> ${packageName}</li>` : ""}
        ${totalPrice ? `<li><strong>Price:</strong> €${Math.round(totalPrice)}</li>` : ""}
      </ul>
      <p>Payment link has been sent to the client.</p>
      <p><a href="${BASE_URL}/admin#bookings" style="display: inline-block; background: #22C55E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin Panel</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal</p>
    </div>`
  );
}

export async function sendAdminBookingCancelledNotification(
  clientName: string,
  photographerName: string,
  cancelledBy: "client" | "photographer" | "admin",
  refundAmount: number | null
) {
  const refundLine = refundAmount && refundAmount > 0
    ? `<li><strong>Refund:</strong> &euro;${refundAmount.toFixed(2)}</li>`
    : `<li><strong>Refund:</strong> None</li>`;
  await sendToAllAdmins(
    `[Booking Cancelled] ${clientName} \u2194 ${photographerName}`,
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Booking Cancelled</h2>
      <ul style="line-height: 1.8;">
        <li><strong>Client:</strong> ${clientName}</li>
        <li><strong>Photographer:</strong> ${photographerName}</li>
        <li><strong>Cancelled by:</strong> ${cancelledBy}</li>
        ${refundLine}
      </ul>
      <p><a href="${BASE_URL}/admin#bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin Panel</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal</p>
    </div>`
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
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Payment Failed</h2>
      <p>Hi ${clientName},</p>
      <p>Your payment for the photoshoot with <strong>${photographerName}</strong> could not be processed.</p>
      <p>Please try again with a different payment method or contact your bank for details.</p>
      <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Retry Payment</a></p>
      <p style="margin-top: 16px; font-size: 13px; color: #666;">
        Need help? <a href="${BASE_URL}/support" style="color: #C94536;">Contact support</a>
      </p>
      <p style="color: #999; font-size: 12px;">Photo Portugal</p>
    </div>`
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
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">New Review Published!</h2>
      <p>Hi ${photographerName},</p>
      <p>A review from <strong>${clientFirstName}</strong> has been approved and is now visible on your profile.</p>
      <div style="margin: 16px 0; padding: 16px; background: #faf8f5; border-radius: 8px;">
        <p style="margin: 0; font-size: 20px; color: #f59e0b;">${stars}</p>
      </div>
      <p><a href="${BASE_URL}/photographers/${profileSlug}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Your Profile</a></p>
      <p style="color: #999; font-size: 12px;">Photo Portugal</p>
    </div>`
  );
}
