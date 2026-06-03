import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { revalidatePath } from "next/cache";
import { capturePaymentIntent, calculatePayment } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

// GET /api/admin/unmatched-bookings
// List unmatched + (paid OR unpaid) blind bookings + photographers in
// each region for the assign dropdown.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await query<{
    id: string;
    created_at: string;
    auto_refund_at: string | null;
    location_slug: string | null;
    shoot_date: string | null;
    occasion: string | null;
    group_size: number | null;
    total_price: number | null;
    payment_status: string | null;
    stripe_payment_intent_id: string | null;
    message: string | null;
    admin_notes: string | null;
    client_id: string;
    client_email: string;
    client_name: string;
    client_phone: string | null;
    utm_source: string | null;
    utm_medium: string | null;
  }>(
    `SELECT b.id, b.created_at::text, b.auto_refund_at::text,
            b.location_slug, b.shoot_date::text, b.occasion, b.group_size,
            b.total_price, b.payment_status, b.stripe_payment_intent_id,
            b.message, b.admin_notes,
            b.client_id, u.email AS client_email, u.name AS client_name, u.phone AS client_phone,
            b.utm_source, b.utm_medium
       FROM bookings b
       JOIN users u ON u.id = b.client_id
      WHERE b.status = 'confirmed'
        AND b.photographer_id IS NULL
        AND b.blind_booking = TRUE
      ORDER BY b.created_at DESC
      LIMIT 100`
  );

  // Photographers — approved, not banned, fresh login. Returned as a
  // flat list; client filters by region in the dropdown.
  const photographers = await query<{
    id: string;
    user_id: string;
    name: string;
    slug: string;
    plan: string;
    last_seen_at: string | null;
    locations: string[];
  }>(
    `SELECT pp.id, pp.user_id, u.name, pp.slug, pp.plan,
            u.last_seen_at::text,
            COALESCE(
              (SELECT array_agg(location_slug ORDER BY location_slug)
                 FROM photographer_locations
                WHERE photographer_id = pp.id),
              ARRAY[]::varchar[]
            ) AS locations
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(u.is_banned, FALSE) = FALSE
        AND COALESCE(pp.is_test, FALSE) = FALSE
      ORDER BY u.last_seen_at DESC NULLS LAST, u.name`
  );

  return NextResponse.json({ bookings, photographers });
}

// POST /api/admin/unmatched-bookings — body: { booking_id, photographer_id, admin_notes? }
// Assigns a photographer, flips status to 'confirmed', captures the
// Stripe auth-hold, and fires notifications.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const bookingId = String(body.booking_id || "").trim();
    const photographerId = String(body.photographer_id || "").trim();
    const adminNotes = body.admin_notes ? String(body.admin_notes).trim() : null;

    if (!bookingId || !photographerId) {
      return NextResponse.json({ error: "booking_id and photographer_id required" }, { status: 400 });
    }

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
      `SELECT id, status, blind_booking, photographer_id, total_price,
              stripe_payment_intent_id, payment_status, client_id
         FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: `Booking is ${booking.status}, not confirmed (cannot assign)` }, { status: 400 });
    }
    if (booking.photographer_id) {
      return NextResponse.json({ error: "Booking already has a photographer assigned" }, { status: 400 });
    }

    const photographer = await queryOne<{
      id: string;
      user_id: string;
      plan: string;
      stripe_account_id: string | null;
    }>(
      `SELECT id, user_id, plan, stripe_account_id
         FROM photographer_profiles WHERE id = $1 AND is_approved = TRUE`,
      [photographerId]
    );
    if (!photographer) {
      return NextResponse.json({ error: "Photographer not found or not approved" }, { status: 404 });
    }

    // Capture the Stripe auth-hold (if paid). For not-yet-paid blind
    // bookings (rare race), skip — webhook will run capture eventually
    // because we set the booking to confirmed below.
    if (booking.stripe_payment_intent_id && booking.payment_status === "paid") {
      try {
        await capturePaymentIntent(booking.stripe_payment_intent_id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Already captured? Treat as success.
        if (!/already.*captur/i.test(msg)) {
          console.error("[admin/unmatched-bookings] capture error:", msg);
          return NextResponse.json(
            { error: `Stripe capture failed: ${msg}` },
            { status: 500 }
          );
        }
      }
    }

    // Compute payment split now that photographer's plan is known.
    // total_price stores the BASE photographer rate (matches non-blind
    // semantics) — calculatePayment adds 12.5% service fee on top for
    // the client total, deducts plan-based commission for payout.
    let serviceFee = 0,
      platformFee = 0,
      photographerPayout = 0;
    if (booking.total_price) {
      const split = calculatePayment(booking.total_price, photographer.plan);
      serviceFee = split.serviceFee;
      platformFee = split.platformFee;
      photographerPayout = split.photographerPayout;
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

    // Row-level guard against double-assignment (two admins racing) and
    // assignment-after-auto-refund-cron (audit findings #5, #6). If the
    // booking isn't still unmatched and unassigned, UPDATE returns no
    // rows — we must NOT proceed with notifications (and ideally refund
    // the capture, but that's a separate cleanup).
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
      [
        photographer.id,
        adminUserId,
        adminNotes,
        serviceFee,
        platformFee,
        photographerPayout,
        bookingId,
      ]
    );
    if (!updated) {
      // Another admin already assigned, or the cron just cancelled it.
      // If we did capture above and lost the race, surface this to the
      // admin so they can refund manually rather than silently double-
      // assigning. Re-read current state so the message is concrete.
      const current = await queryOne<{ status: string; photographer_id: string | null }>(
        "SELECT status::text as status, photographer_id FROM bookings WHERE id = $1",
        [bookingId]
      );
      return NextResponse.json(
        {
          error: `Booking state changed: status='${current?.status}', photographer_id='${current?.photographer_id || "NULL"}'. Refresh and retry — if Stripe was captured, refund manually.`,
        },
        { status: 409 }
      );
    }

    revalidatePath("/admin");

    // Fire-and-forget: notify everyone.
    import("@/lib/telegram").then(({ sendTelegram }) =>
      sendTelegram(
        `<b>✅ Blind booking assigned</b>\nBooking: <code>${bookingId.slice(0, 8)}</code>\nPhotographer: ${photographer.id}\nPayment captured.`,
        "bookings"
      )
    ).catch((err) => console.error("[admin/unmatched-bookings] telegram error:", err));

    // Trigger the normal "booking confirmed" flow — send client + photographer emails.
    import("@/lib/booking-messages").then(({ sendBookingStatusMessage }) =>
      sendBookingStatusMessage(bookingId, "confirmed", photographer.user_id)
    ).catch((err) => console.error("[admin/unmatched-bookings] system message error:", err));

    // Send a richer email to client telling them their photographer is locked in.
    import("@/lib/email").then(async ({ sendEmail }) => {
      const ctx = await queryOne<{ client_email: string; client_name: string; photographer_name: string }>(
        `SELECT cu.email AS client_email, cu.name AS client_name, pu.name AS photographer_name
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
          WHERE b.id = $1`,
        [bookingId]
      );
      if (!ctx) return;
      const BASE = process.env.AUTH_URL || "https://photoportugal.com";
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
    }).catch((err) => console.error("[admin/unmatched-bookings] email error:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/unmatched-bookings] POST error:", err);
    try {
      const { logServerError } = await import("@/lib/error-logger");
      await logServerError(err, { path: "/api/admin/unmatched-bookings", method: "POST", statusCode: 500 });
    } catch {}
    return NextResponse.json({ error: "Failed to assign booking" }, { status: 500 });
  }
}
