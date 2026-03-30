import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import {
  sendEmail,
  getAdminEmail,
  sendPaymentReminderToClient,
  sendShootReminderToClient,
  sendShootReminderToPhotographer,
  sendDeliveryReminderToPhotographer,
  sendTrustpilotFollowUpToClient,
  sendTrustpilotFollowUpToPhotographer,
} from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { requireStripe, calculatePayment } from "@/lib/stripe";
import { rm } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    paymentReminders: 0,
    autoCancelled: 0,
    shootReminders: 0,
    deliveryReminders: 0,
    deliveryEscalations: 0,
    deliveryAutoRefunds: 0,
    autoReleasedPayments: 0,
    trustpilotFollowUps: 0,
    errors: [] as string[],
  };

  // === 1. Payment reminders (24h after confirmation if unpaid) ===
  try {
    const unpaidBookings = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_name: string;
      payment_url: string | null;
      total_price: number | null;
    }>(
      `SELECT b.id, u.email as client_email, u.name as client_name,
              pu.name as photographer_name,
              b.payment_url, b.total_price
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'confirmed'
         AND b.payment_status != 'paid'
         AND b.created_at < NOW() - INTERVAL '24 hours'
         AND b.created_at > NOW() - INTERVAL '48 hours'
         AND b.payment_reminder_sent = FALSE`
    );

    for (const booking of unpaidBookings) {
      try {
        await sendPaymentReminderToClient(
          booking.client_email,
          booking.client_name,
          booking.photographer_name,
          null, // Don't use stored payment_url — Stripe checkout sessions expire after 24h
          booking.total_price
        );
        await queryOne(
          "UPDATE bookings SET payment_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.paymentReminders++;
      } catch (err) {
        results.errors.push(`Payment reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Payment reminders query: ${err}`);
  }

  // === 1b. Auto-cancel unpaid bookings (48h after confirmation) ===
  try {
    const staleUnpaid = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_email: string;
      photographer_name: string;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.email as photographer_email, pu.name as photographer_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'confirmed'
         AND b.payment_status IS DISTINCT FROM 'paid'
         AND b.updated_at < NOW() - INTERVAL '48 hours'`
    );

    for (const booking of staleUnpaid) {
      try {
        await queryOne(
          "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING id",
          [booking.id]
        );

        // Notify client
        sendEmail(
          booking.client_email,
          `Booking cancelled — payment not received`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.client_name},</p>
            <p>Your booking with <strong>${booking.photographer_name}</strong> has been automatically cancelled because payment was not received within 48 hours.</p>
            <p>If you'd still like to book, feel free to submit a new request.</p>
            <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/photographers" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Browse Photographers</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Notify photographer
        sendEmail(
          booking.photographer_email,
          `Booking auto-cancelled — client did not pay`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>The booking with <strong>${booking.client_name}</strong> has been automatically cancelled because payment was not received within 48 hours.</p>
            <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        results.autoCancelled++;
      } catch (err) {
        results.errors.push(`Auto-cancel booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Auto-cancel unpaid query: ${err}`);
  }

  // === 2. Shoot reminders (24h before shoot_date) ===
  try {
    const upcomingBookings = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_email: string;
      photographer_name: string;
      shoot_date: string;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.email as photographer_email, pu.name as photographer_name,
              b.shoot_date::text
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status IN ('confirmed')
         AND b.payment_status = 'paid'
         AND b.shoot_date = CURRENT_DATE + INTERVAL '1 day'
         AND b.shoot_reminder_sent = FALSE
         AND b.reminder_sent = FALSE`
    );

    for (const booking of upcomingBookings) {
      try {
        await sendShootReminderToClient(
          booking.client_email,
          booking.client_name,
          booking.photographer_name,
          booking.shoot_date
        );
        await sendShootReminderToPhotographer(
          booking.photographer_email,
          booking.photographer_name,
          booking.client_name,
          booking.shoot_date
        );
        // SMS reminders to both parties
        try {
          const smsInfo = await queryOne<{
            photographer_phone: string | null; photographer_user_id: string;
            client_phone: string | null; client_id: string;
          }>(
            `SELECT pu.phone as photographer_phone, pu.id as photographer_user_id,
                    cu.phone as client_phone, cu.id as client_id
             FROM bookings b
             JOIN users cu ON cu.id = b.client_id
             JOIN photographer_profiles pp ON pp.id = b.photographer_id
             JOIN users pu ON pu.id = pp.user_id
             WHERE b.id = $1`,
            [booking.id]
          );
          if (smsInfo) {
            // Photographer WhatsApp/SMS
            if (smsInfo.photographer_phone) {
              const pPrefs = await queryOne<{ sms_bookings: boolean }>(
                "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                [smsInfo.photographer_user_id]
              );
              if (pPrefs?.sms_bookings !== false) {
                sendWhatsApp(
                  smsInfo.photographer_phone,
                  "shoot_reminder",
                  [booking.client_name],
                  `Photo Portugal: Reminder — you have a photoshoot with ${booking.client_name} tomorrow. Check your dashboard for details.`
                ).catch(err => console.error("[whatsapp] error:", err));
              }
            }
            // Client WhatsApp/SMS
            if (smsInfo.client_phone) {
              const cPrefs = await queryOne<{ sms_bookings: boolean }>(
                "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                [smsInfo.client_id]
              );
              if (cPrefs?.sms_bookings !== false) {
                sendWhatsApp(
                  smsInfo.client_phone,
                  "shoot_reminder",
                  [booking.photographer_name],
                  `Photo Portugal: Reminder — your photoshoot with ${booking.photographer_name} is tomorrow! Check your dashboard for details.`
                ).catch(err => console.error("[whatsapp] error:", err));
              }
            }
          }
        } catch (smsErr) {
          console.error("[cron] shoot reminder sms error:", smsErr);
        }

        await queryOne(
          "UPDATE bookings SET shoot_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.shootReminders++;
      } catch (err) {
        results.errors.push(`Shoot reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Shoot reminders query: ${err}`);
  }

  // === 3. Delivery reminders (if delivery_days passed after completion) ===
  try {
    const overdueDeliveries = await query<{
      id: string;
      photographer_email: string;
      photographer_name: string;
      client_name: string;
    }>(
      `SELECT b.id, pu.email as photographer_email, pu.name as photographer_name,
              cu.name as client_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.status = 'completed'
         AND b.delivery_token IS NULL
         AND b.updated_at < NOW() - (COALESCE(p.delivery_days, 7) * INTERVAL '1 day')
         AND b.delivery_reminder_sent = FALSE`
    );

    for (const booking of overdueDeliveries) {
      try {
        await sendDeliveryReminderToPhotographer(
          booking.photographer_email,
          booking.photographer_name,
          booking.client_name
        );
        await queryOne(
          "UPDATE bookings SET delivery_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.deliveryReminders++;
      } catch (err) {
        results.errors.push(`Delivery reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery reminders query: ${err}`);
  }

  // === 3b. Delivery escalation: 14-day second reminder + admin alert ===
  try {
    const overdueEscalations = await query<{
      id: string;
      photographer_email: string;
      photographer_name: string;
      client_name: string;
      client_email: string;
    }>(
      `SELECT b.id, pu.email as photographer_email, pu.name as photographer_name,
              cu.name as client_name, cu.email as client_email
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.status = 'completed'
         AND b.delivery_token IS NULL
         AND b.updated_at < NOW() - INTERVAL '14 days'
         AND b.delivery_reminder_sent = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM bookings b2 WHERE b2.id = b.id AND b2.updated_at < NOW() - INTERVAL '21 days'
         )`
    );

    for (const booking of overdueEscalations) {
      try {
        // Second reminder to photographer
        await sendEmail(
          booking.photographer_email,
          `Urgent: ${booking.client_name} is still waiting for their photos (14 days overdue)`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Second Delivery Reminder</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>Your client <strong>${booking.client_name}</strong> has been waiting for their photos for over 14 days. Please deliver the photos as soon as possible.</p>
            <p style="padding: 12px; background: #fef2f2; border-radius: 8px; color: #991b1b; font-size: 13px;">
              <strong>Warning:</strong> If photos are not delivered within 21 days, the booking will be automatically cancelled and the client will receive a full refund.
            </p>
            <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Alert admin
        const adminEmail = await getAdminEmail();
        const adminEmails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
        for (const email of adminEmails) {
          await sendEmail(
            email,
            `[Alert] Photographer ${booking.photographer_name} overdue on delivery for 14 days`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Delivery Overdue — 14 Days</h2>
              <p>Photographer <strong>${booking.photographer_name}</strong> (${booking.photographer_email}) has not delivered photos for booking ${booking.id}.</p>
              <p>Client: <strong>${booking.client_name}</strong> (${booking.client_email})</p>
              <p>The booking will be auto-refunded at 21 days if not resolved.</p>
              <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin</a></p>
            </div>`
          );
        }

        results.deliveryEscalations++;
      } catch (err) {
        results.errors.push(`Delivery escalation for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery escalation query: ${err}`);
  }

  // === 3c. Delivery auto-refund: 21 days overdue, auto-cancel and refund ===
  try {
    const overdueAutoRefunds = await query<{
      id: string;
      photographer_email: string;
      photographer_name: string;
      client_email: string;
      client_name: string;
      payment_status: string | null;
      stripe_payment_intent_id: string | null;
      total_price: number | null;
      service_fee: number | null;
    }>(
      `SELECT b.id, pu.email as photographer_email, pu.name as photographer_name,
              cu.email as client_email, cu.name as client_name,
              b.payment_status, b.stripe_payment_intent_id, b.total_price, b.service_fee
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.status = 'completed'
         AND b.delivery_token IS NULL
         AND b.updated_at < NOW() - INTERVAL '21 days'`
    );

    for (const booking of overdueAutoRefunds) {
      try {
        // Refund if paid
        if (booking.payment_status === "paid" && booking.stripe_payment_intent_id) {
          try {
            const stripeClient = requireStripe();
            await stripeClient.refunds.create({
              payment_intent: booking.stripe_payment_intent_id,
            });
            await queryOne(
              "UPDATE bookings SET payment_status = 'refunded' WHERE id = $1 RETURNING id",
              [booking.id]
            );
          } catch (stripeErr) {
            console.error(`[cron] auto-refund stripe error for booking ${booking.id}:`, stripeErr);
          }
        }

        // Cancel the booking
        await queryOne(
          "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING id",
          [booking.id]
        );

        const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";

        // Email client
        sendEmail(
          booking.client_email,
          `Booking cancelled — photographer did not deliver photos`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.client_name},</p>
            <p>Your booking with <strong>${booking.photographer_name}</strong> has been automatically cancelled because the photos were not delivered within 21 days.</p>
            ${booking.payment_status === "paid" ? `<p>A full refund has been issued. The refund should appear in your account within 5-10 business days.</p>` : ""}
            <p><a href="${baseUrl}/photographers" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Browse Photographers</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Email photographer
        sendEmail(
          booking.photographer_email,
          `Booking cancelled — photos not delivered within 21 days`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>Your booking with <strong>${booking.client_name}</strong> has been automatically cancelled because photos were not delivered within 21 days.</p>
            ${booking.payment_status === "paid" ? `<p>The client's payment has been refunded.</p>` : ""}
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        results.deliveryAutoRefunds++;
      } catch (err) {
        results.errors.push(`Delivery auto-refund for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery auto-refund query: ${err}`);
  }

  // === 3d. Auto-release payment: 14 days after delivery without client acceptance ===
  try {
    const autoReleaseBookings = await query<{
      id: string;
      total_price: number | null;
      payout_amount: number | null;
      payout_transferred: boolean;
      stripe_payment_intent_id: string | null;
      photographer_stripe_id: string | null;
      photographer_plan: string;
      photographer_email: string;
      photographer_name: string;
      client_email: string;
      client_name: string;
    }>(
      `SELECT b.id, b.total_price, b.payout_amount, b.payout_transferred,
              b.stripe_payment_intent_id,
              pp.stripe_account_id as photographer_stripe_id,
              pp.plan as photographer_plan,
              pu.email as photographer_email,
              pu.name as photographer_name,
              cu.email as client_email,
              cu.name as client_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.status = 'delivered'
         AND COALESCE(b.delivery_accepted, FALSE) = FALSE
         AND b.payment_status = 'paid'
         AND b.updated_at < NOW() - INTERVAL '14 days'`
    );

    for (const booking of autoReleaseBookings) {
      try {
        // Mark as accepted
        await queryOne(
          "UPDATE bookings SET delivery_accepted = TRUE, delivery_accepted_at = NOW() WHERE id = $1 AND COALESCE(delivery_accepted, FALSE) = FALSE RETURNING id",
          [booking.id]
        );

        // Transfer payout to photographer (same logic as delivery accept)
        if (!booking.payout_transferred && booking.photographer_stripe_id) {
          try {
            const stripeClient = requireStripe();

            let payoutAmount = booking.payout_amount ? Number(booking.payout_amount) : null;
            if (!payoutAmount && booking.total_price) {
              const payment = calculatePayment(booking.total_price, booking.photographer_plan);
              payoutAmount = payment.photographerPayout;
            }

            if (payoutAmount && payoutAmount > 0) {
              await stripeClient.transfers.create({
                amount: Math.round(payoutAmount * 100),
                currency: "eur",
                destination: booking.photographer_stripe_id,
                ...(booking.stripe_payment_intent_id
                  ? { transfer_group: booking.stripe_payment_intent_id }
                  : {}),
                metadata: {
                  booking_id: booking.id,
                  type: "auto_release_payout",
                  ...(booking.stripe_payment_intent_id
                    ? { payment_intent_id: booking.stripe_payment_intent_id }
                    : {}),
                },
              });

              await queryOne(
                "UPDATE bookings SET payout_transferred = TRUE WHERE id = $1 RETURNING id",
                [booking.id]
              );
            }
          } catch (stripeErr) {
            console.error(`[cron] auto-release payout error for booking ${booking.id}:`, stripeErr);
          }
        }

        // Update delivery expiry to 60 days from now
        const newExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        await queryOne(
          "UPDATE bookings SET delivery_expires_at = $1 WHERE id = $2 RETURNING id",
          [newExpiry.toISOString(), booking.id]
        );

        const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";

        // Email client
        sendEmail(
          booking.client_email,
          `Photos auto-accepted after 14 days`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Photos Auto-Accepted</h2>
            <p>Hi ${booking.client_name},</p>
            <p>Your photos from <strong>${booking.photographer_name}</strong> have been automatically accepted after 14 days. The payment has been released to the photographer.</p>
            <p>Your photos are still available for download for 60 days.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Email photographer
        sendEmail(
          booking.photographer_email,
          `Photos auto-accepted after 14 days — payment released`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Payment Released!</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>The photos for <strong>${booking.client_name}</strong> have been automatically accepted after 14 days. Your payment has been transferred to your Stripe account.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Dashboard</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        results.autoReleasedPayments++;
      } catch (err) {
        results.errors.push(`Auto-release payment for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Auto-release payments query: ${err}`);
  }

  // === 4. Trustpilot follow-up (3 days after delivery accepted) ===
  try {
    const recentlyAccepted = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_email: string;
      photographer_name: string;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.email as photographer_email, pu.name as photographer_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'delivered'
         AND b.delivery_accepted = TRUE
         AND b.delivery_accepted_at < NOW() - INTERVAL '3 days'
         AND b.delivery_accepted_at > NOW() - INTERVAL '4 days'
         AND b.trustpilot_sent = FALSE`
    );

    for (const booking of recentlyAccepted) {
      try {
        await sendTrustpilotFollowUpToClient(
          booking.client_email,
          booking.client_name,
          booking.photographer_name
        );
        await sendTrustpilotFollowUpToPhotographer(
          booking.photographer_email,
          booking.photographer_name
        );
        await queryOne(
          "UPDATE bookings SET trustpilot_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.trustpilotFollowUps++;
      } catch (err) {
        results.errors.push(`Trustpilot follow-up for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Trustpilot follow-ups query: ${err}`);
  }

  // === Early Bird tier expiration ===
  let earlyBirdExpired = 0;
  try {
    const expired = await query<{ id: string; early_bird_tier: string }>(
      `SELECT id, early_bird_tier FROM photographer_profiles
       WHERE early_bird_expires_at IS NOT NULL
       AND early_bird_expires_at < NOW()
       AND early_bird_tier IS NOT NULL
       AND is_founding = FALSE`
    );
    for (const p of expired) {
      // Downgrade to free plan
      await queryOne(
        `UPDATE photographer_profiles
         SET plan = 'free', early_bird_tier = NULL, early_bird_expires_at = NULL
         WHERE id = $1 RETURNING id`,
        [p.id]
      );
      earlyBirdExpired++;
    }
  } catch (err) {
    results.errors.push(`Early bird expiration: ${err}`);
  }

  // === 5. Expired delivery file cleanup ===
  let expiredDeliveriesCleaned = 0;
  try {
    const expiredDeliveries = await query<{ id: string }>(
      `SELECT b.id FROM bookings b
       WHERE b.delivery_expires_at < NOW() - INTERVAL '30 days'
         AND EXISTS (SELECT 1 FROM delivery_photos dp WHERE dp.booking_id = b.id)`
    );

    for (const booking of expiredDeliveries) {
      try {
        // Delete delivery_photos records from DB
        const deleted = await queryOne<{ count: string }>(
          "WITH d AS (DELETE FROM delivery_photos WHERE booking_id = $1 RETURNING id) SELECT COUNT(*) as count FROM d",
          [booking.id]
        );

        // Delete physical files from disk
        const deliveryDir = path.join(UPLOAD_DIR, "delivery", booking.id);
        try {
          await rm(deliveryDir, { recursive: true, force: true });
        } catch {
          // Directory may not exist, that's fine
        }

        expiredDeliveriesCleaned++;
        console.log(`[cron/reminders] cleaned expired delivery for booking ${booking.id} (${deleted?.count || 0} photos)`);
      } catch (err) {
        results.errors.push(`Expired delivery cleanup for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Expired delivery cleanup query: ${err}`);
  }

  // === Checklist complete → notify admins (cron catch-up) ===
  try {
    const readyPhotographers = await query<{ id: string }>(
      `SELECT pp.id FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE COALESCE(pp.checklist_notified, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND u.avatar_url IS NOT NULL
         AND pp.cover_url IS NOT NULL
         AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
         AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5
         AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
         AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
         AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
         AND u.phone IS NOT NULL`
    );
    for (const p of readyPhotographers) {
      try {
        const { checkAndNotifyChecklistComplete } = await import("@/lib/checklist-notify");
        await checkAndNotifyChecklistComplete(p.id);
      } catch {}
    }
  } catch (err) {
    results.errors.push(`Checklist ready notification: ${err}`);
  }

  // === Checklist deadline reminders (last day — 6-7 days after registration) ===
  let checklistDeadlineEmails = 0;
  try {
    const incompletePhotographers = await query<{ email: string; name: string; id: string }>(
      `SELECT u.email, u.name, pp.id
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = FALSE
         AND pp.created_at >= NOW() - INTERVAL '8 days'
         AND pp.created_at < NOW() - INTERVAL '6 days'
         AND COALESCE(pp.checklist_deadline_emailed, FALSE) = FALSE
         AND NOT (u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
           AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5
           AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
           AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
           AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
           AND u.phone IS NOT NULL)`
    );
    for (const p of incompletePhotographers) {
      try {
        // Mark as emailed first to prevent re-sending on next cron run
        await queryOne("UPDATE photographer_profiles SET checklist_deadline_emailed = TRUE WHERE id = $1", [p.id]);
        await sendEmail(
          p.email,
          "Complete your Photo Portugal profile today",
          `<p>Hi ${p.name},</p>
<p>Your photographer profile on Photo Portugal is almost ready, but some steps are still incomplete.</p>
<p><strong>Please complete your profile today</strong> to avoid account deactivation. Once your checklist is done, our team will review and approve your profile so you can start receiving bookings.</p>
<p><a href="https://photoportugal.com/dashboard" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Complete My Profile</a></p>
<p>If you need help, reply to this email or visit our <a href="https://photoportugal.com/support">Help Center</a>.</p>
<p>Best,<br>Photo Portugal Team</p>`
        );
        checklistDeadlineEmails++;
        console.log(`[cron/reminders] checklist deadline email sent to ${p.email}`);
      } catch (err) {
        results.errors.push(`Checklist deadline email for ${p.email}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Checklist deadline query: ${err}`);
  }

  // === Auto-deactivate photographers who didn't complete checklist in 7 days ===
  let checklistDeactivated = 0;
  try {
    const expired = await query<{ id: string; email: string; name: string }>(
      `SELECT pp.id, u.email, u.name
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = FALSE
         AND pp.created_at < NOW() - INTERVAL '7 days'
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND NOT (u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
           AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5
           AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
           AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
           AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
           AND u.phone IS NOT NULL)`
    );
    for (const p of expired) {
      try {
        await query("UPDATE users SET is_banned = TRUE WHERE id = (SELECT user_id FROM photographer_profiles WHERE id = $1)", [p.id]);
        await sendEmail(
          p.email,
          "Your Photo Portugal account has been deactivated",
          `<p>Hi ${p.name},</p>
<p>Your photographer profile on Photo Portugal has been deactivated because the onboarding checklist was not completed within 7 days of registration.</p>
<p>If you'd like to reactivate your account, please contact us at <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> and we'll help you get started again.</p>
<p>Best,<br>Photo Portugal Team</p>`
        );
        checklistDeactivated++;
        console.log(`[cron/reminders] deactivated incomplete photographer ${p.name} (${p.email})`);
      } catch (err) {
        results.errors.push(`Checklist deactivation for ${p.email}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Checklist deactivation query: ${err}`);
  }

  // Clean old notification logs (30 days)
  try {
    const { cleanOldNotificationLogs } = await import("@/lib/notification-log");
    await cleanOldNotificationLogs();
  } catch {}

  // Clean old visitor sessions (30 days)
  try {
    await queryOne("DELETE FROM visitor_sessions WHERE started_at < NOW() - INTERVAL '30 days'", []);
  } catch {}

  console.log("[cron/reminders]", results, { earlyBirdExpired, expiredDeliveriesCleaned, checklistDeadlineEmails, checklistDeactivated });

  return NextResponse.json({
    success: true,
    ...results,
    earlyBirdExpired,
    expiredDeliveriesCleaned,
    checklistDeadlineEmails,
    checklistDeactivated,
  });

}
