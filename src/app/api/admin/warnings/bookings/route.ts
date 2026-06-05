import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

// Tiny helper for IssueWarningModal — last 50 bookings for a given
// photographer so admin can optionally link the warning to a concrete
// booking. Admin-only.
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const photographerId = (req.nextUrl.searchParams.get("photographer_id") || "").trim();
  if (!photographerId) {
    return NextResponse.json({ error: "photographer_id required" }, { status: 400 });
  }

  const bookings = await query<{
    id: string;
    shoot_date: string | null;
    client_name: string;
    status: string;
  }>(
    `SELECT b.id, b.shoot_date::text, cu.name AS client_name, b.status::text AS status
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
      WHERE b.photographer_id = $1
      ORDER BY b.created_at DESC
      LIMIT 50`,
    [photographerId]
  );

  return NextResponse.json({ bookings });
}
