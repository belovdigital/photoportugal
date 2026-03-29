/**
 * Cron job script for Photo Portugal
 * Run daily: node --experimental-strip-types scripts/cron.ts
 *
 * Tasks:
 * 1. Send 24h reminders for confirmed bookings
 * 2. Send review requests 3 days after delivered/completed bookings
 */

import { Pool } from "pg";
import nodemailer from "nodemailer";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://photoportugal:PhotoPortugal2026Secure@localhost:5432/photoportugal",
});

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
const BASE_URL = "https://photoportugal.com";

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_PASS) {
    console.log(`[cron] SMTP not configured, skip: ${subject} → ${to}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[cron] Sent: ${subject} → ${to}`);
  } catch (e) {
    console.error(`[cron] Failed: ${subject} → ${to}`, e);
  }
}

// === TASK 1: 24h Reminders ===
async function sendReminders() {
  console.log("[cron] Checking for 24h reminders...");

  const bookings = await pool.query(
    `SELECT b.id, b.shoot_date, b.shoot_time,
            cu.name as client_name, cu.email as client_email,
            pu.name as photographer_name, pu.email as photographer_email
     FROM bookings b
     JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     WHERE b.status = 'confirmed'
       AND b.shoot_date = CURRENT_DATE + INTERVAL '1 day'
       AND b.reminder_sent = FALSE`
  );

  for (const b of bookings.rows) {
    // Email to client
    await sendEmail(
      b.client_email,
      `Reminder: Your photoshoot with ${b.photographer_name} is tomorrow!`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">Photoshoot Tomorrow!</h2>
        <p>Hi ${b.client_name},</p>
        <p>Just a friendly reminder — your photoshoot with <strong>${b.photographer_name}</strong> is scheduled for tomorrow${b.shoot_time ? ` (${b.shoot_time})` : ""}.</p>
        <p>Make sure to:</p>
        <ul>
          <li>Confirm the meeting point with your photographer</li>
          <li>Check the weather and plan accordingly</li>
          <li>Wear comfortable, photogenic clothing</li>
        </ul>
        <p><a href="${BASE_URL}/dashboard/messages" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Message Your Photographer</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    );

    // Email to photographer
    await sendEmail(
      b.photographer_email,
      `Reminder: Session with ${b.client_name} tomorrow`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">Session Tomorrow!</h2>
        <p>Hi ${b.photographer_name},</p>
        <p>Reminder: you have a photoshoot with <strong>${b.client_name}</strong> scheduled for tomorrow${b.shoot_time ? ` (${b.shoot_time})` : ""}.</p>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Booking</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    );

    // Mark as sent
    await pool.query("UPDATE bookings SET reminder_sent = TRUE WHERE id = $1", [b.id]);
    console.log(`[cron] Reminder sent for booking ${b.id}`);
  }

  console.log(`[cron] Sent ${bookings.rows.length} reminders`);
}

// === TASK 2: Auto Review Request ===
async function sendReviewRequests() {
  console.log("[cron] Checking for review requests...");

  const bookings = await pool.query(
    `SELECT b.id, cu.name as client_name, cu.email as client_email,
            pu.name as photographer_name
     FROM bookings b
     JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     WHERE b.status IN ('completed', 'delivered')
       AND b.review_requested = FALSE
       AND b.updated_at < NOW() - INTERVAL '3 days'
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`
  );

  for (const b of bookings.rows) {
    // Check client preferences
    const prefs = await pool.query(
      "SELECT email_reviews FROM notification_preferences WHERE user_id = (SELECT client_id FROM bookings WHERE id = $1)",
      [b.id]
    );
    if (prefs.rows[0]?.email_reviews === false) {
      await pool.query("UPDATE bookings SET review_requested = TRUE WHERE id = $1", [b.id]);
      continue;
    }

    await sendEmail(
      b.client_email,
      `How was your photoshoot with ${b.photographer_name}?`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">How was your experience?</h2>
        <p>Hi ${b.client_name},</p>
        <p>We hope you loved your photos from <strong>${b.photographer_name}</strong>!</p>
        <p>Your feedback helps other travelers find great photographers and helps ${b.photographer_name} grow their business.</p>
        <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Leave a Review</a></p>
        <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    );

    await pool.query("UPDATE bookings SET review_requested = TRUE WHERE id = $1", [b.id]);
    console.log(`[cron] Review request sent for booking ${b.id}`);
  }

  console.log(`[cron] Sent ${bookings.rows.length} review requests`);
}

// === Main ===
async function main() {
  console.log(`[cron] Starting at ${new Date().toISOString()}`);
  try {
    await sendReminders();
    await sendReviewRequests();
  } catch (error) {
    console.error("[cron] Error:", error);
  }
  await pool.end();
  console.log("[cron] Done");
}

main();
