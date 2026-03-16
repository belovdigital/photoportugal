import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

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

  const validStatuses = ["confirmed", "completed", "cancelled"];
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
    if ((status === "confirmed" || status === "completed") && !isPhotographer) {
      return NextResponse.json({ error: "Only the photographer can confirm bookings" }, { status: 403 });
    }

    await queryOne(
      "UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id",
      [status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[bookings] update error:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
