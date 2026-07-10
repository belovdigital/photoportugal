import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  if (!decoded?.email) return false;
  const row = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 AND role = 'admin'",
    [decoded.email]
  );
  return !!row;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const inquiries = await query(
    `SELECT bi.*, pp.slug as photographer_slug, pp.display_name as photographer_name
     FROM business_inquiries bi
     LEFT JOIN photographer_profiles pp ON pp.id = bi.photographer_id
     ORDER BY bi.created_at DESC
     LIMIT 200`
  );
  return NextResponse.json({ inquiries });
}

const VALID_STATUSES = ["new", "in_progress", "quoted", "won", "lost"];

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, status, admin_notes } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const updated = await queryOne(
    `UPDATE business_inquiries
     SET status = COALESCE($2, status),
         admin_notes = COALESCE($3, admin_notes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status ?? null, admin_notes ?? null]
  );
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ inquiry: updated });
}
