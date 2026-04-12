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
  const { id, action, archived } = body;

  // Archive/unarchive
  if (id && archived !== undefined) {
    await queryOne("UPDATE bookings SET archived = $1 WHERE id = $2", [!!archived, id]);
    return NextResponse.json({ success: true });
  }

  if (!id || !action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 });

  try {
    if (action === "cancel") {
      const booking = await queryOne<{ status: string; payment_status: string | null; stripe_payment_intent_id: string | null }>(
        "SELECT status, payment_status, stripe_payment_intent_id FROM bookings WHERE id = $1", [id]
      );
      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

      // Refund if paid
      if (booking.payment_status === "paid" && booking.stripe_payment_intent_id) {
        try {
          const stripe = requireStripe();
          await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id });
        } catch (err) {
          console.error("[admin/bookings] Refund failed:", err);
          return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
        }
      }

      await queryOne(
        "UPDATE bookings SET status = 'cancelled', payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END WHERE id = $1 RETURNING id",
        [id]
      );
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
