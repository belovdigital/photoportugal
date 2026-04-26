import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

const VALID_STATUSES = ["booked", "expired"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status. Must be 'booked' or 'expired'." }, { status: 400 });
  }

  try {
    const result = await queryOne<{ id: string }>(
      "UPDATE match_requests SET status = $1 WHERE id = $2 RETURNING id",
      [status, id]
    );

    if (!result) return NextResponse.json({ error: "Match request not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/match-request/status] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/match-request/:id/status", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
