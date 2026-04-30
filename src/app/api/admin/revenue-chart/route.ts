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

  const rows = await query<{ bucket: string; turnover: string; revenue: string; count: string }>(
    `SELECT
        DATE_TRUNC($1, b.created_at)::date::text AS bucket,
        COALESCE(SUM(b.total_price), 0) AS turnover,
        COALESCE(SUM(CASE WHEN b.delivery_accepted = TRUE THEN b.platform_fee + b.service_fee ELSE 0 END), 0) AS revenue,
        COUNT(*) AS count
       FROM bookings b
      WHERE b.payment_status = 'paid'
        AND b.created_at >= $2
        AND b.created_at <= $3
      GROUP BY DATE_TRUNC($1, b.created_at)
      ORDER BY bucket ASC`,
    [bucket, fromDate.toISOString(), toDate.toISOString()]
  );

  // Fill missing buckets so the chart has contiguous bars.
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const filled: { day: string; turnover: number; revenue: number; count: number }[] = [];
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
    filled.push({
      day: key,
      turnover: found ? Number(found.turnover) : 0,
      revenue: found ? Number(found.revenue) : 0,
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
