import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne } from "@/lib/db";

// GET: Check if gallery exists (minimal info for password gate)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const booking = await queryOne<{
    photographer_name: string;
    delivery_expires_at: string;
  }>(
    `SELECT pp.display_name as photographer_name, b.delivery_expires_at
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.delivery_token = $1 AND b.status = 'delivered'`,
    [token]
  );

  if (!booking) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const expired = new Date(booking.delivery_expires_at) < new Date();

  return NextResponse.json({
    exists: true,
    expired,
    photographer_name: booking.photographer_name,
  });
}
