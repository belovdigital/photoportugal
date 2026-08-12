import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

type Bucket = "day" | "week" | "month";

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Revenue/turnover chart data, grouped daily / weekly / monthly depending
 * on span. Accepts either:
 *   ?range=7|30|90|365|all
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * "all" looks up the earliest paid booking and reaches back to it.
 *
 * Bucketing rules:
 *   span ≤ 90 days  → daily bars
 *   91-365 days     → weekly bars (ISO week, Mon-Sun)
 *   > 365 days      → monthly bars
 *
 * Always returns a contiguous series (buckets with no bookings get a
 * zero row) so the chart spacing is correct.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const rangeParam = params.get("range");

  let fromDate: Date;
  const toDate: Date = toParam ? new Date(`${toParam}T23:59:59Z`) : new Date();

  if (fromParam) {
    fromDate = new Date(`${fromParam}T00:00:00Z`);
  } else if (rangeParam === "all") {
    const earliest = await queryOne<{ first_day: string | null }>(
      `SELECT MIN(created_at)::date::text AS first_day
         FROM bookings WHERE payment_status = 'paid'`
    );
    fromDate = earliest?.first_day
      ? new Date(`${earliest.first_day}T00:00:00Z`)
      : new Date(toDate.getTime() - 30 * 86400000);
  } else {
    const days = Math.max(Number(rangeParam) || 30, 1);
    fromDate = new Date(toDate.getTime() - (days - 1) * 86400000);
    fromDate.setUTCHours(0, 0, 0, 0);
  }

  const spanDays = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000));
  const bucket: Bucket = spanDays <= 90 ? "day" : spanDays <= 365 ? "week" : "month";

  // Two separate revenue streams, both reported per bucket so the
  // dashboard can chart them side-by-side:
  //   service_fee — earned at payment_status='paid' (added on top of
  //     package price, lands in our Stripe immediately).
  //   platform_fee — from 2026-08-11 it is earned at PAYMENT, because under the
  //     all-in model the commission is ours the moment the client pays and
  //     there is nothing to wait for. Bookings before that date keep the old
  //     rule (earned at delivery_accepted) so historical figures do not move
  //     under anyone who already read them.
  //   platform_fee (legacy) — earned at delivery_accepted=TRUE (deducted from
  //     photographer's payout, released when client accepts delivery).
  // `revenue` is kept as the sum for any consumer that still expects it.
  const rows = await query<{ bucket: string; turnover: string; service_fee: string; platform_fee: string; revenue: string; count: string }>(
    `SELECT
        DATE_TRUNC($1, b.created_at)::date::text AS bucket,
        -- Turnover = client gross (base + 15% service fee). stripe_amount_paid_cents
        -- is the exact persisted charge (covers promo codes); older rows fall
        -- back to base + service_fee. Matches the KPI card in admin/page.tsx.
        COALESCE(SUM(COALESCE(b.stripe_amount_paid_cents / 100.0, b.total_price + COALESCE(b.service_fee, 0))), 0) AS turnover,
        COALESCE(SUM(b.service_fee), 0) AS service_fee,
        COALESCE(SUM(CASE WHEN (b.delivery_accepted = TRUE OR b.created_at >= DATE '2026-08-11') THEN b.platform_fee ELSE 0 END), 0) AS platform_fee,
        COALESCE(SUM(b.service_fee) + SUM(CASE WHEN (b.delivery_accepted = TRUE OR b.created_at >= DATE '2026-08-11') THEN b.platform_fee ELSE 0 END), 0) AS revenue,
        COUNT(*) AS count
       FROM bookings b
      WHERE b.payment_status = 'paid'
        AND b.created_at >= $2
        AND b.created_at <= $3
      GROUP BY DATE_TRUNC($1, b.created_at)
      ORDER BY bucket ASC`,
    [bucket, fromDate.toISOString(), toDate.toISOString()]
  );

  // Extra photos sold after delivery. Bucketed by paid_at — the sale happened
  // then, not when the booking was created — so this cannot be a JOIN onto the
  // query above and is merged bucket-by-bucket below. Matches the admin KPI
  // cards: gross adds to turnover, platform_fee_cents adds to revenue.
  const extrasRows = await query<{ bucket: string; gross: string; fee: string }>(
    `SELECT DATE_TRUNC($1, paid_at)::date::text AS bucket,
            COALESCE(SUM(amount_cents), 0) / 100.0 AS gross,
            COALESCE(SUM(platform_fee_cents), 0) / 100.0 AS fee
       FROM delivery_extra_purchases
      WHERE status = 'paid' AND paid_at >= $2 AND paid_at <= $3
      GROUP BY DATE_TRUNC($1, paid_at)`,
    [bucket, fromDate.toISOString(), toDate.toISOString()]
  ).catch(() => []);
  const extrasByBucket = new Map(extrasRows.map((r) => [r.bucket, r]));

  // Fill missing buckets so the chart has contiguous bars.
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const filled: { day: string; turnover: number; service_fee: number; platform_fee: number; extras: number; revenue: number; count: number }[] = [];
  const cursor = new Date(fromDate);
  cursor.setUTCHours(0, 0, 0, 0);
  if (bucket === "week") {
    // Snap to ISO Monday so the cursor and DATE_TRUNC('week', ...) agree.
    const dow = cursor.getUTCDay() || 7; // Sun=7
    cursor.setUTCDate(cursor.getUTCDate() - (dow - 1));
  } else if (bucket === "month") {
    cursor.setUTCDate(1);
  }

  while (cursor <= toDate) {
    const key = ymd(cursor);
    const found = byBucket.get(key);
    const ex = extrasByBucket.get(key);
    const exGross = ex ? Number(ex.gross) : 0;
    const exFee = ex ? Number(ex.fee) : 0;
    filled.push({
      day: key,
      turnover: (found ? Number(found.turnover) : 0) + exGross,
      service_fee: found ? Number(found.service_fee) : 0,
      platform_fee: found ? Number(found.platform_fee) : 0,
      extras: exFee,
      revenue: (found ? Number(found.revenue) : 0) + exFee,
      count: found ? Number(found.count) : 0,
    });
    if (bucket === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (bucket === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return NextResponse.json({
    bucket,
    from: ymd(fromDate),
    to: ymd(toDate),
    rows: filled,
  });
}
