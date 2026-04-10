import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = req.nextUrl.searchParams.get("range") || "30";
  const days = Math.min(Number(range) || 30, 90);

  const rows = await query<{ day: string; revenue: string; count: string }>(
    `SELECT
       DATE(b.created_at) as day,
       COALESCE(SUM(b.total_price), 0) as revenue,
       COUNT(*) as count
     FROM bookings b
     WHERE b.created_at >= NOW() - INTERVAL '${days} days'
       AND b.status NOT IN ('cancelled', 'inquiry')
       AND b.total_price > 0
     GROUP BY DATE(b.created_at)
     ORDER BY day ASC`
  );

  return NextResponse.json(rows.map(r => ({
    day: r.day,
    revenue: Number(r.revenue),
    count: Number(r.count),
  })));
}
