import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { stripe, calculatePayment } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;

  try {
    const { booking_id } = await req.json();

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
              pp.display_name as photographer_name,
              p.name as package_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
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

    // Get or create Stripe customer for the client
    const user = await queryOne<{ email: string; stripe_customer_id: string | null }>(
      "SELECT email, stripe_customer_id FROM users WHERE id = $1", [userId]
    );
    let customerId = user?.stripe_customer_id;
    if (!customerId && user) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: userId! },
      });
      customerId = customer.id;
      await queryOne("UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id", [customerId, userId]);
    }

    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

    // Create Stripe Checkout Session with automatic_payment_methods
    // This supports: Cards, Apple Pay, Google Pay, Link, bank transfers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkoutSession = await (stripe.checkout.sessions.create as any)({
      customer: customerId,
      mode: "payment",
      locale: "auto",
      adaptive_pricing: { enabled: true },
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
        application_fee_amount: Math.round((payment.serviceFee + payment.platformFee) * 100),
        transfer_data: {
          destination: booking.photographer_stripe_id,
        },
        metadata: {
          booking_id: booking.id,
          photographer_name: booking.photographer_name,
          package_name: booking.package_name || "Custom",
        },
      },
      success_url: `${BASE_URL}/dashboard/bookings?payment=success&booking=${booking.id}`,
      cancel_url: `${BASE_URL}/dashboard/bookings?payment=cancelled`,
      metadata: {
        booking_id: booking.id,
      },
    });

    // Save fee breakdown
    await queryOne(
      `UPDATE bookings SET service_fee = $1, platform_fee = $2, payout_amount = $3 WHERE id = $4 RETURNING id`,
      [payment.serviceFee, payment.platformFee, payment.photographerPayout, booking.id]
    );

    return NextResponse.json({ url: checkoutSession.url, payment });
  } catch (error) {
    console.error("[stripe/checkout] error:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
