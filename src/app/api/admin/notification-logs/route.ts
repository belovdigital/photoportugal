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

  const channel = req.nextUrl.searchParams.get("channel") || "email";

  const logs = await query<{
    id: string; channel: string; recipient: string; event: string;
    status: string; error_code: string | null; created_at: string;
  }>(
    `SELECT id, channel, recipient, event, status, error_code, created_at
     FROM notification_logs
     WHERE channel = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [channel]
  );

  return NextResponse.json(logs);
}
