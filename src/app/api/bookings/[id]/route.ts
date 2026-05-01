import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, withTransaction } from "@/lib/db";
import { sendBookingConfirmationWithPayment, sendEmail, sendAdminBookingCancelledNotification, sendAdminBookingConfirmedNotification } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { requireStripe, calculatePayment } from "@/lib/stripe";
import { sendBookingStatusMessage } from "@/lib/booking-messages";

const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

// Get a single booking by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const booking = await queryOne(
      `SELECT b.*,
              cu.name as client_name, cu.avatar_url as client_avatar,
              pu.name as photographer_name, pp.slug as photographer_slug,
              pu.avatar_url as photographer_avatar,
              p.name as package_name, p.duration_minutes, p.num_photos
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.id = $1 AND (b.client_id = $2 OR pp.user_id = $2)`,
      [id, user.id]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("[bookings] get by id error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings/:id", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to get booking" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = user.id;
  const { status, welcome_message } = await req.json();

  const validStatuses = ["pending", "confirmed", "completed", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    // Verify ownership: photographer can confirm/complete, both can cancel
    const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
      `SELECT b.client_id, u.id as photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`,
      [id]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isClient = booking.client_id === userId;
    const isPhotographer = booking.photographer_user_id === userId;

    if (!isClient && !isPhotographer) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Only photographer can confirm/complete
    if ((status === "confirmed" || status === "completed" || status === "delivered") && !isPhotographer) {
      return NextResponse.json({ error: "Only the photographer can confirm bookings" }, { status: 403 });
    }

    // Confirming a booking now requires a welcome message — clients who hear
    // from their photographer right after booking are far more likely to pay,
    // so we won't let confirmation through without one.
    const trimmedWelcome = typeof welcome_message === "string" ? welcome_message.trim() : "";
    if (status === "confirmed" && trimmedWelcome.length < 30) {
      return NextResponse.json(
        { error: "Please write a welcome message for your client (at least 30 characters)." },
        { status: 400 }
      );
    }

    // Validate status transitions
    const currentBooking = await queryOne<{ status: string; payment_status: string | null; stripe_payment_intent_id: string | null; delivery_accepted: boolean }>(
      "SELECT status, payment_status, stripe_payment_intent_id, COALESCE(delivery_accepted, FALSE) as delivery_accepted FROM bookings WHERE id = $1",
      [id]
    );
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled"],
      completed: ["delivered"],
    };
    if (currentBooking && !validTransitions[currentBooking.status]?.includes(status)) {
      return NextResponse.json({ error: `Cannot change from ${currentBooking.status} to ${status}` }, { status: 400 });
    }

    // Check: photographer must have Stripe connected before confirming a paid booking
    if (status === "confirmed") {
      const photographerProfile = await queryOne<{ stripe_account_id: string | null; stripe_onboarding_complete: boolean }>(
        `SELECT pp.stripe_account_id, pp.stripe_onboarding_complete
         FROM photographer_profiles pp
         JOIN bookings b ON b.photographer_id = pp.id
         WHERE b.id = $1`,
        [id]
      );
      const bookingPrice = await queryOne<{ total_price: number | null }>("SELECT total_price FROM bookings WHERE id = $1", [id]);

      if (bookingPrice?.total_price && !photographerProfile?.stripe_account_id) {
        return NextResponse.json(
          { error: "Please connect your Stripe account before confirming bookings. Go to Dashboard → Subscription → Stripe Connect to set up payments." },
          { status: 400 }
        );
      }

      // If stripe_account_id exists but onboarding flag is stale, verify live with Stripe API and auto-sync
      if (bookingPrice?.total_price && photographerProfile?.stripe_account_id && !photographerProfile.stripe_onboarding_complete) {
        try {
          const stripeClient = requireStripe();
          const account = await stripeClient.accounts.retrieve(photographerProfile.stripe_account_id);
          if (account.charges_enabled && account.payouts_enabled) {
            // Sync the flag — webhook was likely missed
            await queryOne(
              `UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE
               WHERE stripe_account_id = $1 RETURNING id`,
              [photographerProfile.stripe_account_id]
            );
          } else {
            return NextResponse.json(
              { error: "Your Stripe account setup is incomplete. Please finish onboarding at Dashboard → Subscription → Stripe Connect." },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: "Could not verify your Stripe account. Please try again or contact support." },
            { status: 500 }
          );
        }
      }
    }

    // Handle cancellation with refund when booking is paid
    if (status === "cancelled" && currentBooking?.payment_status === "paid" && currentBooking.stripe_payment_intent_id && !currentBooking.delivery_accepted) {
      try {
        const stripeClient = requireStripe();

        // Use transaction + FOR UPDATE to prevent double refund from concurrent requests
        const cancelResult = await withTransaction(async (client) => {
          const locked = await client.query(
            "SELECT status, payment_status, stripe_payment_intent_id FROM bookings WHERE id = $1 FOR UPDATE",
            [id]
          );
          const lockedBooking = locked.rows[0];
          if (!lockedBooking || lockedBooking.status === "cancelled" || lockedBooking.payment_status !== "paid") {
            return null; // Already cancelled or not paid — skip refund
          }

          const cancelInfo = await client.query(
            `SELECT cu.email as client_email, cu.name as client_name, cu.id as client_user_id,
                    pu.email as photographer_email, pu.name as photographer_name,
                    pu.id as photographer_user_id, pp.id as photographer_profile_id,
                    b.total_price, b.service_fee, b.shoot_date
             FROM bookings b
             JOIN users cu ON cu.id = b.client_id
             JOIN photographer_profiles pp ON pp.id = b.photographer_id
             JOIN users pu ON pu.id = pp.user_id
             WHERE b.id = $1`,
            [id]
          );
          const info = cancelInfo.rows[0];

          let refundPercent = 100;
          if (info?.shoot_date) {
            const shootDate = new Date(info.shoot_date);
            const now = new Date();
            const daysUntilShoot = Math.ceil((shootDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilShoot < 3) {
              refundPercent = 0;
            } else if (daysUntilShoot < 7) {
              refundPercent = 50;
            }
          }

          const totalPaid = Number(info?.total_price ?? 0) + Number(info?.service_fee ?? 0);
          const refundAmount = Math.round((totalPaid * refundPercent) / 100 * 100) / 100;

          if (refundPercent === 100) {
            await stripeClient.refunds.create({
              payment_intent: lockedBooking.stripe_payment_intent_id,
            });
          } else if (refundPercent > 0) {
            await stripeClient.refunds.create({
              payment_intent: lockedBooking.stripe_payment_intent_id,
              amount: Math.round(refundAmount * 100),
            });
          }

          const paymentStatus = refundPercent === 100 ? "refunded" : refundPercent > 0 ? "partially_refunded" : "no_refund";
          await client.query(
            "UPDATE bookings SET status = 'cancelled', payment_status = $1 WHERE id = $2",
            [paymentStatus, id]
          );

          return { info, refundPercent, totalPaid, refundAmount, paymentStatus };
        });

        if (!cancelResult) {
          return NextResponse.json({ error: "Booking already cancelled or not eligible for refund" }, { status: 400 });
        }

        const { info: cancelInfo, refundPercent, totalPaid, refundAmount, paymentStatus } = cancelResult;

        if (cancelInfo) {
          const cancelledBy = isClient ? "client" : "photographer";
          const refundText = refundPercent === 100
            ? `The full payment of <strong>&euro;${totalPaid.toFixed(2)}</strong> has been refunded to the client.`
            : refundPercent > 0
            ? `A partial refund of <strong>&euro;${refundAmount.toFixed(2)}</strong> (${refundPercent}%) has been issued to the client (cancellation within 3-7 days of shoot date).`
            : `No refund has been issued (cancellation less than 3 days before shoot date).`;

          const clientRefundText = refundPercent === 100
            ? `Your payment of <strong>&euro;${totalPaid.toFixed(2)}</strong> has been refunded. The refund should appear in your account within 5-10 business days.`
            : refundPercent > 0
            ? `A partial refund of <strong>&euro;${refundAmount.toFixed(2)}</strong> (${refundPercent}%) has been issued per our cancellation policy (3-7 days before shoot date). The refund should appear in your account within 5-10 business days.`
            : `Per our cancellation policy, no refund is available for cancellations less than 3 days before the shoot date.`;

          // Email to photographer
          sendEmail(
            cancelInfo.photographer_email,
            refundPercent > 0
              ? `Booking cancelled — €${refundAmount.toFixed(2)} refunded to client`
              : `Booking cancelled — no refund issued`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Booking Cancelled</h2>
              <p>Hi ${cancelInfo.photographer_name},</p>
              <p>A booking with <strong>${cancelInfo.client_name}</strong> has been cancelled by the ${cancelledBy}.</p>
              <p>${refundText}</p>
              <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );

          // Email to client
          sendEmail(
            cancelInfo.client_email,
            refundPercent > 0
              ? `Booking cancelled — €${refundAmount.toFixed(2)} refunded`
              : `Booking cancelled — no refund per cancellation policy`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Booking Cancelled</h2>
              <p>Hi ${cancelInfo.client_name},</p>
              <p>Your booking with <strong>${cancelInfo.photographer_name}</strong> has been cancelled.</p>
              <p>${clientRefundText}</p>
              <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );

          // Notify admin
          sendAdminBookingCancelledNotification(
            cancelInfo.client_name, cancelInfo.photographer_name, cancelledBy, refundAmount
          ).catch((err) => console.error("[bookings] admin cancel notification error:", err));
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`❌ <b>Booking Cancelled</b>\n\nCancelled by ${cancelledBy}\n${cancelInfo!.client_name} → ${cancelInfo!.photographer_name}\nRefund: €${refundAmount.toFixed(2)} (${refundPercent}%)`, "bookings");
          }).catch((err) => console.error("[bookings] telegram cancellation error:", err));

          // SMS/WhatsApp to photographer
          try {
            const photographerPhone = await queryOne<{ phone: string | null }>(
              "SELECT phone FROM users WHERE id = $1",
              [cancelInfo.photographer_user_id]
            );
            const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
              "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
              [cancelInfo.photographer_user_id]
            );
            if (photographerPhone?.phone && smsPrefs?.sms_bookings !== false) {
              sendSMS(
                photographerPhone.phone,
                `Photo Portugal: Booking with ${cancelInfo.client_name} has been cancelled by the ${cancelledBy}. Log in to view: https://photoportugal.com/dashboard/bookings`
              ).catch(err => console.error("[sms] cancellation error:", err));
            }
          } catch (smsErr) {
            console.error("[bookings] cancellation sms error:", smsErr);
          }

          // Push to whichever party did NOT cancel (the one who got the
          // unpleasant surprise). Cancelled-by-self is shown in their own
          // UI directly so they don't need a notification.
          {
            const recipientId = cancelledBy === "client"
              ? cancelInfo.photographer_user_id
              : cancelInfo.client_user_id;
            const otherName = cancelledBy === "client"
              ? cancelInfo.client_name
              : cancelInfo.photographer_name;
            if (recipientId) {
              import("@/lib/push").then(m =>
                m.sendPushNotification(
                  recipientId,
                  "Booking cancelled",
                  refundPercent > 0
                    ? `${otherName} cancelled. Refund €${refundAmount.toFixed(2)} processed.`
                    : `${otherName} cancelled the booking.`,
                  { type: "booking", bookingId: id }
                )
              ).catch(err => console.error("[bookings] cancel push error:", err));
            }
          }

          // Telegram to photographer
          import("@/lib/notify-photographer").then(m =>
            m.notifyPhotographerViaTelegram(
              cancelInfo!.photographer_profile_id,
              `❌ Booking cancelled\n\nClient: ${cancelInfo!.client_name}\nCancelled by: ${cancelledBy}\nRefund: €${refundAmount.toFixed(2)} (${refundPercent}%)\n\nView: https://photoportugal.com/dashboard/bookings`
            )
          ).catch((err) => console.error("[bookings] telegram photographer cancel error:", err));
        }

        return NextResponse.json({ success: true, refunded: refundPercent > 0, refundPercent });
      } catch (refundErr) {
        console.error("[bookings] refund error:", refundErr);
        try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(refundErr, { path: "/api/bookings/:id", method: req.method, statusCode: 500 }); } catch {}
        return NextResponse.json({ error: "Failed to process refund. Please contact support." }, { status: 500 });
      }
    }

    // Conditional update: only transition if status hasn't changed since we read it.
    // This is also our idempotency guard — if the update returns null, a concurrent
    // request already changed the status, so we skip all side-effects (emails, SMS).
    const updateResult = await queryOne<{ id: string }>(
      status === "confirmed"
        ? "UPDATE bookings SET status = $1, confirmed_at = NOW() WHERE id = $2 AND status = $3 RETURNING id"
        : "UPDATE bookings SET status = $1 WHERE id = $2 AND status = $3 RETURNING id",
      [status, id, currentBooking!.status]
    );

    // Send system message to chat for status change
    sendBookingStatusMessage(id, status, userId).catch((err) => console.error("[bookings] status message error:", err));

    // For confirmation, also post the photographer's welcome message as the
    // first real chat message — this turns silent "system" confirmations into
    // a warm hand-off that nudges the client toward paying.
    if (status === "confirmed" && updateResult && trimmedWelcome) {
      try {
        await queryOne(
          "INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, FALSE) RETURNING id",
          [id, userId, trimmedWelcome]
        );
      } catch (err) {
        console.error("[bookings] failed to post welcome message:", err);
      }
    }

    if (!updateResult) {
      return NextResponse.json(
        { error: "Booking status was changed by another request. Please refresh and try again." },
        { status: 409 }
      );
    }

    // Send cancellation emails for unpaid cancellations
    if (status === "cancelled") {
      try {
        const cancelInfo = await queryOne<{
          client_email: string; client_name: string; client_user_id: string;
          photographer_email: string; photographer_name: string;
          photographer_user_id: string; photographer_profile_id: string;
        }>(
          `SELECT cu.email as client_email, cu.name as client_name, cu.id as client_user_id,
                  pu.email as photographer_email, pu.name as photographer_name,
                  pu.id as photographer_user_id, pp.id as photographer_profile_id
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`,
          [id]
        );

        if (cancelInfo) {
          const cancelledBy = isClient ? "client" : "photographer";
          const otherEmail = isClient ? cancelInfo.photographer_email : cancelInfo.client_email;
          const otherName = isClient ? cancelInfo.photographer_name : cancelInfo.client_name;
          const cancellerName = isClient ? cancelInfo.client_name : cancelInfo.photographer_name;

          sendEmail(
            otherEmail,
            `Booking cancelled by ${cancellerName}`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Booking Cancelled</h2>
              <p>Hi ${otherName},</p>
              <p>The booking with <strong>${cancellerName}</strong> has been cancelled by the ${cancelledBy}.</p>
              <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );

          // Notify admin
          sendAdminBookingCancelledNotification(
            cancelInfo.client_name, cancelInfo.photographer_name, cancelledBy, null
          ).catch((err) => console.error("[bookings] admin cancel notification error:", err));
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`❌ <b>Booking Cancelled</b>\n\nCancelled by ${cancelledBy}\n${cancelInfo!.client_name} → ${cancelInfo!.photographer_name}`, "bookings");
          }).catch((err) => console.error("[bookings] telegram cancellation error:", err));

          // SMS/WhatsApp to photographer
          try {
            const photographerPhone = await queryOne<{ phone: string | null }>(
              "SELECT phone FROM users WHERE id = $1",
              [cancelInfo.photographer_user_id]
            );
            const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
              "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
              [cancelInfo.photographer_user_id]
            );
            if (photographerPhone?.phone && smsPrefs?.sms_bookings !== false) {
              sendSMS(
                photographerPhone.phone,
                `Photo Portugal: Booking with ${cancellerName} has been cancelled by the ${cancelledBy}. Log in to view: https://photoportugal.com/dashboard/bookings`
              ).catch(err => console.error("[sms] cancellation error:", err));
            }
          } catch (smsErr) {
            console.error("[bookings] cancellation sms error:", smsErr);
          }

          // Push to the OTHER party (the one who didn't cancel).
          {
            const recipientId = isClient
              ? cancelInfo.photographer_user_id
              : cancelInfo.client_user_id;
            if (recipientId) {
              import("@/lib/push").then(m =>
                m.sendPushNotification(
                  recipientId,
                  "Booking cancelled",
                  `${cancellerName} cancelled the booking.`,
                  { type: "booking", bookingId: id }
                )
              ).catch(err => console.error("[bookings] unpaid cancel push error:", err));
            }
          }

          // Telegram to photographer
          import("@/lib/notify-photographer").then(m =>
            m.notifyPhotographerViaTelegram(
              cancelInfo!.photographer_profile_id,
              `❌ Booking cancelled\n\nClient: ${cancelInfo!.client_name}\nCancelled by: ${cancelledBy}\n\nView: https://photoportugal.com/dashboard/bookings`
            )
          ).catch((err) => console.error("[bookings] telegram photographer cancel error:", err));
        }
      } catch (emailErr) {
        console.error("[bookings] cancellation email error:", emailErr);
      }
    }

    // Increment session_count when completed + notify about photo delivery
    if (status === "completed") {
      try {
        await queryOne(
          "UPDATE photographer_profiles SET session_count = session_count + 1 WHERE id = (SELECT photographer_id FROM bookings WHERE id = $1)",
          [id]
        );
      } catch {}

      // Notify photographer: session confirmed, upload photos when ready
      try {
        const completedInfo = await queryOne<{
          photographer_email: string; photographer_name: string;
          client_name: string; photographer_profile_id: string;
        }>(
          `SELECT pu.email as photographer_email, pu.name as photographer_name,
                  cu.name as client_name, pp.id as photographer_profile_id
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`,
          [id]
        );
        if (completedInfo) {
          const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";
          const firstName = completedInfo.photographer_name.split(" ")[0];
          const { sendEmail, emailLayout, emailButton } = await import("@/lib/email");
          await sendEmail(
            completedInfo.photographer_email,
            `Session confirmed! Upload photos when ready`,
            emailLayout(`
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#16A34A;">Session Confirmed</h2>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Great! The session with <strong>${completedInfo.client_name}</strong> has been marked as completed.</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">When your photos are ready, you can upload them directly in the booking. ${completedInfo.client_name} will be notified automatically and can review them right away.</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#9B8E82;">No rush — take your time to edit. We'll send you a reminder if the delivery deadline is approaching.</p>
              ${emailButton(`${baseUrl}/dashboard/bookings`, "Go to Bookings")}
            `)
          );

          import("@/lib/notify-photographer").then(({ notifyPhotographerViaTelegram }) => {
            notifyPhotographerViaTelegram(
              completedInfo.photographer_profile_id,
              `Session with ${completedInfo.client_name} confirmed! When your photos are ready, upload them in your dashboard:\n${baseUrl}/dashboard/bookings`
            );
          }).catch(() => {});

          // Notify admin
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`📷 <b>Session Completed!</b>\n\n<b>Photographer:</b> ${completedInfo!.photographer_name}\n<b>Client:</b> ${completedInfo!.client_name}\n\nAwaiting photo delivery.`, "bookings");
          }).catch(() => {});
        }
      } catch (err) {
        console.error("[bookings] session completed notification error:", err);
      }
    }

    // When booking is confirmed, create Stripe checkout and send email with payment link
    if (status === "confirmed") {
      try {
        const bookingDetails = await queryOne<{
          client_email: string; client_name: string; client_id: string;
          photographer_name: string; shoot_date: string | null;
          total_price: number | null; package_name: string | null;
          photographer_stripe_id: string | null; photographer_plan: string;
          stripe_customer_id: string | null;
        }>(
          `SELECT u.email as client_email, u.name as client_name, u.id as client_id,
                  u.stripe_customer_id,
                  pu.name as photographer_name, b.shoot_date, b.total_price,
                  p.name as package_name,
                  pp.stripe_account_id as photographer_stripe_id, pp.plan as photographer_plan
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           LEFT JOIN packages p ON p.id = b.package_id
           WHERE b.id = $1`,
          [id]
        );

        if (bookingDetails) {
          let paymentUrl: string | null = null;
          let clientTotal: number | null = null;

          // Create Stripe Checkout Session if there's a price and photographer has Stripe connected
          if (bookingDetails.total_price && bookingDetails.photographer_stripe_id) {
            try {
              const stripeClient = requireStripe();
              const payment = calculatePayment(bookingDetails.total_price, bookingDetails.photographer_plan);
              clientTotal = payment.totalClientPays;

              // Safety check: totalClientPays must be greater than package price
              const stripeAmount = Math.round(payment.totalClientPays * 100);
              const packageAmount = Math.round(bookingDetails.total_price * 100);
              console.log(`[bookings] Payment calc: package=${packageAmount}c, serviceFee=${Math.round(payment.serviceFee * 100)}c, total=${stripeAmount}c, plan=${bookingDetails.photographer_plan}`);
              if (stripeAmount <= packageAmount) {
                console.error(`[bookings] BUG: Stripe amount ${stripeAmount} should be > package ${packageAmount}. Recalculating...`);
                clientTotal = bookingDetails.total_price * 1.10;
              }

              // Get or create Stripe customer
              let customerId = bookingDetails.stripe_customer_id;
              if (!customerId) {
                const customer = await stripeClient.customers.create({
                  email: bookingDetails.client_email,
                  metadata: { user_id: bookingDetails.client_id },
                });
                customerId = customer.id;
                await queryOne("UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id", [customerId, bookingDetails.client_id]);
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const checkoutSession = await (stripeClient.checkout.sessions.create as any)({
                customer: customerId,
                mode: "payment",
                locale: "auto",
                adaptive_pricing: { enabled: true },
                allow_promotion_codes: true,
                line_items: [{
                  price_data: {
                    currency: "eur",
                    product_data: {
                      name: `${bookingDetails.package_name || "Photoshoot"} with ${bookingDetails.photographer_name}`,
                      description: "Photo Portugal photoshoot session",
                    },
                    unit_amount: Math.round(clientTotal! * 100),
                  },
                  quantity: 1,
                }],
                payment_intent_data: {
                  metadata: {
                    booking_id: id,
                    photographer_name: bookingDetails.photographer_name,
                    package_name: bookingDetails.package_name || "Custom",
                  },
                },
                success_url: `${BASE_URL}/dashboard/bookings?payment=success&booking=${id}`,
                cancel_url: `${BASE_URL}/dashboard/bookings?payment=cancelled`,
                metadata: {
                  booking_id: id,
                  type: "booking",
                },
              }, { idempotencyKey: `checkout_${id}` });

              paymentUrl = checkoutSession.url;

              // Save payment URL and fee breakdown
              await queryOne(
                `UPDATE bookings SET payment_url = $1, service_fee = $2, platform_fee = $3, payout_amount = $4 WHERE id = $5 RETURNING id`,
                [paymentUrl, payment.serviceFee, payment.platformFee, payment.photographerPayout, id]
              );
            } catch (stripeErr) {
              console.error("[bookings] stripe checkout error:", stripeErr);
            }
          }

          // SMS to client about confirmation
          try {
            const clientPhone = await queryOne<{ phone: string | null }>(
              "SELECT phone FROM users WHERE id = $1",
              [bookingDetails.client_id]
            );
            if (clientPhone?.phone) {
              const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
                "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                [bookingDetails.client_id]
              );
              if (smsPrefs?.sms_bookings !== false) {
                const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
                const cLocale = await getUserLocaleById(bookingDetails.client_id);
                const smsBody = pickT({
                  en: `Photo Portugal: ${bookingDetails.photographer_name} confirmed your booking! Check your dashboard for payment details.`,
                  pt: `Photo Portugal: ${bookingDetails.photographer_name} confirmou a sua reserva! Veja o seu painel para os detalhes de pagamento.`,
                  de: `Photo Portugal: ${bookingDetails.photographer_name} hat Ihre Buchung bestätigt! Zahlungsdetails finden Sie in Ihrem Dashboard.`,
                  fr: `Photo Portugal : ${bookingDetails.photographer_name} a confirmé votre réservation ! Détails de paiement sur votre tableau de bord.`,
                }, cLocale);
                sendSMS(
                  clientPhone.phone,
                  smsBody
                ).catch(err => console.error("[sms] error:", err));
              }
            }
          } catch (smsErr) {
            console.error("[bookings] confirmation sms error:", smsErr);
          }

          // Push to client — booking accepted, includes payment CTA
          import("@/lib/push").then(m =>
            m.sendPushNotification(
              bookingDetails.client_id,
              "Booking confirmed!",
              `${bookingDetails.photographer_name} confirmed your session. Tap to pay.`,
              { type: "booking", bookingId: id }
            )
          ).catch(err => console.error("[bookings] confirm push error:", err));

          // Send confirmation email with payment link (show fee-inclusive total)
          sendBookingConfirmationWithPayment(
            bookingDetails.client_email,
            bookingDetails.client_name,
            bookingDetails.photographer_name,
            bookingDetails.shoot_date,
            paymentUrl,
            clientTotal ?? Number(bookingDetails.total_price)
          );

          // Notify admins
          sendAdminBookingConfirmedNotification(
            bookingDetails.client_name,
            bookingDetails.photographer_name,
            bookingDetails.shoot_date,
            bookingDetails.total_price,
            bookingDetails.package_name
          ).catch(err => console.error("[bookings] admin confirmed notification error:", err));
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`✅ <b>Booking Confirmed!</b>\n\n${bookingDetails!.client_name} → ${bookingDetails!.photographer_name}\n${bookingDetails!.package_name || ""}\n€${Math.round(bookingDetails!.total_price || 0)}`, "bookings");
          }).catch((err) => console.error("[bookings] telegram confirmation error:", err));
        }
      } catch (emailErr) {
        console.error("[bookings] confirmation email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[bookings] update error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings/:id", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
