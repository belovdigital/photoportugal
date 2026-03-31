import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { queryOne, query, withTransaction } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const VALID_REASONS = ["fewer_photos", "wrong_location", "technical_issues", "no_show", "other"] as const;

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

// POST - Create dispute (client only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const { booking_id, reason, description } = await req.json();

    if (!booking_id || !reason || !description) {
      return NextResponse.json({ error: "booking_id, reason, and description are required" }, { status: 400 });
    }

    if (description.length > 2000) {
      return NextResponse.json({ error: "Description too long (max 2000 characters)" }, { status: 400 });
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify booking exists, belongs to client, status is 'delivered', delivery_accepted is FALSE
    const booking = await queryOne<{
      id: string;
      client_id: string;
      photographer_id: string;
      status: string;
      delivery_accepted: boolean;
    }>(
      "SELECT id, client_id, photographer_id, status, delivery_accepted FROM bookings WHERE id = $1",
      [booking_id]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId) {
      return NextResponse.json({ error: "This booking does not belong to you" }, { status: 403 });
    }

    if (booking.status !== "delivered") {
      return NextResponse.json({ error: "Disputes can only be filed for delivered bookings" }, { status: 400 });
    }

    if (booking.delivery_accepted === true) {
      return NextResponse.json({ error: "Cannot dispute a booking whose delivery has been accepted" }, { status: 400 });
    }

    // Check no existing open dispute for this booking
    const existingDispute = await queryOne<{ id: string }>(
      "SELECT id FROM disputes WHERE booking_id = $1 AND status IN ('open', 'under_review')",
      [booking_id]
    );

    if (existingDispute) {
      return NextResponse.json({ error: "An open dispute already exists for this booking" }, { status: 409 });
    }

    // Create dispute + update booking in transaction
    const dispute = await withTransaction(async (client) => {
      const d = await client.query(
        `INSERT INTO disputes (booking_id, client_id, photographer_id, reason, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [booking_id, userId, booking.photographer_id, reason, description]
      );
      await client.query("UPDATE bookings SET status = 'disputed' WHERE id = $1", [booking_id]);
      return d.rows[0];
    });

    // Send notifications (non-blocking)
    try {
      const info = await queryOne<{ client_name: string; client_email: string; photographer_name: string; photographer_email: string }>(
        `SELECT cu.name as client_name, cu.email as client_email, pu.name as photographer_name, pu.email as photographer_email
         FROM bookings b
         JOIN users cu ON cu.id = b.client_id
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         WHERE b.id = $1`, [booking_id]
      );
      if (info) {
        const { sendEmail, getAdminEmail } = await import("@/lib/email");
        const REASON_LABELS: Record<string, string> = { fewer_photos: "Fewer photos than promised", wrong_location: "Wrong location or subjects", technical_issues: "Technical issues", no_show: "Photographer no-show", other: "Other" };
        const reasonText = REASON_LABELS[reason] || reason;

        // Email to photographer
        sendEmail(info.photographer_email, `A client has reported an issue with their delivery`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Delivery Issue Reported</h2>
            <p>${escapeHtml(info.client_name?.split(" ")[0] || "")} has reported an issue with their photo delivery.</p>
            <p><strong>Reason:</strong> ${reasonText}</p>
            <p><strong>Details:</strong> ${escapeHtml(description)}</p>
            <p>Our team will review this within 48 hours. No action is needed from you right now — we'll be in touch if we need more information.</p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch(e => console.error("[dispute] photographer email error:", e));

        // Email to client
        sendEmail(info.client_email, `We've received your report — reviewing now`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">We've Received Your Report</h2>
            <p>Hi ${escapeHtml(info.client_name?.split(" ")[0] || "")},</p>
            <p>Thank you for letting us know. We've received your report and our team will review it within <strong>48 hours</strong>.</p>
            <p><strong>Issue:</strong> ${reasonText}</p>
            <p>If you change your mind, you can cancel the dispute and accept the delivery at any time from your bookings page.</p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch(e => console.error("[dispute] client email error:", e));

        // Email to admin
        const adminEmail = await getAdminEmail();
        const adminEmails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
        for (const ae of adminEmails) {
          sendEmail(ae, `[Dispute] ${info.client_name} vs ${info.photographer_name}`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">New Dispute Filed</h2>
              <p><strong>${escapeHtml(info.client_name)}</strong> vs <strong>${escapeHtml(info.photographer_name)}</strong></p>
              <p><strong>Reason:</strong> ${reasonText}</p>
              <p><strong>Details:</strong> ${escapeHtml(description)}</p>
              <p><a href="https://photoportugal.com/admin#disputes" style="display: inline-block; background: #C94536; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review in Admin</a></p>
            </div>`
          ).catch(e => console.error("[dispute] admin email error:", e));
        }
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`⚠️ <b>New Dispute!</b>\n\n${escapeHtml(info.client_name)} vs ${escapeHtml(info.photographer_name)}\nReason: ${reasonText}\n${escapeHtml(description.slice(0, 200))}`);
        }).catch(() => {});

        // Chat message
        await queryOne(
          `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
          [booking_id, userId, `⚠️ A delivery issue has been reported. Our team will review and respond within 48 hours.`]
        );
      }
    } catch (notifErr) {
      console.error("[dispute] notification error:", notifErr);
    }

    return NextResponse.json({ success: true, id: dispute.id });
  } catch (error) {
    console.error("Error creating dispute:", error);
    return NextResponse.json({ error: "Failed to create dispute" }, { status: 500 });
  }
}

// DELETE - Cancel dispute (client only)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  try {
    const { dispute_id } = await req.json();
    if (!dispute_id) return NextResponse.json({ error: "dispute_id required" }, { status: 400 });

    const dispute = await queryOne<{ id: string; booking_id: string; client_id: string; status: string }>(
      "SELECT id, booking_id, client_id, status FROM disputes WHERE id = $1", [dispute_id]
    );
    if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    if (dispute.client_id !== userId) return NextResponse.json({ error: "Not your dispute" }, { status: 403 });
    if (dispute.status !== "open" && dispute.status !== "under_review") {
      return NextResponse.json({ error: "Cannot cancel a resolved dispute" }, { status: 400 });
    }

    await withTransaction(async (client) => {
      await client.query("UPDATE disputes SET status = 'cancelled', resolved_at = NOW() WHERE id = $1", [dispute_id]);
      await client.query("UPDATE bookings SET status = 'delivered' WHERE id = $1", [dispute.booking_id]);
    });

    // Chat message
    await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
      [dispute.booking_id, userId, "ℹ️ The reported issue has been withdrawn by the client."]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling dispute:", error);
    return NextResponse.json({ error: "Failed to cancel dispute" }, { status: 500 });
  }
}

// GET - List disputes (admin only)
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const disputes = await query<{
      id: string;
      booking_id: string;
      client_id: string;
      photographer_id: string;
      reason: string;
      description: string;
      status: string;
      resolution: string | null;
      resolution_note: string | null;
      refund_amount: number | null;
      created_at: string;
      resolved_at: string | null;
      client_name: string;
      photographer_name: string;
      shoot_date: string;
      package_name: string | null;
      total_price: number | null;
    }>(
      `SELECT
        d.*,
        u.name AS client_name,
        pu.name AS photographer_name,
        b.shoot_date,
        p.name AS package_name,
        b.total_price
      FROM disputes d
      JOIN users u ON u.id = d.client_id
      JOIN photographer_profiles pp ON pp.id = d.photographer_id
      JOIN users pu ON pu.id = pp.user_id
      JOIN bookings b ON b.id = d.booking_id
      LEFT JOIN packages p ON p.id = b.package_id
      ORDER BY d.created_at DESC`
    );

    return NextResponse.json(disputes);
  } catch (error) {
    console.error("Error listing disputes:", error);
    return NextResponse.json({ error: "Failed to list disputes" }, { status: 500 });
  }
}
