import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { requireStripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, action, archived, reason } = body;
  const trimmedReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";

  // Archive/unarchive
  if (id && archived !== undefined) {
    await queryOne("UPDATE bookings SET archived = $1 WHERE id = $2", [!!archived, id]);
    return NextResponse.json({ success: true });
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
