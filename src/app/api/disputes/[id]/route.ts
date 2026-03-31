import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { requireStripe } from "@/lib/stripe";

const VALID_STATUSES = ["under_review", "resolved", "rejected"] as const;
const VALID_RESOLUTIONS = ["reshoot", "partial_refund", "full_refund", "rejected"] as const;

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

async function getAdminEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const data = verifyToken(token);
  return data?.email ?? null;
}

// PATCH - Update dispute (admin only, resolve/reject)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { status, resolution, resolution_note, refund_amount } = await req.json();

    // Verify dispute exists
    const dispute = await queryOne<{ id: string; booking_id: string; status: string }>(
      "SELECT id, booking_id, status FROM disputes WHERE id = $1",
      [id]
    );

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (dispute.status === "resolved" || dispute.status === "rejected") {
      return NextResponse.json({ error: "This dispute has already been closed" }, { status: 400 });
    }

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (resolution && !VALID_RESOLUTIONS.includes(resolution as typeof VALID_RESOLUTIONS[number])) {
      return NextResponse.json(
        { error: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const isClosing = status === "resolved" || status === "rejected";

    // Validate refund amount before making any changes
    if (refund_amount && (resolution === "full_refund" || resolution === "partial_refund")) {
      const bookingCheck = await queryOne<{ total_price: number }>(
        "SELECT total_price FROM bookings WHERE id = $1",
        [dispute.booking_id]
      );
      if (bookingCheck?.total_price && refund_amount > bookingCheck.total_price) {
        return NextResponse.json({ error: "Refund amount cannot exceed booking price" }, { status: 400 });
      }
    }

    // Update dispute record
    await query(
      `UPDATE disputes
       SET status = COALESCE($1, status),
           resolution = COALESCE($2, resolution),
           resolution_note = COALESCE($3, resolution_note),
           refund_amount = COALESCE($4, refund_amount),
           resolved_at = CASE WHEN $5 THEN NOW() ELSE resolved_at END
       WHERE id = $6`,
      [status || null, resolution || null, resolution_note || null, refund_amount ?? null, isClosing, id]
    );

    // If resolution involves a refund, issue actual Stripe refund then update booking
    if (resolution === "full_refund" || resolution === "partial_refund") {
      const booking = await queryOne<{ total_price: number; stripe_payment_intent_id: string | null }>(
        "SELECT total_price, stripe_payment_intent_id FROM bookings WHERE id = $1",
        [dispute.booking_id]
      );

      const amount = resolution === "full_refund"
        ? booking?.total_price ?? 0
        : refund_amount ?? 0;

      // Issue actual Stripe refund
      if (booking?.stripe_payment_intent_id) {
        try {
          const stripeClient = requireStripe();
          if (resolution === "full_refund") {
            await stripeClient.refunds.create({
              payment_intent: booking.stripe_payment_intent_id,
            });
          } else {
            // Partial refund — amount is in EUR, Stripe expects cents
            await stripeClient.refunds.create({
              payment_intent: booking.stripe_payment_intent_id,
              amount: Math.round(amount * 100),
            });
          }
        } catch (stripeErr) {
          console.error("[disputes] Stripe refund failed:", stripeErr);
          // Roll back the dispute update — don't mark as resolved if refund failed
          await query(
            `UPDATE disputes
             SET status = 'under_review',
                 resolution = NULL,
                 resolution_note = NULL,
                 refund_amount = NULL,
                 resolved_at = NULL
             WHERE id = $1`,
            [id]
          );
          return NextResponse.json(
            { error: "Stripe refund failed. Dispute was not resolved. Please try again or process the refund manually." },
            { status: 500 }
          );
        }
      }

      await query(
        `UPDATE bookings
         SET refund_amount = $1,
             status = 'refunded',
             payment_status = 'refunded'
         WHERE id = $2`,
        [amount, dispute.booking_id]
      );
    }

    // If not a refund case, update booking status back to delivered (reshoot/rejected)
    if (isClosing && resolution !== "full_refund" && resolution !== "partial_refund") {
      if (resolution === "rejected") {
        // Rejected dispute — return to delivered so client can accept
        await query("UPDATE bookings SET status = 'delivered' WHERE id = $1", [dispute.booking_id]);
      } else if (resolution === "reshoot") {
        // Reshoot — return to confirmed so photographer can redo
        await query("UPDATE bookings SET status = 'confirmed' WHERE id = $1", [dispute.booking_id]);
      }
    }

    // Send notifications on resolution
    if (isClosing) {
      try {
        const { sendEmail, getAdminEmail } = await import("@/lib/email");
        const info = await queryOne<{ client_name: string; client_email: string; photographer_name: string; photographer_email: string; booking_id: string }>(
          `SELECT cu.name as client_name, cu.email as client_email, pu.name as photographer_name, pu.email as photographer_email, d.booking_id
           FROM disputes d
           JOIN bookings b ON b.id = d.booking_id
           JOIN users cu ON cu.id = d.client_id
           JOIN photographer_profiles pp ON pp.id = d.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE d.id = $1`, [id]
        );

        if (info) {
          const RESOLUTION_TEXT: Record<string, string> = {
            reshoot: "A reshoot has been arranged. Your photographer will reach out to schedule a new session.",
            partial_refund: `A partial refund of €${refund_amount || 0} has been issued to your original payment method.`,
            full_refund: "A full refund has been issued to your original payment method.",
            rejected: "After careful review, we determined the delivery meets the agreed terms.",
          };
          const resText = RESOLUTION_TEXT[resolution] || resolution;

          // Email to client
          sendEmail(info.client_email, `Your delivery issue has been resolved`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Issue Resolved</h2>
              <p>Hi ${info.client_name?.split(" ")[0]},</p>
              <p>${resText}</p>
              ${resolution_note ? `<p style="margin-top: 12px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px;"><strong>Note from our team:</strong> ${resolution_note}</p>` : ""}
              <p>If you have any questions, please <a href="https://photoportugal.com/contact" style="color: #C94536;">contact us</a>.</p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          ).catch(e => console.error("[dispute] resolve client email:", e));

          // Email to photographer
          sendEmail(info.photographer_email, `Delivery issue resolved — ${resolution.replace("_", " ")}`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Dispute Resolved</h2>
              <p>The delivery issue reported by ${info.client_name?.split(" ")[0]} has been resolved.</p>
              <p><strong>Resolution:</strong> ${resolution.replace("_", " ")}</p>
              ${resolution_note ? `<p style="margin-top: 12px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px;"><strong>Note:</strong> ${resolution_note}</p>` : ""}
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          ).catch(e => console.error("[dispute] resolve photographer email:", e));

          // Chat message
          const chatResolution: Record<string, string> = {
            reshoot: "✅ Issue resolved — a reshoot has been arranged.",
            partial_refund: `✅ Issue resolved — partial refund of €${refund_amount || 0} issued.`,
            full_refund: "✅ Issue resolved — full refund issued.",
            rejected: "✅ Issue reviewed — delivery meets agreed terms. You can accept the delivery.",
          };
          await queryOne(
            `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, (SELECT client_id FROM disputes WHERE id = $2), $3, TRUE)`,
            [dispute.booking_id, id, chatResolution[resolution] || `✅ Dispute resolved: ${resolution.replace("_", " ")}`]
          );
        }
      } catch (notifErr) {
        console.error("[dispute] resolve notification error:", notifErr);
      }
    }

    // Audit log
    try {
      const adminEmail = await getAdminEmail();
      const action = isClosing ? `dispute_${status}` : "dispute_updated";
      const details = JSON.stringify({ status, resolution, resolution_note, refund_amount });
      await query(
        "INSERT INTO audit_logs (admin_email, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
        [adminEmail, action, "dispute", id, details]
      );
    } catch (auditErr) {
      console.error("[disputes] audit log error:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating dispute:", error);
    return NextResponse.json({ error: "Failed to update dispute" }, { status: 500 });
  }
}
