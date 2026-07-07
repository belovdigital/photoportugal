import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { calculatePayment, capturePaymentIntent, requireStripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, action, archived, reason, booking_id, photographer_id, admin_notes } = body;
  const trimmedReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";

  // Archive/unarchive
  if (id && archived !== undefined) {
    await queryOne("UPDATE bookings SET archived = $1 WHERE id = $2", [!!archived, id]);
    return NextResponse.json({ success: true });
  }

  // Assign photographer to a blind booking. The action is its own
  // branch because (a) it uses booking_id instead of id, (b) the
  // mutation captures Stripe + computes payout split, and (c) it
  // returns a 409 on the race so the UI can show a clear message.
  if (action === "assign_photographer") {
    return await handleAssignPhotographer({
      bookingId: String(booking_id || "").trim(),
      photographerId: String(photographer_id || "").trim(),
      adminNotes: admin_notes ? String(admin_notes).trim() : null,
      req,
    });
  }

  if (!id || !action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 });

  try {
    if (action === "cancel") {
      // Pull both parties' contact info so we can email + Telegram after
      // the cancellation lands.
      const booking = await queryOne<{
        status: string;
        payment_status: string | null;
        stripe_payment_intent_id: string | null;
        total_price: number | null;
        service_fee: number | null;
        client_email: string;
        client_name: string;
        client_phone: string | null;
        photographer_email: string;
        photographer_name: string;
        photographer_user_id: string;
      }>(
        `SELECT b.status, b.payment_status, b.stripe_payment_intent_id,
                b.total_price, b.service_fee,
                cu.email AS client_email, cu.name AS client_name, cu.phone AS client_phone,
                pu.email AS photographer_email, pu.name AS photographer_name,
                pp.user_id AS photographer_user_id
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
          WHERE b.id = $1`,
        [id]
      );
      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

      const wasPaid = booking.payment_status === "paid";
      const totalPaid = Number(booking.total_price ?? 0) + Number(booking.service_fee ?? 0);

      // Refund if paid — admin override always issues 100% (no
      // policy-based partial refunds at this level).
      if (wasPaid && booking.stripe_payment_intent_id) {
        try {
          const stripe = requireStripe();
          await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id });
        } catch (err) {
          console.error("[admin/bookings] Refund failed:", err);
          try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/admin/bookings", method: req.method, statusCode: 500 }); } catch {}
          return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
        }
      }

      await queryOne(
        `UPDATE bookings
            SET status = 'cancelled',
                payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
                cancelled_at = NOW(),
                cancelled_by = 'admin',
                cancelled_reason = COALESCE(NULLIF($2, ''), cancelled_reason)
          WHERE id = $1
          RETURNING id`,
        [id, trimmedReason]
      );

      // Notifications — fire-and-forget so a flaky email/Telegram
      // doesn't block the admin UI. Mirrors the regular cancellation
      // flow at /api/bookings/[id] (admin variant is simpler: always
      // 100% refund, no cancellation-policy text).
      try {
        const { sendEmail } = await import("@/lib/email");
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";
        const refundLine = wasPaid
          ? `The full payment of <strong>&euro;${totalPaid.toFixed(2)}</strong> has been refunded — it should appear in the original payment method within 5-10 business days.`
          : `No payment had been collected, so there's nothing to refund.`;
        const adminNote = trimmedReason
          ? `<p><strong>Note from Photo Portugal:</strong> ${trimmedReason.replace(/[<>]/g, "")}</p>`
          : "";

        sendEmail(
          booking.client_email,
          wasPaid
            ? `Booking cancelled — €${totalPaid.toFixed(2)} refunded`
            : `Booking cancelled`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking cancelled</h2>
            <p>Hi ${booking.client_name.split(" ")[0] || "there"},</p>
            <p>Your booking with <strong>${booking.photographer_name}</strong> has been cancelled by Photo Portugal.</p>
            <p>${refundLine}</p>
            ${adminNote}
            <p>If you have any questions, just reply to this email.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch((err) => console.error("[admin/bookings] client email error:", err));

        sendEmail(
          booking.photographer_email,
          wasPaid
            ? `Booking cancelled by admin — €${totalPaid.toFixed(2)} refunded to client`
            : `Booking cancelled by admin`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking cancelled</h2>
            <p>Hi ${booking.photographer_name.split(" ")[0] || "there"},</p>
            <p>The Photo Portugal team cancelled a booking with <strong>${booking.client_name}</strong>.</p>
            <p>${wasPaid ? `A full refund of <strong>&euro;${totalPaid.toFixed(2)}</strong> was issued to the client.` : "No payment had been collected on this booking."}</p>
            ${adminNote}
            <p>If anything looks off, reply to this email and we'll look into it.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch((err) => console.error("[admin/bookings] photographer email error:", err));
      } catch (err) {
        console.error("[admin/bookings] notification error:", err);
      }

      // Telegram firehose entry so the admin chat reflects the action.
      import("@/lib/telegram").then(({ sendTelegram }) => {
        const lines = [
          `🛠️ <b>Admin cancelled booking</b>`,
          ``,
          `${booking.client_name} → ${booking.photographer_name}`,
          wasPaid ? `Refund: €${totalPaid.toFixed(2)} (full)` : `No payment to refund`,
        ];
        if (trimmedReason) {
          lines.push(``, `<b>Reason:</b>`, `<i>${trimmedReason.replace(/[<>]/g, "")}</i>`);
        }
        sendTelegram(lines.join("\n"), "bookings");
      }).catch((err) => console.error("[admin/bookings] telegram error:", err));
    } else if (action === "delete") {
      const booking = await queryOne<{ payment_status: string | null }>(
        "SELECT payment_status FROM bookings WHERE id = $1", [id]
      );
      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (booking.payment_status === "paid") {
        return NextResponse.json({ error: "Cannot delete a paid booking. Cancel and refund first." }, { status: 400 });
      }

      await queryOne("DELETE FROM bookings WHERE id = $1 RETURNING id", [id]);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    revalidatePath("/admin");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/bookings] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/bookings", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Assigns a photographer to a blind booking (photographer_id IS NULL +
// blind_booking=TRUE). Captures the Stripe auth-hold, sets the
// payout split per the photographer's plan, fires confirmation
// emails + Telegram, then returns 200. On race (another admin
// already assigned, or cron just cancelled it) returns 409.
async function handleAssignPhotographer(opts: {
  bookingId: string;
  photographerId: string;
  adminNotes: string | null;
  req: NextRequest;
}) {
  const { bookingId, photographerId, adminNotes, req } = opts;
  if (!bookingId || !photographerId) {
    return NextResponse.json({ error: "booking_id and photographer_id required" }, { status: 400 });
  }

  try {
    const booking = await queryOne<{
      id: string;
      status: string;
      blind_booking: boolean;
      photographer_id: string | null;
      total_price: number | null;
      stripe_payment_intent_id: string | null;
      payment_status: string | null;
      client_id: string;
    }>(
      `SELECT id, status::text AS status, blind_booking, photographer_id, total_price,
              stripe_payment_intent_id, payment_status, client_id
         FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: `Booking is ${booking.status}, not confirmed (cannot assign)` }, { status: 400 });
    }
    if (booking.photographer_id) {
      return NextResponse.json({ error: "Booking already has a photographer" }, { status: 400 });
    }

    const photographer = await queryOne<{ id: string; user_id: string; plan: string }>(
      `SELECT id, user_id, plan
         FROM photographer_profiles WHERE id = $1 AND is_approved = TRUE`,
      [photographerId]
    );
    if (!photographer) return NextResponse.json({ error: "Photographer not found or not approved" }, { status: 404 });

    if (booking.stripe_payment_intent_id && booking.payment_status === "paid") {
      try {
        await capturePaymentIntent(booking.stripe_payment_intent_id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already.*captur/i.test(msg)) {
          console.error("[admin/bookings/assign] capture error:", msg);
          return NextResponse.json({ error: `Stripe capture failed: ${msg}` }, { status: 500 });
        }
      }
    }

    let serviceFee = 0, platformFee = 0, photographerPayout = 0;
    if (booking.total_price) {
      const split = calculatePayment(booking.total_price, photographer.plan);
      serviceFee = split.serviceFee;
      platformFee = split.platformFee;
      photographerPayout = split.photographerPayout;
      // Blind summer offer: total_price is the base derived from the
      // inclusive charge (base = total × 0.85), so the REAL platform cut
      // is total − base (€41.85 on €279) — NOT base × 0.15 (€35.57),
      // which assumed the old "charge = base × 1.15" model. Keeps
      // total_price + service_fee equal to the exact Stripe charge for
      // refunds/analytics. Commission split on the base stays plan-based.
      if (booking.blind_booking) {
        const base = Number(booking.total_price);
        serviceFee = Math.round((base / 0.85 - base) * 100) / 100;
      }
    }

    const adminCookie = await cookies();
    const adminToken = adminCookie.get("admin_token")?.value;
    let adminUserId: string | null = null;
    try {
      const decoded = adminToken ? verifyToken(adminToken) : null;
      if (decoded && typeof decoded === "object" && "userId" in decoded) {
        adminUserId = String((decoded as { userId: string }).userId);
      }
    } catch {}

    const updated = await queryOne<{ id: string }>(
      `UPDATE bookings
          SET photographer_id   = $1,
              assigned_by       = $2,
              assigned_at       = NOW(),
              admin_notes       = COALESCE($3, admin_notes),
              service_fee       = $4,
              platform_fee      = $5,
              payout_amount     = $6,
              auto_refund_at    = NULL
        WHERE id = $7
          AND status = 'confirmed'
          AND photographer_id IS NULL
        RETURNING id`,
      [photographer.id, adminUserId, adminNotes, serviceFee, platformFee, photographerPayout, bookingId]
    );
    if (!updated) {
      const current = await queryOne<{ status: string; photographer_id: string | null }>(
        "SELECT status::text AS status, photographer_id FROM bookings WHERE id = $1",
        [bookingId]
      );
      return NextResponse.json(
        { error: `Booking state changed: status='${current?.status}', photographer_id='${current?.photographer_id || "NULL"}'. Refresh — if Stripe was captured, refund manually.` },
        { status: 409 }
      );
    }

    revalidatePath("/admin");

    import("@/lib/telegram").then(({ sendTelegram }) =>
      sendTelegram(
        `<b>✅ Blind booking assigned</b>\nBooking: <code>${bookingId.slice(0, 8)}</code>\nPhotographer: ${photographer.id}\nPayment captured.`,
        "bookings"
      )
    ).catch((err) => console.error("[admin/bookings/assign] telegram error:", err));

    import("@/lib/booking-messages").then(({ sendBookingStatusMessage }) =>
      // "matched" (NOT "confirmed") — blind payment is already captured here,
      // so the thread opener must not talk about a pending payment link.
      sendBookingStatusMessage(bookingId, "matched", photographer.user_id)
    ).catch((err) => console.error("[admin/bookings/assign] system message error:", err));

    import("@/lib/email").then(async ({ sendEmail }) => {
      const ctx = await queryOne<{ client_email: string; client_name: string; photographer_email: string; photographer_name: string; location_slug: string | null; shoot_date: string | null }>(
        `SELECT cu.email AS client_email, cu.name AS client_name,
                pu.email AS photographer_email, pu.name AS photographer_name,
                b.location_slug, b.shoot_date::text AS shoot_date
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
          WHERE b.id = $1`,
        [bookingId]
      );
      if (!ctx) return;
      const BASE = process.env.AUTH_URL || "https://photoportugal.com";
      const dateLine = ctx.shoot_date ? ` on ${ctx.shoot_date}` : "";
      // Client — "your photographer is confirmed, chat with them".
      await sendEmail(
        ctx.client_email,
        `Your photographer is confirmed — ${ctx.photographer_name}`,
        `<div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
          <h2 style="color:#16A34A;">Your photographer is confirmed 🎉</h2>
          <p>Hi ${(ctx.client_name.split(" ")[0] || ctx.client_name).replace(/[<>]/g, "")},</p>
          <p>We've matched you with <strong>${ctx.photographer_name.replace(/[<>]/g, "")}</strong> for your photoshoot. Your payment has been processed.</p>
          <p><a href="${BASE}/dashboard/bookings" style="display:inline-block;background:#16A34A;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">View booking & chat with your photographer</a></p>
          <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
        </div>`
      );
      // Photographer — a system chat message alone doesn't push/email them, so
      // tell them directly they've got a new (paid) booking + nudge to chat.
      await sendEmail(
        ctx.photographer_email,
        `New booking — you've been matched with ${(ctx.client_name.split(" ")[0] || ctx.client_name)}`,
        `<div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
          <h2 style="color:#16A34A;">You've got a new booking 🎉</h2>
          <p>Hi ${(ctx.photographer_name.split(" ")[0] || ctx.photographer_name).replace(/[<>]/g, "")},</p>
          <p>Photo Portugal matched you with <strong>${ctx.client_name.replace(/[<>]/g, "")}</strong> for a ${(ctx.location_slug || "Portugal").replace(/-/g, " ")} photoshoot${dateLine}. It's booked and paid — your payout is on the way once the session is delivered.</p>
          <p>Say hi and plan the details (meeting point, timing, outfits) with them in the chat.</p>
          <p><a href="${BASE}/dashboard/messages" style="display:inline-block;background:#16A34A;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Open chat with your client</a></p>
          <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
        </div>`
      );
    }).catch((err) => console.error("[admin/bookings/assign] email error:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/bookings/assign] error:", err);
    try {
      const { logServerError } = await import("@/lib/error-logger");
      await logServerError(err, { path: "/api/admin/bookings", method: req.method, statusCode: 500 });
    } catch {}
    return NextResponse.json({ error: "Failed to assign booking" }, { status: 500 });
  }
}
