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

  const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);
  if (!ids?.length) return NextResponse.json({});

  const rows = await query<{ id: string; name: string }>(
    `SELECT pp.id, u.name FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ANY($1::uuid[])`,
    [ids]
  );

  const map: Record<string, string> = {};
  for (const r of rows) map[r.id] = r.name;
  return NextResponse.json(map);
}
