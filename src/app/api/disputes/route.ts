import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { queryOne, query, withTransaction } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

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

    return NextResponse.json({ success: true, id: dispute.id });
  } catch (error) {
    console.error("Error creating dispute:", error);
    return NextResponse.json({ error: "Failed to create dispute" }, { status: 500 });
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
        pp.display_name AS photographer_name,
        b.shoot_date,
        p.name AS package_name,
        b.total_price
      FROM disputes d
      JOIN users u ON u.id = d.client_id
      JOIN photographer_profiles pp ON pp.id = d.photographer_id
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
