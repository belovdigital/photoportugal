import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { requireStripe, calculatePayment } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;

  try {
    const { booking_id, locale } = await req.json();
    const localePrefix = locale && locale !== "en" && ["pt","de","es","fr"].includes(locale) ? `/${locale}` : "";

    if (!booking_id) return NextResponse.json({ error: "Booking ID required" }, { status: 400 });

    // Get booking with photographer info
    const booking = await queryOne<{
      id: string;
      client_id: string;
      total_price: number;
      status: string;
      payment_status: string;
      photographer_stripe_id: string | null;
      photographer_plan: string;
      photographer_name: string;
      package_name: string | null;
    }>(
      `SELECT b.id, b.client_id, b.total_price, b.status, b.payment_status,
              pp.stripe_account_id as photographer_stripe_id, pp.plan as photographer_plan,
              pu.name as photographer_name,
              p.name as package_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.id = $1`,
      [booking_id]
    );

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.client_id !== userId) return NextResponse.json({ error: "Not your booking" }, { status: 403 });
    if (booking.status !== "confirmed") return NextResponse.json({ error: "Booking must be confirmed to pay" }, { status: 400 });
    if (booking.payment_status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

    if (!booking.photographer_stripe_id) {
      return NextResponse.json({ error: "Photographer has not set up payments yet" }, { status: 400 });
    }

    if (!booking.total_price) {
      return NextResponse.json({ error: "No price set for this booking" }, { status: 400 });
    }

    // Calculate payment split
    const payment = calculatePayment(booking.total_price, booking.photographer_plan);

    // Safety log and verify service fee is included
    const stripeAmount = Math.round(payment.totalClientPays * 100);
    const packageAmount = Math.round(booking.total_price * 100);
    console.log(`[stripe/checkout] Payment calc: package=${packageAmount}c, serviceFee=${Math.round(payment.serviceFee * 100)}c, total=${stripeAmount}c, plan=${booking.photographer_plan}`);
    if (stripeAmount <= packageAmount) {
      console.error(`[stripe/checkout] BUG: Stripe amount ${stripeAmount} should be > package ${packageAmount}. Force-fixing.`);
      payment.totalClientPays = booking.total_price * 1.10;
      payment.serviceFee = Math.round(booking.total_price * 0.10 * 100) / 100;
    }

    // Get or create Stripe customer for the client
    const user = await queryOne<{ email: string; stripe_customer_id: string | null }>(
      "SELECT email, stripe_customer_id FROM users WHERE id = $1", [userId]
    );
    let customerId = user?.stripe_customer_id;
    if (!customerId && user) {
      const customer = await requireStripe().customers.create({
        email: user.email,
        metadata: { user_id: userId! },
      });
      customerId = customer.id;
      await queryOne("UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id", [customerId, userId]);
    }

    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

    // Create Stripe Checkout Session — payment collected on platform, transferred to photographer on delivery acceptance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSessionParams: any = {
      customer: customerId,
      mode: "payment",
      locale: ["pt","de","es","fr"].includes(locale) ? locale : "auto",
      adaptive_pricing: { enabled: true },
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `${booking.package_name || "Photoshoot"} with ${booking.photographer_name}`,
            description: "Photo Portugal photoshoot session",
          },
          unit_amount: Math.round(payment.totalClientPays * 100), // Total in cents (package + service fee)
        },
        quantity: 1,
      }],
      payment_intent_data: {
        metadata: {
          booking_id: booking.id,
          photographer_name: booking.photographer_name,
          package_name: booking.package_name || "Custom",
        },
      },
      success_url: `${BASE_URL}${localePrefix}/dashboard/bookings?payment=success&booking=${booking.id}`,
      cancel_url: `${BASE_URL}${localePrefix}/dashboard/bookings?payment=cancelled`,
      metadata: {
        booking_id: booking.id,
        type: "booking",
      },
    };

    const idempotencyKey = `checkout_${booking.id}`;

    let checkoutSession;
    try {
      checkoutSession = await requireStripe().checkout.sessions.create(stripeSessionParams, { idempotencyKey });
    } catch (stripeError) {
      console.warn("[stripe/checkout] first attempt failed, retrying in 1s:", stripeError);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        checkoutSession = await requireStripe().checkout.sessions.create(stripeSessionParams, { idempotencyKey });
      } catch (retryError) {
        console.error("[stripe/checkout] retry also failed:", retryError);
        return NextResponse.json(
          { error: "Payment service temporarily unavailable. Please try again in a moment." },
          { status: 503 }
        );
      }
    }

    // Save fee breakdown
    await queryOne(
      `UPDATE bookings SET service_fee = $1, platform_fee = $2, payout_amount = $3 WHERE id = $4 RETURNING id`,
      [payment.serviceFee, payment.platformFee, payment.photographerPayout, booking.id]
    );

    return NextResponse.json({ url: checkoutSession.url, payment });
  } catch (error) {
    console.error("[stripe/checkout] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/stripe/checkout", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
