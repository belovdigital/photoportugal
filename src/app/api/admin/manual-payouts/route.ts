import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { isManualPayout } from "@/lib/payout";

/**
 * Manual payout queue — markets without Stripe Connect.
 *
 * In Spain nobody moves money automatically: the client pays us through Stripe,
 * and a human sends the photographer's share by bank transfer. This endpoint is
 * the ledger that keeps that honest — what is owed, what has been sent, and
 * which reference it went out under.
 *
 * A booking is payable once the client has accepted the delivered photos. That
 * is the same trigger Connect uses to release funds, so photographers in both
 * markets get paid at the same point in the journey.
 */

async function isAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

type Row = {
  booking_id: string;
  shoot_date: string | null;
  photographer_id: string;
  photographer_name: string;
  photographer_email: string;
  payout_iban: string | null;
  payout_holder: string | null;
  payout_tax_id: string | null;
  payout_amount: string | null;
  total_price: string | null;
  client_name: string;
  delivery_accepted_at: string | null;
  paid_at: string | null;
  reference: string | null;
  payout_status: string | null;
};

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManualPayout) {
    return NextResponse.json(
      { error: "This market pays out through Stripe Connect — there is no manual queue." },
      { status: 400 }
    );
  }

  // LEFT JOIN on manual_payouts so a booking shows up the moment it becomes
  // payable, not only after someone has already touched it.
  const rows = await query<Row>(
    `SELECT b.id                         AS booking_id,
            b.shoot_date,
            pp.id                        AS photographer_id,
            pu.name                      AS photographer_name,
            pu.email                     AS photographer_email,
            pp.payout_iban, pp.payout_holder, pp.payout_tax_id,
            b.payout_amount::text, b.total_price::text,
            cu.name                      AS client_name,
            b.delivery_accepted_at,
            mp.paid_at, mp.reference,
            mp.status                    AS payout_status
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN manual_payouts mp ON mp.booking_id = b.id
      WHERE b.payment_status = 'paid'
        AND COALESCE(b.delivery_accepted, FALSE) = TRUE
      ORDER BY (mp.paid_at IS NOT NULL), b.delivery_accepted_at DESC NULLS LAST`
  );

  const pending = rows.filter((r) => r.payout_status !== "paid");
  const paid = rows.filter((r) => r.payout_status === "paid");
  const owedCents = pending.reduce(
    (sum, r) => sum + Math.round(Number(r.payout_amount || 0) * 100),
    0
  );

  return NextResponse.json({
    pending,
    paid,
    owed_total: owedCents / 100,
    // Surfaced so the admin can see at a glance who cannot be paid yet rather
    // than discovering it at the bank.
    missing_details: pending.filter((r) => !r.payout_iban?.trim()).length,
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManualPayout) {
    return NextResponse.json({ error: "Not a manual-payout market" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.booking_id || "").trim();
  const reference = String(body.reference || "").trim();
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  const booking = await queryOne<{
    photographer_id: string; payout_amount: string | null; payout_iban: string | null;
  }>(
    `SELECT b.photographer_id, b.payout_amount::text, pp.payout_iban
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
      WHERE b.id = $1`,
    [bookingId]
  );
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Refuse to record a transfer to an account we do not have. Marking this paid
  // without an IBAN would quietly clear the debt from the queue while the
  // photographer is still waiting for money.
  if (!booking.payout_iban?.trim()) {
    return NextResponse.json(
      { error: "No bank details on file for this photographer — nothing could have been sent." },
      { status: 400 }
    );
  }

  const cents = Math.round(Number(booking.payout_amount || 0) * 100);

  await queryOne(
    `INSERT INTO manual_payouts (photographer_id, booking_id, amount_cents, status, reference, paid_at)
     VALUES ($1, $2, $3, 'paid', NULLIF($4, ''), NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [booking.photographer_id, bookingId, cents, reference]
  );

  // Keep the booking's own flag in step so every other screen that reads
  // `payout_transferred` agrees with the queue.
  await queryOne("UPDATE bookings SET payout_transferred = TRUE WHERE id = $1 RETURNING id", [bookingId]);

  return NextResponse.json({ success: true, amount: cents / 100 });
}
