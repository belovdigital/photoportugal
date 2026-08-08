import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne, withTransaction } from "@/lib/db";
import { requireStripe, calculatePayment, payoutBreakdownTelegram } from "@/lib/stripe";
import { sendDeliveryAcceptedToPhotographer, sendDeliveryAcceptedToClient } from "@/lib/email";
import { sendBookingStatusMessage } from "@/lib/booking-messages";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { country } from "@/lib/country";

// POST: Accept delivery — verify password, mark accepted, trigger payout
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { password, socialConsent } = await req.json();

  // Find the booking by delivery token
  const booking = await queryOne<{
    id: string;
    gift_recipient_user_id: string | null;
    delivery_password: string;
    delivery_expires_at: string;
    delivery_accepted: boolean;
    payment_status: string;
    stripe_payment_intent_id: string | null;
    gift_card_id: string | null;
    total_price: number | null;
    payout_amount: number | null;
    service_fee: number | null;
    payout_transferred: boolean;
    photographer_stripe_id: string | null;
    photographer_stripe_ready: boolean;
    photographer_plan: string;
    photographer_user_id: string;
    photographer_email: string;
    photographer_name: string;
    client_email: string;
    client_name: string;
    delivery_password_plain: string | null;
  }>(
    `SELECT b.id, b.gift_recipient_user_id, b.delivery_password, b.delivery_expires_at,
            b.delivery_accepted, b.payment_status, b.stripe_payment_intent_id, b.gift_card_id,
            b.total_price, b.payout_amount, b.service_fee, b.payout_transferred, b.delivery_password_plain,
            pp.stripe_account_id as photographer_stripe_id,
            pp.stripe_onboarding_complete as photographer_stripe_ready,
            pp.plan as photographer_plan,
            pu.id as photographer_user_id,
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

  // Gift recipient signed in via /gift/claim → /dashboard never sees the
  // delivery password. Skip the password check when the session user
  // matches the booking's gift_recipient_user_id.
  const session = await auth();
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id || null;
  const isGiftRecipientSignedIn = sessionUserId
    && booking.gift_recipient_user_id
    && booking.gift_recipient_user_id === sessionUserId;

  if (!isGiftRecipientSignedIn) {
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    const { compare: bcryptCompare } = await import("bcryptjs");
    const isBcrypt = booking.delivery_password.startsWith("$2");
    const passwordMatch = isBcrypt
      ? await bcryptCompare(password, booking.delivery_password)
      : crypto.createHash("sha256").update(password).digest("hex") === booking.delivery_password;
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
  }

  // Refuse while a dispute is open. Accepting is what releases the
  // photographer's payout below, and Stripe transfers are separate from the
  // charge — refunds.create does not claw one back, and this repo has no
  // reversal code. So a client who reported a problem and then clicked the
  // still-enabled Accept button (it sits right next to the dispute form, and
  // accepting is the only way to unlock full-res downloads) would leave us
  // paying both sides. The 14-day auto-release cron already excludes disputed
  // bookings via `status='delivered'`; this path was the one that did not.
  const openDispute = await queryOne<{ id: string }>(
    "SELECT id FROM disputes WHERE booking_id = $1 AND status IN ('open', 'under_review') LIMIT 1",
    [booking.id]
  );
  if (openDispute) {
    return NextResponse.json({
      error: "You've reported an issue with this delivery. Our team is reviewing it — once it's resolved you'll be able to accept.",
      dispute_open: true,
    }, { status: 409 });
  }

  // Check if already accepted (early check before transaction)
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "Delivery already accepted", already_accepted: true }, { status: 400 });
  }

  // Use a transaction with FOR UPDATE to prevent double-payout race condition
  // The extras story, told once. Gift slots the photographer offered, how many
  // the client actually took, and how many they paid for. payout_cents rather
  // than amount_cents wherever this reaches a photographer: they see what they
  // earn, never what the client was charged.
  const extras = await queryOne<{
    offered: number; taken: number; bought: number; payout: string | null; gross: string | null;
  }>(
    `SELECT COALESCE(b.extras_gift_slots, 0) AS offered,
            COUNT(*) FILTER (WHERE x.status = 'paid' AND x.amount_cents = 0)::int AS taken,
            COUNT(*) FILTER (WHERE x.status = 'paid' AND x.amount_cents > 0)::int AS bought,
            COALESCE(SUM(x.payout_cents) FILTER (WHERE x.status = 'paid'), 0)::text AS payout,
            COALESCE(SUM(x.amount_cents) FILTER (WHERE x.status = 'paid'), 0)::text AS gross
       FROM bookings b
       LEFT JOIN delivery_extra_purchases x ON x.booking_id = b.id
      WHERE b.id = $1
      GROUP BY b.extras_gift_slots`,
    [booking.id]
  ).catch(() => null);

  const giftOffered = extras?.offered ?? 0;
  const giftTaken = extras?.taken ?? 0;
  const extrasBought = extras?.bought ?? 0;
  const extrasPayout = Number(extras?.payout ?? 0) / 100;
  const extrasGross = Number(extras?.gross ?? 0) / 100;

  /** For the photographer: counts and their own money, never the client's. */
  const extrasLineForPhotographer = giftOffered > 0 || extrasBought > 0
    ? `\n\n🎁 Gifted: ${giftTaken} of ${giftOffered} taken` +
      (extrasBought > 0 ? `\n🛒 Bought: ${extrasBought} extra · +€${extrasPayout.toFixed(2)} to you` : "")
    : "";

  let payoutSuccess = false;

  const accepted = await withTransaction(async (client) => {
    // Lock the booking row to prevent concurrent acceptance
    await client.query(
      "SELECT id FROM bookings WHERE id = $1 FOR UPDATE",
      [booking.id]
    );

    // Conditionally mark delivery as accepted — only if not already accepted
    const acceptResult = await client.query(
      // The consent is written in the same statement that accepts the
      // delivery, so it can never be recorded for a delivery that was not
      // accepted, or accepted without a record of what the client agreed to.
      `UPDATE bookings
          SET delivery_accepted = TRUE,
              delivery_accepted_at = NOW(),
              social_consent = $2,
              social_consent_at = CASE WHEN $2 THEN NOW() ELSE NULL END
        WHERE id = $1 AND delivery_accepted = FALSE
        RETURNING id`,
      [booking.id, socialConsent === true]
    );

    if (acceptResult.rowCount === 0) {
      // Already accepted by a concurrent request
      return false;
    }

    // Update delivery expiry to 90 days from acceptance
    const newExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await client.query(
      "UPDATE bookings SET delivery_expires_at = $1 WHERE id = $2",
      [newExpiry.toISOString(), booking.id]
    );

    return true;
  });

  if (!accepted) {
    return NextResponse.json({ success: true, already_accepted: true, payout_transferred: false });
  }

  // Trigger payout if payment was made and not already transferred.
  // Two valid funding sources:
  //   1. Regular booking — Stripe PaymentIntent (charge captured at
  //      booking confirmation), so stripe_payment_intent_id is set.
  //   2. Gift-card redemption — buyer already paid on the gift card
  //      purchase, money sits on our platform balance. No PI on this
  //      booking, but gift_card_id is set. `stripe.transfers.create`
  //      works either way (with or without a transfer_group).
  // .create would pull the money straight out of the platform balance
  // (real loss). A "paid" flag without a PI means the row was either
  // hand-edited, partially-recovered from a webhook failure, or test
  // data; in any case we should NOT be transferring to the photographer.
  const hasValidFunding = !!booking.stripe_payment_intent_id || !!booking.gift_card_id;
  const fundedStatus = booking.payment_status === "paid" || booking.payment_status === "partially_refunded";
  if (fundedStatus && hasValidFunding && !booking.payout_transferred && booking.photographer_stripe_id) {
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
            <p><a href="${country.baseUrl}/dashboard/settings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Complete Stripe Setup</a></p>
            <p style="color: #666; font-size: 13px;">Once your Stripe account is verified, the payment will be transferred automatically.</p>
            <p style="color: #999; font-size: 12px;">${country.brand} — ${country.host}</p>
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
        // ── Atomic claim ────────────────────────────────────────────
        // Flip payout_transferred=TRUE in a single SQL statement that
        // ALSO checks "...AND payout_transferred=FALSE" — at most one
        // concurrent process wins this race. The losers see rowCount=0
        // and skip the transfer entirely. This closes the race window
        // between /accept and the cron retry path firing for the same
        // booking simultaneously.
        const claim = await queryOne<{ id: string }>(
          "UPDATE bookings SET payout_transferred = TRUE WHERE id = $1 AND COALESCE(payout_transferred, FALSE) = FALSE RETURNING id",
          [booking.id]
        );
        if (!claim) {
          // Another path (or this one re-running) already claimed.
          console.log(`[delivery/accept] payout already claimed for ${booking.id}, skipping transfer`);
        } else {
          try {
            // Idempotency key — even if this exact request body fires
            // twice (network retry, double-click, redeploy mid-flight),
            // Stripe returns the same transfer rather than creating a
            // second one. Belt-and-braces with the atomic claim above.
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
            }, { idempotencyKey: `payout_${booking.id}` });

            payoutSuccess = true;

            // Admin Telegram: transfer fired (Stripe `transfer.created`
            // webhook is unreliable — events aren't subscribed in the
            // Dashboard, so notify directly from here).
            import("@/lib/telegram").then(({ sendTelegram }) => {
              sendTelegram(
                payoutBreakdownTelegram({
                  payout: payoutAmount!,
                  base: booking.total_price,
                  serviceFee: booking.service_fee,
                  plan: booking.photographer_plan,
                  photographerName: booking.photographer_name,
                  clientName: booking.client_name,
                  bookingId: booking.id,
                }),
                "stripe"
              );
            }).catch(() => {});

            // Unsold extras: acceptance releases the session payout, but the
            // gallery lives another 90 days and these can still sell.
            const extrasLeft = await queryOne<{ n: string }>(
              `SELECT COUNT(*) AS n FROM delivery_photos
                WHERE booking_id = $1 AND is_included = FALSE AND purchased_at IS NULL
                  AND COALESCE(media_type, 'image') <> 'video'`,
              [booking.id]
            ).catch(() => null);
            const extrasStillOnOffer = parseInt(extrasLeft?.n || "0", 10);

            // Send payout email to photographer
            sendDeliveryAcceptedToPhotographer(
              booking.photographer_email,
              booking.photographer_name,
              booking.client_name,
              payoutAmount,
              extrasStillOnOffer,
              { giftOffered, giftTaken, extrasBought, extrasPayout }
            );
          } catch (transferErr) {
            // Transfer failed (network, Stripe error). Roll back the
            // claim so the cron retry path can pick it up again. The
            // idempotency key means a successful retry doesn't double-
            // pay even if the original transfer DID complete and we
            // just missed the response.
            await queryOne(
              "UPDATE bookings SET payout_transferred = FALSE WHERE id = $1 RETURNING id",
              [booking.id]
            ).catch(() => {});
            throw transferErr;
          }
        }
      }
    } catch (stripeErr) {
      console.error("[delivery/accept] payout error:", stripeErr);
      // Don't fail the acceptance even if payout fails — it can be retried
    }
    } // end if photographer_stripe_ready
  }

  // Send acceptance email to client — includes the optional-tip button
  // deep-linking back into the gallery (pw embedded so it opens on any
  // device without the password prompt).
  sendDeliveryAcceptedToClient(
    booking.client_email,
    booking.client_name,
    booking.photographer_name,
    booking.delivery_password_plain
      ? `${country.baseUrl}/delivery/${token}?pw=${encodeURIComponent(booking.delivery_password_plain)}&tip=1`
      : null
  );

  // System message in chat
  sendBookingStatusMessage(booking.id, "delivery_accepted").catch((err) => console.error("[delivery/accept] status message error:", err));

  // Telegram: notify admin of delivery acceptance
  import("@/lib/telegram").then(({ sendTelegram }) => {
    const payout = booking.payout_amount
      ? Number(booking.payout_amount)
      : (booking.total_price ? calculatePayment(booking.total_price, booking.photographer_plan).photographerPayout : 0);
    const base = booking.total_price != null ? Number(booking.total_price) : null;
    const fee = booking.service_fee != null ? Number(booking.service_fee) : 0;
    const ourCut = base != null && payout > 0 && base - payout >= 0
      ? Math.round((base - payout + fee) * 100) / 100
      : null;
    const extrasLine = giftOffered > 0 || extrasBought > 0
      ? `\n🎁 Подарок: ${giftTaken} из ${giftOffered}` +
        (extrasBought > 0
          ? `\n🛒 Докупил: ${extrasBought} шт · €${extrasGross.toFixed(2)} (фотографу €${extrasPayout.toFixed(2)}, нам €${(extrasGross - extrasPayout).toFixed(2)})`
          : "\n🛒 Докупил: 0")
      : "";
    sendTelegram(`✅ <b>Delivery Accepted!</b>\n\n${booking.client_name} accepted photos from ${booking.photographer_name}${payoutSuccess ? `\nPayout: €${payout.toFixed(2)}${ourCut != null ? ` · нам €${ourCut.toFixed(2)}` : ""}` : ""}${extrasLine}`, "bookings");
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
          `${clientFirst} accepted your delivery!${payoutInfo}${extrasLineForPhotographer}\n\nView: ${country.baseUrl}/dashboard/bookings`
        )
      ).catch((err) => console.error("[delivery/accept] telegram photographer error:", err));
    }
  } catch {}

  // Mobile push to photographer \u2014 the moment they care about most (money
  // is on the way). Title includes the amount when we have it so the
  // lock-screen banner is unambiguous.
  try {
    const clientFirst = (booking.client_name || "").split(" ")[0] || "Client";
    const payoutAmt = booking.payout_amount ? Number(booking.payout_amount) : null;
    const title = payoutAmt
      ? `\ud83d\udcb0 \u20ac${payoutAmt.toFixed(0)} from ${clientFirst} \u2014 payout on its way`
      : `\u2705 ${clientFirst} accepted your delivery`;
    const body = payoutAmt
      ? "Tap to view booking details."
      : "Payment will land once your Stripe setup is complete.";
    import("@/lib/push").then((m) =>
      m.sendPushNotification(
        booking.photographer_user_id,
        title,
        body,
        { type: "booking", bookingId: booking.id, channelId: "payments", categoryId: "PAYMENT" }
      )
    ).catch((err) => console.error("[delivery/accept] push error:", err));
  } catch {}

  // Pre-build ZIP in background (non-blocking)
  import("@/lib/build-zip").then(({ buildDeliveryZip }) => {
    buildDeliveryZip(booking.id).catch(err => console.error("[accept] zip build error:", err));
  });

  // Permission to use a few of these photos on our own social accounts. It goes
  // to the admins as its own message rather than a line inside the acceptance
  // notice, because it is the one that needs acting on while the gallery is
  // still live — and it carries the archive link so nobody has to look up the
  // password. Both channels are admin-only; the link contains that password.
  if (socialConsent === true) {
    const galleryUrl = `${country.baseUrl}/delivery/${token}`;
    const archiveUrl = booking.delivery_password_plain
      ? `${country.baseUrl}/api/delivery/${token}/download?password=${encodeURIComponent(booking.delivery_password_plain)}`
      : galleryUrl;
    const photoCount = await queryOne<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM delivery_photos WHERE booking_id = $1",
      [booking.id]
    ).then((r) => Number(r?.n ?? 0)).catch(() => 0);

    import("@/lib/email").then(({ sendAdminSocialConsentNotification }) =>
      sendAdminSocialConsentNotification({
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        photographerName: booking.photographer_name,
        bookingId: booking.id,
        photoCount,
        archiveUrl,
        galleryUrl,
      })
    ).catch((err) => console.error("[delivery/accept] social consent email error:", err));

    import("@/lib/telegram").then(({ sendTelegram }) => sendTelegram(
      `📸 <b>Photos OK to use</b>\n\n${booking.client_name} accepted the delivery from ${booking.photographer_name} and allowed us to use a few shots on social.\n${photoCount} photos.\n\n<a href="${archiveUrl}">Download the archive</a> · <a href="${galleryUrl}">gallery</a>`,
      "bookings"
    )).catch((err: unknown) => console.error("[delivery/accept] social consent telegram error:", err));
  }

  // Acceptance moves the boundary between the two archives: everything owned
  // by now belongs to the main file, and the extras file becomes "bought
  // later". Any extras archive built before this moment describes the old
  // rule and would hand the client a second copy of photos they already have.
  await queryOne(
    `INSERT INTO delivery_extras_zip (booking_id, ready, zip_path, zip_size, updated_at)
     VALUES ($1, FALSE, NULL, NULL, NOW())
     ON CONFLICT (booking_id) DO UPDATE
       SET ready = FALSE, zip_path = NULL, zip_size = NULL, updated_at = NOW()
     RETURNING booking_id`,
    [booking.id]
  ).catch(() => null);
  import("@/lib/build-zip").then(({ buildDeliveryZip }) => {
    buildDeliveryZip(booking.id, "extras").catch(() => {});
  });

  return NextResponse.json({
    success: true,
    payout_transferred: payoutSuccess,
  });
}
