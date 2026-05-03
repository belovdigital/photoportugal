import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireStripe } from "@/lib/stripe";
import { queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendEmail, getAdminEmail, sendSubscriptionEmail, sendPaymentReceivedToPhotographer, sendPaymentConfirmedToClient, sendPaymentFailedToClient } from "@/lib/email";
import { sendSMS, sendAdminSMS } from "@/lib/sms";
import { sendTelegram } from "@/lib/telegram";

// Stripe events we surface in the `stripe` Telegram topic. Anything
// not listed (most notably payment_intent.created — fires on every
// "Pay" button click and is pure noise) gets dropped silently.
const STRIPE_EVENTS_TO_FORWARD = new Set<string>([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "transfer.created",
  "transfer.reversed",
  "transfer.failed",
  "payout.created",
  "payout.paid",
  "payout.failed",
  "account.updated",
  "review.opened",
  "radar.early_fraud_warning.created",
]);

function fmtAmount(amountCents: number | null | undefined, currency?: string | null): string {
  if (typeof amountCents !== "number") return "?";
  const symbol = (currency || "").toLowerCase() === "eur" ? "€" : (currency || "").toUpperCase() + " ";
  return `${symbol}${(amountCents / 100).toFixed(2)}`;
}

function paymentAmountFromStripe(amountCents: number | null | undefined, fallbackEuros: number | null | undefined): number {
  if (typeof amountCents === "number") return amountCents / 100;
  return Number(fallbackEuros || 0);
}

function safeTelegramText(value: unknown): string {
  return String(value ?? "").replace(/[<>]/g, "");
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  account?: string;
  data: { object: Record<string, unknown> };
}

function summariseStripeEvent(event: StripeWebhookEvent): string {
  const obj = (event.data?.object || {}) as Record<string, unknown>;
  const lines: string[] = [];

  // Pick a human-friendly headline emoji per event family.
  const emojiMap: Record<string, string> = {
    "payment_intent.succeeded": "💳",
    "payment_intent.payment_failed": "❌",
    "charge.refunded": "↩️",
    "charge.dispute.created": "⚠️",
    "checkout.session.completed": "🛒",
    "customer.subscription.created": "🆕",
    "customer.subscription.updated": "🔄",
    "customer.subscription.deleted": "🚪",
    "invoice.payment_succeeded": "📄",
    "invoice.payment_failed": "📄❌",
    "transfer.created": "💸",
    "transfer.reversed": "↪️",
    "transfer.failed": "🚫",
    "payout.created": "🏦",
    "payout.paid": "✅",
    "payout.failed": "🚫",
    "account.updated": "👤",
    "review.opened": "🔍",
    "radar.early_fraud_warning.created": "🚨",
  };
  const emoji = emojiMap[event.type] || "📌";
  lines.push(`${emoji} <b>${event.type}</b>`);

  // Event-type-specific detail row.
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const amount = obj.amount as number | undefined;
      const currency = obj.currency as string | undefined;
      const meta = (obj.metadata as Record<string, string>) || {};
      lines.push(`Amount: ${fmtAmount(amount, currency)}`);
      if (meta.booking_id) lines.push(`Booking: ${meta.booking_id.slice(0, 8)}`);
      if (event.type === "payment_intent.payment_failed" && obj.last_payment_error) {
        const err = obj.last_payment_error as { message?: string };
        if (err.message) lines.push(`Reason: ${String(err.message).slice(0, 200)}`);
      }
      break;
    }
    case "charge.refunded": {
      lines.push(`Amount refunded: ${fmtAmount(obj.amount_refunded as number, obj.currency as string)}`);
      const meta = (obj.metadata as Record<string, string>) || {};
      if (meta.booking_id) lines.push(`Booking: ${meta.booking_id.slice(0, 8)}`);
      break;
    }
    case "charge.dispute.created": {
      lines.push(`Disputed: ${fmtAmount(obj.amount as number, obj.currency as string)}`);
      if (obj.reason) lines.push(`Reason: ${String(obj.reason)}`);
      lines.push(`⚠️ Respond before evidence due date in Stripe dashboard.`);
      break;
    }
    case "checkout.session.completed": {
      const meta = (obj.metadata as Record<string, string>) || {};
      const mode = obj.mode as string | undefined;
      lines.push(`Mode: ${mode || "?"}`);
      lines.push(`Total: ${fmtAmount(obj.amount_total as number, obj.currency as string)}`);
      if (meta.type) lines.push(`Type: ${meta.type}`);
      if (meta.booking_id) lines.push(`Booking: ${meta.booking_id.slice(0, 8)}`);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const items = (obj.items as { data?: Array<{ price?: { id?: string; nickname?: string } }> } | undefined)?.data || [];
      const status = obj.status as string | undefined;
      lines.push(`Status: ${status || "?"}`);
      const priceLabels = items
        .map((it) => it.price?.nickname || it.price?.id)
        .filter(Boolean);
      if (priceLabels.length) lines.push(`Products: ${priceLabels.join(", ")}`);
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      lines.push(`Amount: ${fmtAmount(obj.amount_due as number, obj.currency as string)}`);
      if (obj.billing_reason) lines.push(`Reason: ${String(obj.billing_reason)}`);
      break;
    }
    case "transfer.created":
    case "transfer.reversed":
    case "transfer.failed": {
      const meta = (obj.metadata as Record<string, string>) || {};
      lines.push(`Amount: ${fmtAmount(obj.amount as number, obj.currency as string)}`);
      lines.push(`Destination: ${String(obj.destination || "?")}`);
      if (meta.booking_id) lines.push(`Booking: ${meta.booking_id.slice(0, 8)}`);
      if (meta.type) lines.push(`Type: ${meta.type}`);
      break;
    }
    case "payout.created":
    case "payout.paid":
    case "payout.failed": {
      lines.push(`Amount: ${fmtAmount(obj.amount as number, obj.currency as string)}`);
      lines.push(`Method: ${String(obj.method || "?")}`);
      if (event.account) lines.push(`Connect acct: ${event.account}`);
      if (event.type === "payout.failed" && obj.failure_message) {
        lines.push(`Reason: ${String(obj.failure_message).slice(0, 200)}`);
      }
      break;
    }
    case "account.updated": {
      const charges = obj.charges_enabled as boolean | undefined;
      const payouts = obj.payouts_enabled as boolean | undefined;
      const submitted = obj.details_submitted as boolean | undefined;
      const requirements = obj.requirements as { disabled_reason?: string | null; currently_due?: string[] } | undefined;
      lines.push(`Acct: ${event.account || obj.id || "?"}`);
      lines.push(`details_submitted: ${submitted}, charges: ${charges}, payouts: ${payouts}`);
      if (requirements?.disabled_reason) lines.push(`Disabled: ${requirements.disabled_reason}`);
      if (requirements?.currently_due?.length) {
        lines.push(`Pending: ${requirements.currently_due.slice(0, 5).join(", ")}${requirements.currently_due.length > 5 ? "…" : ""}`);
      }
      break;
    }
    case "review.opened": {
      lines.push(`Reason: ${String(obj.reason || "?")}`);
      if (obj.charge) lines.push(`Charge: ${String(obj.charge)}`);
      break;
    }
    case "radar.early_fraud_warning.created": {
      lines.push(`Type: ${String(obj.fraud_type || "?")}`);
      if (obj.charge) lines.push(`Charge: ${String(obj.charge)}`);
      lines.push(`⚠️ Bank flagged a charge as likely fraudulent. Refund or contest.`);
      break;
    }
  }

  // Footer with id + Stripe dashboard deeplink for one-tap inspection.
  if (event.id) lines.push(`Event: ${event.id}`);
  return lines.join("\n");
}

async function forwardStripeEventToTelegram(event: StripeWebhookEvent): Promise<void> {
  if (!STRIPE_EVENTS_TO_FORWARD.has(event.type)) return;
  const summary = summariseStripeEvent(event);
  await sendTelegram(summary, "stripe");
}

async function notifyAdminSubscriptionEvent(
  photographerId: string,
  emoji: string,
  title: string,
  detail: string,
) {
  try {
    const info = await queryOne<{ name: string; email: string; slug: string }>(
      `SELECT u.name, u.email, pp.slug FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
      [photographerId]
    );
    if (!info) return;
    const safeName = String(info.name || "").replace(/[<>]/g, "");
    const safeEmail = String(info.email || "").replace(/[<>]/g, "");
    const safeDetail = detail.replace(/[<>]/g, "");
    await sendTelegram(
      `${emoji} <b>${title}</b>\n\nName: ${safeName}\nEmail: ${safeEmail}\n${safeDetail}\n\n👉 <a href="https://photoportugal.com/admin#${info.slug}">View in Admin</a>`,
      "photographers"
    );
  } catch (e) {
    console.error("[webhook] telegram subscription notify failed:", e);
  }
}

async function getCheckoutPaymentSummary(
  checkoutSession: Record<string, unknown>,
): Promise<{
  amountDiscount: number;
  amountSubtotal: number | null;
  amountTotal: number | null;
  currency: string | null;
  code: string | null;
  couponName: string | null;
  percentOff: number | null;
}> {
  const amountDiscount = (checkoutSession.total_details as { amount_discount?: number } | null | undefined)?.amount_discount || 0;
  let expandedSession = checkoutSession;
  const sessionId = typeof checkoutSession.id === "string" ? checkoutSession.id : null;

  if (amountDiscount > 0 && sessionId) {
    try {
      expandedSession = await requireStripe().checkout.sessions.retrieve(sessionId, {
        expand: ["discounts", "discounts.promotion_code", "discounts.coupon"],
      } as never) as unknown as Record<string, unknown>;
    } catch (err) {
      console.error("[webhook] checkout discount expand failed:", err);
    }
  }

  const discounts = Array.isArray(expandedSession.discounts) ? expandedSession.discounts : [];
  const firstDiscount = discounts[0] as Record<string, unknown> | undefined;
  const promotionCode = firstDiscount?.promotion_code && typeof firstDiscount.promotion_code === "object"
    ? firstDiscount.promotion_code as Record<string, unknown>
    : null;
  const coupon = firstDiscount?.coupon && typeof firstDiscount.coupon === "object"
    ? firstDiscount.coupon as Record<string, unknown>
    : null;

  return {
    amountDiscount,
    amountSubtotal: typeof expandedSession.amount_subtotal === "number" ? expandedSession.amount_subtotal : null,
    amountTotal: typeof expandedSession.amount_total === "number" ? expandedSession.amount_total : null,
    currency: typeof expandedSession.currency === "string" ? expandedSession.currency : null,
    code: typeof promotionCode?.code === "string" ? promotionCode.code : null,
    couponName: typeof coupon?.name === "string" ? coupon.name : null,
    percentOff: typeof coupon?.percent_off === "number" ? coupon.percent_off : null,
  };
}

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

  // ── Stripe activity firehose ───────────────────────────────────
  // Forward a one-line summary of every event we care about into the
  // dedicated `stripe` Telegram topic. Independent of the business
  // logic below — runs first, fire-and-forget so a Telegram outage
  // can't break payment processing.
  forwardStripeEventToTelegram(event as unknown as StripeWebhookEvent).catch((e) =>
    console.error("[webhook] stripe firehose telegram failed:", e)
  );

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
          const paymentSummary = await getCheckoutPaymentSummary(checkoutSession as unknown as Record<string, unknown>);
          const paidAmountLabel = typeof paymentSummary.amountTotal === "number"
            ? fmtAmount(paymentSummary.amountTotal, paymentSummary.currency)
            : null;
          await queryOne(
            `UPDATE bookings SET stripe_payment_intent_id = $1, payment_status = 'paid'
             WHERE id = $2 RETURNING id`,
            [checkoutSession.payment_intent, bookingId]
          );
          queryOne(
            `UPDATE bookings
                SET stripe_amount_subtotal_cents = $1,
                    stripe_amount_paid_cents = $2,
                    stripe_amount_discount_cents = $3,
                    stripe_currency = $4,
                    stripe_promo_code = $5,
                    stripe_coupon_name = $6,
                    stripe_coupon_percent_off = $7
              WHERE id = $8
              RETURNING id`,
            [
              paymentSummary.amountSubtotal,
              paymentSummary.amountTotal,
              paymentSummary.amountDiscount,
              paymentSummary.currency,
              paymentSummary.code,
              paymentSummary.couponName,
              paymentSummary.percentOff,
              bookingId,
            ]
          ).catch((err) => console.error("[webhook] failed to persist Stripe payment details:", err));
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
              const displayAmount = paidAmountLabel || `€${Number(bookingForMsg.total_price)}`;
              await queryOne(
                `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE) RETURNING id`,
                [bookingId, bookingForMsg.client_id,
                  `✅ Payment of ${displayAmount} received from ${firstName}.${phoneNote}`]
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
              const conversionValue = paymentAmountFromStripe(paymentSummary.amountTotal, gclidBooking.total_price);
              import("@/lib/google-ads-conversions").then(({ uploadPaymentCompletedConversion }) => {
                uploadPaymentCompletedConversion(gclidBooking.gclid!, conversionValue, {
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
              const paidAmount = paymentAmountFromStripe(paymentSummary.amountTotal, bookingInfo.total_price);
              const displayPaidAmount = paidAmountLabel || `€${Number(bookingInfo.total_price)}`;
              sendPaymentReceivedToPhotographer(
                bookingInfo.photographer_email,
                bookingInfo.photographer_name,
                bookingInfo.client_name,
                bookingId!,
                paidAmount,
                bookingInfo.client_phone
              );
              sendPaymentConfirmedToClient(
                bookingInfo.client_email,
                bookingInfo.client_name,
                bookingInfo.photographer_name,
                paidAmount
              );
              // Admin notification
              try {
                const adminEmail = await getAdminEmail();
                const adminEmails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
                for (const email of adminEmails) {
                  sendEmail(
                    email,
                    `Payment received — ${displayPaidAmount} from ${bookingInfo.client_name}`,
                    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #16a34a;">Payment Received</h2>
                      <p><strong>${bookingInfo.client_name}</strong> paid <strong>${displayPaidAmount}</strong> for a booking with <strong>${bookingInfo.photographer_name}</strong>.</p>
                      <p><a href="https://photoportugal.com/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View in Admin</a></p>
                    </div>`
                  );
                }
              } catch {}

              // WhatsApp/SMS to all admin phones
              sendAdminSMS(
                `Photo Portugal: ${displayPaidAmount} payment received! ${bookingInfo.client_name} → ${bookingInfo.photographer_name}`
              );
              import("@/lib/telegram").then(({ sendTelegram }) => {
                sendTelegram(`💰 <b>Payment Received!</b>\n\n<b>Amount:</b> ${displayPaidAmount}\n<b>Client:</b> ${bookingInfo!.client_name}\n<b>Photographer:</b> ${bookingInfo!.photographer_name}`, "bookings");
              }).catch((err) => console.error("[webhook] telegram payment error:", err));

              Promise.resolve(paymentSummary).then((discount) => {
                if (discount.amountDiscount <= 0) return;
                const lines = [
                  "🎟 <b>Coupon Used!</b>",
                  "",
                  `<b>Discount:</b> ${fmtAmount(discount.amountDiscount, discount.currency)}`,
                  `<b>Client:</b> ${safeTelegramText(bookingInfo!.client_name)}`,
                  `<b>Photographer:</b> ${safeTelegramText(bookingInfo!.photographer_name)}`,
                ];
                if (discount.code) lines.splice(2, 0, `<b>Code:</b> ${safeTelegramText(discount.code)}`);
                if (discount.percentOff) lines.push(`<b>Percent:</b> ${discount.percentOff}%`);
                if (discount.couponName) lines.push(`<b>Coupon:</b> ${safeTelegramText(discount.couponName)}`);
                if (discount.amountSubtotal !== null) lines.push(`<b>Before discount:</b> ${fmtAmount(discount.amountSubtotal, discount.currency)}`);
                if (discount.amountTotal !== null) lines.push(`<b>Paid in Stripe:</b> ${fmtAmount(discount.amountTotal, discount.currency)}`);
                if (bookingId) lines.push(`<b>Booking:</b> ${safeTelegramText(String(bookingId).slice(0, 8))}`);

                return sendTelegram(lines.join("\n"), "bookings");
              }).catch((err) => console.error("[webhook] telegram coupon payment error:", err));

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
                      `Photo Portugal: Payment of ${displayPaidAmount} received for your booking with ${bookingInfo.client_name}. Log in to view details.`
                    ).catch(err => console.error("[sms] error:", err));
                  }
                }
                // Push to photographer — fires regardless of phone, lets
                // photographers without SMS prefs still hear about money.
                if (photographerUser?.id) {
                  import("@/lib/push").then(m =>
                    m.sendPushNotification(
                      photographerUser.id,
                      "Payment received",
                      `${displayPaidAmount} from ${bookingInfo.client_name}`,
                      { type: "booking", bookingId: bookingId || "" }
                    )
                  ).catch(err => console.error("[webhook] payment push error:", err));
                  import("@/lib/realtime").then((m) =>
                    m.notifyUser(photographerUser.id, "payment_received", { bookingId })
                  );
                }
              } catch (smsErr) {
                console.error("[webhook] payment whatsapp/sms error:", smsErr);
              }

              // Push to client — payment confirmation tap-through to
              // booking detail.
              try {
                const clientUser = await queryOne<{ id: string }>(
                  "SELECT client_id as id FROM bookings WHERE id = $1",
                  [bookingId]
                );
                if (clientUser?.id) {
                  import("@/lib/push").then(m =>
                    m.sendPushNotification(
                      clientUser.id,
                      "Booking confirmed",
                      `Payment received. Your session with ${bookingInfo.photographer_name} is booked!`,
                      { type: "booking", bookingId: bookingId || "" }
                    )
                  ).catch(err => console.error("[webhook] client payment push error:", err));
                  import("@/lib/realtime").then((m) =>
                    m.notifyUser(clientUser.id, "payment_received", { bookingId })
                  );
                }
              } catch {}

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
                      `Payment received from ${clientFirst}!\n\nAmount: ${displayPaidAmount}\n\nView: https://photoportugal.com/dashboard/bookings`
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
        const isCreated = event.type === "customer.subscription.created";

        if (photographerId && subType === "featured") {
          // Featured add-on subscription
          const isFeatured = subscription.status === "active";
          await queryOne(
            "UPDATE photographer_profiles SET is_featured = $1 WHERE id = $2 RETURNING id",
            [isFeatured, photographerId]
          );
          console.log(`[webhook] Featured subscription ${subscription.status} for photographer ${photographerId} → is_featured=${isFeatured}`);
          if (isCreated && isFeatured) {
            await notifyAdminSubscriptionEvent(
              photographerId,
              "⭐",
              "Featured purchased",
              `Plan: Featured (€19/mo recurring)\nStatus: ${subscription.status}`,
            );
          }
        } else if (photographerId && subType === "verified") {
          // Verified badge subscription — was previously only handled via
          // checkout.session.completed, but that branch reads metadata.type
          // off the *checkout session* (which is empty), not subscription_data.
          // So Verified purchases silently failed to flip is_verified.
          const isVerified = subscription.status === "active";
          await queryOne(
            "UPDATE photographer_profiles SET is_verified = $1 WHERE id = $2 RETURNING id",
            [isVerified, photographerId]
          );
          console.log(`[webhook] Verified subscription ${subscription.status} for photographer ${photographerId} → is_verified=${isVerified}`);
          if (isCreated && isVerified) {
            await notifyAdminSubscriptionEvent(
              photographerId,
              "✅",
              "Verified purchased",
              `Plan: Verified (€19/yr recurring)\nStatus: ${subscription.status}`,
            );
          }
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
          if (isCreated && subscription.status === "active") {
            await notifyAdminSubscriptionEvent(
              photographerId,
              "💎",
              `Plan purchased: ${plan}`,
              `Plan: ${plan}\nStatus: ${subscription.status}`,
            );
          }
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
          await notifyAdminSubscriptionEvent(
            photographerId,
            "🚫",
            "Featured cancelled",
            `Plan: Featured`,
          );
        } else if (photographerId && subType === "verified") {
          // Verified badge subscription cancelled
          await queryOne("UPDATE photographer_profiles SET is_verified = FALSE WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Verified subscription cancelled for photographer ${photographerId}`);
          await notifyAdminSubscriptionEvent(
            photographerId,
            "🚫",
            "Verified cancelled",
            `Plan: Verified`,
          );
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
          await notifyAdminSubscriptionEvent(
            photographerId,
            "🚫",
            "Plan cancelled",
            `Reverted to: free`,
          );
        }
        break;
      }

      case "invoice.paid": {
        // Recurring subscription renewal — Stripe sends this on first charge
        // (billing_reason='subscription_create') and on every cycle renewal
        // (billing_reason='subscription_cycle'). We notify only on cycles —
        // first-charge already gets a "purchased" alert via customer.subscription.created.
        const invoice = event.data.object as unknown as {
          billing_reason?: string;
          subscription?: string;
          amount_paid?: number;
          currency?: string;
        };
        if (invoice.billing_reason === "subscription_cycle" && invoice.subscription) {
          try {
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription);
            const photographerId = sub.metadata?.photographer_id;
            const subType = sub.metadata?.type;
            const plan = sub.metadata?.plan;
            if (photographerId) {
              const amount = ((invoice.amount_paid || 0) / 100).toFixed(2);
              const currency = (invoice.currency || "eur").toUpperCase();
              const label = subType === "featured" ? "Featured" : subType === "verified" ? "Verified" : plan ? `Plan: ${plan}` : "Subscription";
              await notifyAdminSubscriptionEvent(
                photographerId,
                "🔄",
                `Renewal charged: ${label}`,
                `Amount: ${amount} ${currency}`,
              );
            }
          } catch (err) {
            console.error("[webhook] invoice.paid notify failed:", err);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        // Renewal payment failed — admin should know so they can chase the
        // photographer before the subscription auto-cancels (Stripe retries 3-4 times).
        const invoice = event.data.object as unknown as {
          billing_reason?: string;
          subscription?: string;
          attempt_count?: number;
          amount_due?: number;
          currency?: string;
        };
        if (invoice.subscription) {
          try {
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription);
            const photographerId = sub.metadata?.photographer_id;
            const subType = sub.metadata?.type;
            const plan = sub.metadata?.plan;
            if (photographerId) {
              const amount = ((invoice.amount_due || 0) / 100).toFixed(2);
              const currency = (invoice.currency || "eur").toUpperCase();
              const label = subType === "featured" ? "Featured" : subType === "verified" ? "Verified" : plan ? `Plan: ${plan}` : "Subscription";
              await notifyAdminSubscriptionEvent(
                photographerId,
                "⚠️",
                `Renewal FAILED: ${label}`,
                `Amount due: ${amount} ${currency}\nAttempt: ${invoice.attempt_count || 1}\nReason: ${invoice.billing_reason || "renewal"}`,
              );
            }
          } catch (err) {
            console.error("[webhook] invoice.payment_failed notify failed:", err);
          }
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
