import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireStripe } from "@/lib/stripe";
import { queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendEmail, getAdminEmail, sendSubscriptionEmail, sendPaymentReceivedToPhotographer, sendPaymentConfirmedToClient, sendPaymentFailedToClient } from "@/lib/email";
import { sendSMS, sendAdminSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const stripeClient = requireStripe();

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object;
        const bookingId = checkoutSession.metadata?.booking_id;
        const checkoutType = checkoutSession.metadata?.type;

        if (checkoutType === "verified") {
          // Verified badge payment completed — activate badge
          const photographerId = checkoutSession.metadata?.photographer_id;
          if (photographerId) {
            await queryOne(
              "UPDATE photographer_profiles SET is_verified = TRUE WHERE id = $1 RETURNING id",
              [photographerId]
            );
            console.log(`[webhook] Verified badge activated for photographer ${photographerId}`);
          }
        } else if ((checkoutType === "booking" || bookingId) && checkoutSession.payment_intent) {
          // Booking payment completed
          await queryOne(
            `UPDATE bookings SET stripe_payment_intent_id = $1, payment_status = 'paid'
             WHERE id = $2 RETURNING id`,
            [checkoutSession.payment_intent, bookingId]
          );
          console.log(`[webhook] Checkout completed for booking ${bookingId}, PI: ${checkoutSession.payment_intent}`);

          // Add system message to chat
          try {
            const bookingForMsg = await queryOne<{ client_id: string; client_name: string; client_phone: string | null; total_price: number }>(
              `SELECT b.client_id, cu.name as client_name, cu.phone as client_phone, b.total_price
               FROM bookings b JOIN users cu ON cu.id = b.client_id WHERE b.id = $1`,
              [bookingId]
            );
            if (bookingForMsg) {
              const firstName = bookingForMsg.client_name?.split(" ")[0] || "Client";
              const phoneNote = bookingForMsg.client_phone ? `\n\nClient phone: ${bookingForMsg.client_phone}` : "";
              await queryOne(
                `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE) RETURNING id`,
                [bookingId, bookingForMsg.client_id,
                  `✅ Payment of €${Number(bookingForMsg.total_price)} received from ${firstName}.${phoneNote}`]
              );
            }
          } catch (msgErr) {
            console.error("[webhook] system message error:", msgErr);
          }

          // Upload "Payment Completed" offline conversion to Google Ads
          try {
            const gclidBooking = await queryOne<{ gclid: string | null; total_price: number; client_email: string | null; client_phone: string | null }>(
              `SELECT b.gclid, b.total_price, u.email as client_email, u.phone as client_phone
               FROM bookings b JOIN users u ON u.id = b.client_id WHERE b.id = $1`,
              [bookingId]
            );
            if (gclidBooking?.gclid) {
              import("@/lib/google-ads-conversions").then(({ uploadPaymentCompletedConversion }) => {
                uploadPaymentCompletedConversion(gclidBooking.gclid!, Number(gclidBooking.total_price || 0), {
                  email: gclidBooking.client_email,
                  phone: gclidBooking.client_phone,
                });
              }).catch((err) => console.error("[webhook] gads conversion upload error:", err));
            }
          } catch (gadsErr) {
            console.error("[webhook] gads conversion lookup error:", gadsErr);
          }

          // Send payment notification emails
          try {
            const bookingInfo = await queryOne<{
              client_email: string; client_name: string; client_phone: string | null;
              photographer_email: string; photographer_name: string;
              total_price: number;
            }>(
              `SELECT cu.email as client_email, cu.name as client_name, cu.phone as client_phone,
                      pu.email as photographer_email, pu.name as photographer_name,
                      b.total_price
               FROM bookings b
               JOIN users cu ON cu.id = b.client_id
               JOIN photographer_profiles pp ON pp.id = b.photographer_id
               JOIN users pu ON pu.id = pp.user_id
               WHERE b.id = $1`,
              [bookingId]
            );
            if (bookingInfo) {
              sendPaymentReceivedToPhotographer(
                bookingInfo.photographer_email,
                bookingInfo.photographer_name,
                bookingInfo.client_name,
                bookingId!,
                bookingInfo.total_price,
                bookingInfo.client_phone
              );
              sendPaymentConfirmedToClient(
                bookingInfo.client_email,
                bookingInfo.client_name,
                bookingInfo.photographer_name,
                bookingInfo.total_price
              );
              // Admin notification
              try {
                const adminEmail = await getAdminEmail();
                const adminEmails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
                for (const email of adminEmails) {
                  sendEmail(
                    email,
                    `Payment received — €${Number(bookingInfo.total_price)} from ${bookingInfo.client_name}`,
                    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #16a34a;">Payment Received</h2>
                      <p><strong>${bookingInfo.client_name}</strong> paid <strong>€${Number(bookingInfo.total_price)}</strong> for a booking with <strong>${bookingInfo.photographer_name}</strong>.</p>
                      <p><a href="https://photoportugal.com/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View in Admin</a></p>
                    </div>`
                  );
                }
              } catch {}

              // WhatsApp/SMS to all admin phones
              sendAdminSMS(
                `Photo Portugal: €${Number(bookingInfo.total_price)} payment received! ${bookingInfo.client_name} → ${bookingInfo.photographer_name}`
              );
              import("@/lib/telegram").then(({ sendTelegram }) => {
                sendTelegram(`💰 <b>Payment Received!</b>\n\n<b>Amount:</b> €${Number(bookingInfo!.total_price)}\n<b>Client:</b> ${bookingInfo!.client_name}\n<b>Photographer:</b> ${bookingInfo!.photographer_name}`, "bookings");
              }).catch((err) => console.error("[webhook] telegram payment error:", err));

              // WhatsApp/SMS to photographer
              try {
                const photographerUser = await queryOne<{ phone: string | null; id: string }>(
                  `SELECT u.phone, u.id FROM users u
                   JOIN photographer_profiles pp ON pp.user_id = u.id
                   JOIN bookings b ON b.photographer_id = pp.id
                   WHERE b.id = $1`,
                  [bookingId]
                );
                if (photographerUser?.phone) {
                  const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
                    "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                    [photographerUser.id]
                  );
                  if (smsPrefs?.sms_bookings !== false) {
                    sendSMS(
                      photographerUser.phone,
                      `Photo Portugal: Payment of €${Number(bookingInfo.total_price)} received for your booking with ${bookingInfo.client_name}. Log in to view details.`
                    ).catch(err => console.error("[sms] error:", err));
                  }
                }
              } catch (smsErr) {
                console.error("[webhook] payment whatsapp/sms error:", smsErr);
              }

              // Telegram notification to photographer
              try {
                const photographerProfileId = await queryOne<{ photographer_id: string }>(
                  "SELECT photographer_id FROM bookings WHERE id = $1", [bookingId]
                );
                if (photographerProfileId) {
                  const clientFirst = bookingInfo.client_name.split(" ")[0];
                  import("@/lib/notify-photographer").then(m =>
                    m.notifyPhotographerViaTelegram(
                      photographerProfileId.photographer_id,
                      `Payment received from ${clientFirst}!\n\nAmount: \u20ac${Number(bookingInfo.total_price)}\n\nView: https://photoportugal.com/dashboard/bookings`
                    )
                  ).catch((err) => console.error("[webhook] telegram photographer payment error:", err));
                }
              } catch (tgErr) {
                console.error("[webhook] photographer telegram error:", tgErr);
              }
            }
          } catch (emailErr) {
            console.error("[webhook] payment email error:", emailErr);
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.booking_id;

        if (bookingId) {
          // Update by booking_id (payment intent may or may not be pre-linked)
          await queryOne(
            "UPDATE bookings SET payment_status = 'paid', stripe_payment_intent_id = $1 WHERE id = $2 RETURNING id",
            [paymentIntent.id, bookingId]
          );
          console.log(`[webhook] Payment succeeded for booking ${bookingId}`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.booking_id;

        if (bookingId) {
          await queryOne(
            "UPDATE bookings SET payment_status = 'failed' WHERE id = $1 RETURNING id",
            [bookingId]
          );
          console.log(`[webhook] Payment failed for booking ${bookingId}`);

          // Notify client about failed payment
          try {
            const failedBooking = await queryOne<{ client_email: string; client_name: string; photographer_name: string }>(
              `SELECT cu.email as client_email, cu.name as client_name, pu.name as photographer_name
               FROM bookings b JOIN users cu ON cu.id = b.client_id
               JOIN photographer_profiles pp ON pp.id = b.photographer_id
               JOIN users pu ON pu.id = pp.user_id
               WHERE b.id = $1`, [bookingId]
            );
            if (failedBooking) {
              sendPaymentFailedToClient(failedBooking.client_email, failedBooking.client_name, failedBooking.photographer_name)
                .catch(err => console.error("[webhook] payment failed email error:", err));
            }
          } catch (err) {
            console.error("[webhook] payment failed notification error:", err);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const photographerId = subscription.metadata?.photographer_id;
        const subType = subscription.metadata?.type;

        if (photographerId && subType === "featured") {
          // Featured add-on subscription
          const isFeatured = subscription.status === "active";
          await queryOne(
            "UPDATE photographer_profiles SET is_featured = $1 WHERE id = $2 RETURNING id",
            [isFeatured, photographerId]
          );
          console.log(`[webhook] Featured subscription ${subscription.status} for photographer ${photographerId} → is_featured=${isFeatured}`);
        } else if (photographerId && subscription.metadata?.plan) {
          // Plan subscription
          const plan = subscription.metadata.plan;
          const newPlan = subscription.status === "active" ? plan : "free";
          // On downgrade from premium: revert custom slug to default
          if (newPlan === "free") {
            const currentProfile = await queryOne<{ slug: string; user_id: string }>(
              "SELECT slug, user_id FROM photographer_profiles WHERE id = $1", [photographerId]
            );
            if (currentProfile && !currentProfile.slug.startsWith("p-")) {
              const defaultSlug = `p-${currentProfile.user_id.replace(/-/g, "").slice(0, 10)}`;
              await queryOne(
                "INSERT INTO slug_redirects (old_slug, photographer_id) VALUES ($1, $2) ON CONFLICT (old_slug) DO NOTHING",
                [currentProfile.slug, photographerId]
              );
              await queryOne(
                "UPDATE photographer_profiles SET slug = $1 WHERE id = $2 RETURNING id",
                [defaultSlug, photographerId]
              );
            }
          }
          await queryOne(
            "UPDATE photographer_profiles SET plan = $1 WHERE id = $2 RETURNING id",
            [newPlan, photographerId]
          );
          console.log(`[webhook] Subscription ${subscription.status} for photographer ${photographerId} → ${newPlan}`);
          try {
            const info = await queryOne<{ email: string; name: string }>(
              "SELECT u.email, u.name FROM users u JOIN photographer_profiles pp ON pp.user_id = u.id WHERE pp.id = $1", [photographerId]
            );
            if (info) sendSubscriptionEmail(info.email, info.name, newPlan, newPlan === "free" ? "downgraded" : "upgraded");
          } catch {}
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const photographerId = subscription.metadata?.photographer_id;
        const subType = subscription.metadata?.type;

        if (photographerId && subType === "featured") {
          // Featured add-on cancelled
          await queryOne("UPDATE photographer_profiles SET is_featured = FALSE WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Featured subscription cancelled for photographer ${photographerId}`);
        } else if (photographerId && subType === "verified") {
          // Verified badge subscription cancelled
          await queryOne("UPDATE photographer_profiles SET is_verified = FALSE WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Verified subscription cancelled for photographer ${photographerId}`);
        } else if (photographerId) {
          // Plan subscription cancelled — revert custom slug
          const cancelledProfile = await queryOne<{ slug: string; user_id: string }>(
            "SELECT slug, user_id FROM photographer_profiles WHERE id = $1", [photographerId]
          );
          if (cancelledProfile && !cancelledProfile.slug.startsWith("p-")) {
            const defaultSlug = `p-${cancelledProfile.user_id.replace(/-/g, "").slice(0, 10)}`;
            await queryOne(
              "INSERT INTO slug_redirects (old_slug, photographer_id) VALUES ($1, $2) ON CONFLICT (old_slug) DO NOTHING",
              [cancelledProfile.slug, photographerId]
            );
            await queryOne("UPDATE photographer_profiles SET slug = $1 WHERE id = $2", [defaultSlug, photographerId]);
          }
          await queryOne("UPDATE photographer_profiles SET plan = 'free' WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Subscription cancelled for photographer ${photographerId} → free`);
          try {
            const info = await queryOne<{ email: string; name: string }>(
              "SELECT u.email, u.name FROM users u JOIN photographer_profiles pp ON pp.user_id = u.id WHERE pp.id = $1", [photographerId]
            );
            if (info) sendSubscriptionEmail(info.email, info.name, "Free", "cancelled");
          } catch {}
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        if (account.charges_enabled && account.payouts_enabled) {
          await queryOne(
            "UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE WHERE stripe_account_id = $1 RETURNING id",
            [account.id]
          );
          console.log(`[webhook] Stripe account ${account.id} onboarding complete`);
        }
        break;
      }
    }
  } catch (error) {
    console.error("[stripe/webhook] Error processing event:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/stripe/webhook", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  // Revalidate public pages after any subscription/payment change
  revalidatePath("/");
  revalidatePath("/photographers");

  return NextResponse.json({ received: true });
}
