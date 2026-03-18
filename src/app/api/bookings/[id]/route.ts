import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { sendBookingConfirmationWithPayment } from "@/lib/email";
import { requireStripe, calculatePayment } from "@/lib/stripe";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as { id?: string }).id;
  const { status } = await req.json();

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

    // Validate status transitions
    const currentBooking = await queryOne<{ status: string }>("SELECT status FROM bookings WHERE id = $1", [id]);
    const validTransitions: Record<string, string[]> = {
      inquiry: ["pending", "cancelled"],
      pending: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled"],
      completed: ["delivered"],
    };
    if (currentBooking && !validTransitions[currentBooking.status]?.includes(status)) {
      return NextResponse.json({ error: `Cannot change from ${currentBooking.status} to ${status}` }, { status: 400 });
    }

    await queryOne("UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id", [status, id]);

    // Increment session_count when completed
    if (status === "completed") {
      try {
        await queryOne(
          "UPDATE photographer_profiles SET session_count = session_count + 1 WHERE id = (SELECT photographer_id FROM bookings WHERE id = $1)",
          [id]
        );
      } catch {}
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
                  pp.display_name as photographer_name, b.shoot_date, b.total_price,
                  p.name as package_name,
                  pp.stripe_account_id as photographer_stripe_id, pp.plan as photographer_plan
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           LEFT JOIN packages p ON p.id = b.package_id
           WHERE b.id = $1`,
          [id]
        );

        if (bookingDetails) {
          let paymentUrl: string | null = null;

          // Create Stripe Checkout Session if there's a price and photographer has Stripe connected
          if (bookingDetails.total_price && bookingDetails.photographer_stripe_id) {
            try {
              const stripeClient = requireStripe();
              const payment = calculatePayment(bookingDetails.total_price, bookingDetails.photographer_plan);

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

              const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const checkoutSession = await (stripeClient.checkout.sessions.create as any)({
                customer: customerId,
                mode: "payment",
                locale: "auto",
                adaptive_pricing: { enabled: true },
                line_items: [{
                  price_data: {
                    currency: "eur",
                    product_data: {
                      name: `${bookingDetails.package_name || "Photoshoot"} with ${bookingDetails.photographer_name}`,
                      description: "Photo Portugal photoshoot session",
                    },
                    unit_amount: Math.round(payment.totalClientPays * 100),
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
              });

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

          // Send confirmation email with payment link
          sendBookingConfirmationWithPayment(
            bookingDetails.client_email,
            bookingDetails.client_name,
            bookingDetails.photographer_name,
            bookingDetails.shoot_date,
            paymentUrl,
            bookingDetails.total_price
          );
        }
      } catch (emailErr) {
        console.error("[bookings] confirmation email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[bookings] update error:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
