import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";

// Toggle SMS notifications for a single booking. Used by the
// surprise-proposal discretion notice: we disable client SMS by default
// on proposal bookings (so a lock-screen text doesn't spoil the
// surprise), and this lets the client opt back in for THIS booking only.
// Client-only — must own the booking.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mobileUser = await authFromRequest(req);
  const session = !mobileUser ? await auth() : null;
  const userId = mobileUser?.id || (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let enabled = false;
  try {
    enabled = !!(await req.json())?.enabled;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await queryOne<{ id: string }>(
    `UPDATE bookings SET client_sms_opt_in = $1
     WHERE id = $2 AND client_id = $3 RETURNING id`,
    [enabled, id, userId]
  );
  if (!updated) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({ success: true, client_sms_opt_in: enabled });
}
