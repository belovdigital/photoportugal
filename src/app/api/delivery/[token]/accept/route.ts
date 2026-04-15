import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne, withTransaction } from "@/lib/db";
import { requireStripe, calculatePayment } from "@/lib/stripe";
import { sendDeliveryAcceptedToPhotographer, sendDeliveryAcceptedToClient } from "@/lib/email";
import { sendBookingStatusMessage } from "@/lib/booking-messages";
import crypto from "crypto";

// POST: Accept delivery — verify password, mark accepted, trigger payout
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  // Find the booking by delivery token
  const booking = await queryOne<{
    id: string;
    delivery_password: string;
    delivery_expires_at: string;
    delivery_accepted: boolean;
    payment_status: string;
    stripe_payment_intent_id: string | null;
    total_price: number | null;
    payout_amount: number | null;
    payout_transferred: boolean;
    photographer_stripe_id: string | null;
    photographer_stripe_ready: boolean;
    photographer_plan: string;
    photographer_email: string;
    photographer_name: string;
    client_email: string;
    client_name: string;
  }>(
    `SELECT b.id, b.delivery_password, b.delivery_expires_at,
            b.delivery_accepted, b.payment_status, b.stripe_payment_intent_id,
            b.total_price, b.payout_amount, b.payout_transferred,
            pp.stripe_account_id as photographer_stripe_id,
            pp.stripe_onboarding_complete as photographer_stripe_ready,
            pp.plan as photographer_plan,
            pu.email as photographer_email,
            pu.name as photographer_name,
            cu.email as client_email,
            cu.name as client_name
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`,
    [token]
  );

  if (!booking) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  // Verify password (bcrypt, with SHA256 fallback for old deliveries)
  const { compare: bcryptCompare } = await import("bcryptjs");
  const isBcrypt = booking.delivery_password.startsWith("$2");
  const passwordMatch = isBcrypt
    ? await bcryptCompare(password, booking.delivery_password)
    : crypto.createHash("sha256").update(password).digest("hex") === booking.delivery_password;
  if (!passwordMatch) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Check if already accepted (early check before transaction)
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "Delivery already accepted", already_accepted: true }, { status: 400 });
  }

  // Use a transaction with FOR UPDATE to prevent double-payout race condition
  let payoutSuccess = false;

  const accepted = await withTransaction(async (client) => {
    // Lock the booking row to prevent concurrent acceptance
    await client.query(
      "SELECT id FROM bookings WHERE id = $1 FOR UPDATE",
      [booking.id]
    );

    // Conditionally mark delivery as accepted — only if not already accepted
    const acceptResult = await client.query(
      "UPDATE bookings SET delivery_accepted = TRUE, delivery_accepted_at = NOW() WHERE id = $1 AND delivery_accepted = FALSE RETURNING id",
      [booking.id]
    );

    if (acceptResult.rowCount === 0) {
      // Already accepted by a concurrent request
      return false;
    }

    // Update delivery expiry to 60 days from acceptance
    const newExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await client.query(
      "UPDATE bookings SET delivery_expires_at = $1 WHERE id = $2",
      [newExpiry.toISOString(), booking.id]
    );

    return true;
  });

  if (!accepted) {
    return NextResponse.json({ success: true, already_accepted: true, payout_transferred: false });
  }

  // Trigger payout if payment was made and not already transferred
  if (booking.payment_status === "paid" && !booking.payout_transferred && booking.photographer_stripe_id) {
    // Check if photographer completed Stripe onboarding
    if (!booking.photographer_stripe_ready) {
      console.log(`[delivery/accept] Photographer Stripe not ready for booking ${booking.id}, skipping payout`);
      // Notify photographer to complete Stripe setup
      import("@/lib/email").then(({ sendEmail }) =>
        sendEmail(booking.photographer_email, "Complete your Stripe setup to receive payment",
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Payment Pending — Action Required</h2>
            <p>Hi ${booking.photographer_name.split(" ")[0]},</p>
            <p><strong>${booking.client_name}</strong> has accepted your photo delivery! However, we can't transfer your payment yet because your Stripe account setup is incomplete.</p>
            <p><a href="https://photoportugal.com/dashboard/settings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Complete Stripe Setup</a></p>
            <p style="color: #666; font-size: 13px;">Once your Stripe account is verified, the payment will be transferred automatically.</p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`)
      ).catch(e => console.error("[delivery/accept] stripe setup email error:", e));

      import("@/lib/notify-photographer").then(m => {
        const ppId = queryOne<{id:string}>("SELECT id FROM photographer_profiles WHERE stripe_account_id = $1", [booking.photographer_stripe_id!]);
        ppId.then(p => p && m.notifyPhotographerViaTelegram(p.id, "⚠️ Payment pending! Complete your Stripe setup to receive your payout.\n\nhttps://photoportugal.com/dashboard/settings"));
      }).catch((err) => console.error("[delivery/accept] telegram stripe setup error:", err));
    }

    if (booking.photographer_stripe_ready) {
    try {
      const stripeClient = requireStripe();

      // Calculate payout amount
      let payoutAmount = booking.payout_amount ? Number(booking.payout_amount) : null;
      if (!payoutAmount && booking.total_price) {
        const payment = calculatePayment(booking.total_price, booking.photographer_plan);
        payoutAmount = payment.photographerPayout;
      }

      if (payoutAmount && payoutAmount > 0) {
        // Create a transfer to the photographer's connected account
        await stripeClient.transfers.create({
          amount: Math.round(payoutAmount * 100), // Convert to cents
          currency: "eur",
          destination: booking.photographer_stripe_id,
          ...(booking.stripe_payment_intent_id
            ? { transfer_group: booking.stripe_payment_intent_id }
            : {}),
          metadata: {
            booking_id: booking.id,
            type: "delivery_payout",
            ...(booking.stripe_payment_intent_id
              ? { payment_intent_id: booking.stripe_payment_intent_id }
              : {}),
          },
        });

        // Mark payout as transferred
        await queryOne(
          "UPDATE bookings SET payout_transferred = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );

        payoutSuccess = true;

        // Send payout email to photographer
        sendDeliveryAcceptedToPhotographer(
          booking.photographer_email,
          booking.photographer_name,
          booking.client_name,
          payoutAmount
        );
      }
    } catch (stripeErr) {
      console.error("[delivery/accept] payout error:", stripeErr);
      // Don't fail the acceptance even if payout fails — it can be retried
    }
    } // end if photographer_stripe_ready
  }

  // Send acceptance email to client
  sendDeliveryAcceptedToClient(
    booking.client_email,
    booking.client_name,
    booking.photographer_name
  );

  // System message in chat
  sendBookingStatusMessage(booking.id, "delivery_accepted").catch((err) => console.error("[delivery/accept] status message error:", err));

  // Telegram: notify admin of delivery acceptance
  import("@/lib/telegram").then(({ sendTelegram }) => {
    const estimatedPayout = booking.payout_amount ? Number(booking.payout_amount) : (booking.total_price ? Math.round(booking.total_price * 0.8) : 0);
    sendTelegram(`✅ <b>Delivery Accepted!</b>\n\n${booking.client_name} accepted photos from ${booking.photographer_name}${payoutSuccess ? `\nPayout: €${Math.round(estimatedPayout)}` : ""}`, "bookings");
  }).catch((err) => console.error("[delivery/accept] telegram admin error:", err));

  // Telegram: notify photographer of delivery acceptance
  try {
    const photographerProfileForTg = await queryOne<{ id: string }>(
      "SELECT photographer_id as id FROM bookings WHERE id = $1", [booking.id]
    );
    if (photographerProfileForTg) {
      const clientFirst = booking.client_name.split(" ")[0];
      const payoutInfo = booking.payout_amount ? `\nPayout: \u20ac${Number(booking.payout_amount).toFixed(2)}` : "";
      import("@/lib/notify-photographer").then(m =>
        m.notifyPhotographerViaTelegram(
          photographerProfileForTg.id,
          `${clientFirst} accepted your delivery!${payoutInfo}\n\nView: https://photoportugal.com/dashboard/bookings`
        )
      ).catch((err) => console.error("[delivery/accept] telegram photographer error:", err));
    }
  } catch {}

  // Pre-build ZIP in background (non-blocking)
  import("@/lib/build-zip").then(({ buildDeliveryZip }) => {
    buildDeliveryZip(booking.id).catch(err => console.error("[accept] zip build error:", err));
  });

  return NextResponse.json({
    success: true,
    payout_transferred: payoutSuccess,
  });
}
