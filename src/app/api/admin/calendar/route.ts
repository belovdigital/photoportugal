import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const c = await cookies();
  const token = c.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];

  // Photoshoots (shoot_date within range)
  const shoots = await query<{
    id: string;
    shoot_date: string;
    status: string;
    payment_status: string;
    total_price: number | null;
    client_name: string;
    photographer_name: string;
    package_name: string | null;
  }>(
    `SELECT b.id, b.shoot_date::text, b.status, b.payment_status, b.total_price,
            cu.name as client_name, pu.name as photographer_name,
            p.name as package_name
     FROM bookings b
     JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.shoot_date IS NOT NULL
       AND b.shoot_date >= $1::date
       AND b.shoot_date <= $2::date
       AND b.status IN ('confirmed', 'completed', 'delivered')
     ORDER BY b.shoot_date`,
    [from, to]
  );

  // Delivery deadlines (completed bookings where delivery is expected)
  const deliveries = await query<{
    id: string;
    due_date: string;
    status: string;
    client_name: string;
    photographer_name: string;
    has_delivery: boolean;
  }>(
    `SELECT b.id,
            (b.updated_at + COALESCE(p.delivery_days, 7) * INTERVAL '1 day')::date::text as due_date,
            b.status,
            cu.name as client_name, pu.name as photographer_name,
            (b.delivery_token IS NOT NULL) as has_delivery
     FROM bookings b
     JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.status = 'completed'
       AND b.delivery_token IS NULL
       AND (b.updated_at + COALESCE(p.delivery_days, 7) * INTERVAL '1 day')::date >= $1::date
       AND (b.updated_at + COALESCE(p.delivery_days, 7) * INTERVAL '1 day')::date <= $2::date
     ORDER BY due_date`,
    [from, to]
  );

  return NextResponse.json({ shoots, deliveries });
}
