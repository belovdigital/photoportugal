import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { stripe } from "@/lib/stripe";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  // For now, verify signature if webhook secret is set
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.booking_id;

        if (bookingId) {
          await queryOne(
            "UPDATE bookings SET payment_status = 'paid' WHERE id = $1 AND stripe_payment_intent_id = $2 RETURNING id",
            [bookingId, paymentIntent.id]
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
            "UPDATE bookings SET payment_status = 'failed' WHERE id = $1 AND stripe_payment_intent_id = $2 RETURNING id",
            [bookingId, paymentIntent.id]
          );
          console.log(`[webhook] Payment failed for booking ${bookingId}`);
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

  return NextResponse.json({ received: true });
}
