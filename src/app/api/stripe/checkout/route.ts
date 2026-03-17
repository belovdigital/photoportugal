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
      stripe_payment_intent_id: string | null;
      photographer_stripe_id: string | null;
      photographer_plan: string;
      photographer_name: string;
      package_name: string | null;
    }>(
      `SELECT b.id, b.client_id, b.total_price, b.status, b.stripe_payment_intent_id,
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

    if (!booking.photographer_stripe_id) {
      return NextResponse.json({ error: "Photographer has not set up payments yet" }, { status: 400 });
    }

    if (!booking.total_price) {
      return NextResponse.json({ error: "No price set for this booking" }, { status: 400 });
    }

    // If already has a payment intent, return it
    if (booking.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      if (existing.status !== "canceled") {
        return NextResponse.json({ client_secret: existing.client_secret });
      }
    }

    // Calculate payment split
    const payment = calculatePayment(booking.total_price, booking.photographer_plan);

    // Create payment intent with automatic transfer to photographer
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payment.totalClientPays * 100), // in cents for Stripe
      currency: "eur",
      application_fee_amount: Math.round((payment.serviceFee + payment.platformFee) * 100),
      transfer_data: {
        destination: booking.photographer_stripe_id,
      },
      metadata: {
        booking_id: booking.id,
        photographer_name: booking.photographer_name,
        package_name: booking.package_name || "Custom",
      },
      description: `Photo Portugal — ${booking.package_name || "Photoshoot"} with ${booking.photographer_name}`,
    });

    // Save payment intent ID and fees
    await queryOne(
      `UPDATE bookings SET stripe_payment_intent_id = $1, service_fee = $2, platform_fee = $3, payout_amount = $4, payment_status = 'pending'
       WHERE id = $5 RETURNING id`,
      [paymentIntent.id, payment.serviceFee, payment.platformFee, payment.photographerPayout, booking.id]
    );

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment,
    });
  } catch (error) {
    console.error("[stripe/checkout] error:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
