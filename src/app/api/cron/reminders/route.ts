import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import {
  sendPaymentReminderToClient,
  sendShootReminderToClient,
  sendShootReminderToPhotographer,
  sendDeliveryReminderToPhotographer,
} from "@/lib/email";

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    paymentReminders: 0,
    shootReminders: 0,
    deliveryReminders: 0,
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
              pp.display_name as photographer_name,
              b.payment_url, b.total_price
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
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
          booking.payment_url,
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
              pu.email as photographer_email, pp.display_name as photographer_name,
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
      `SELECT b.id, pu.email as photographer_email, pp.display_name as photographer_name,
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

  console.log("[cron/reminders]", results, { earlyBirdExpired });

  return NextResponse.json({
    success: true,
    ...results,
    earlyBirdExpired,
  });
}
