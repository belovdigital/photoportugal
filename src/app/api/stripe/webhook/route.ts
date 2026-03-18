import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireStripe } from "@/lib/stripe";
import { queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendSubscriptionEmail } from "@/lib/email";

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
        } else if (bookingId && checkoutSession.payment_intent) {
          // Booking payment completed
          await queryOne(
            `UPDATE bookings SET stripe_payment_intent_id = $1, payment_status = 'paid'
             WHERE id = $2 RETURNING id`,
            [checkoutSession.payment_intent, bookingId]
          );
          console.log(`[webhook] Checkout completed for booking ${bookingId}, PI: ${checkoutSession.payment_intent}`);
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
        } else if (photographerId) {
          // Plan subscription cancelled
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
  }

  // Revalidate public pages after any subscription/payment change
  revalidatePath("/");
  revalidatePath("/photographers");

  return NextResponse.json({ received: true });
}
