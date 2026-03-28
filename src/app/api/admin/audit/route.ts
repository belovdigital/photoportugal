import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET — fetch audit log
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await query<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_name: string | null;
    details: string | null;
    admin_email: string;
    created_at: string;
  }>("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 200");

  return NextResponse.json(logs);
}

// POST — log an action (called internally)
export async function POST(req: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, entity_type, entity_id, entity_name, details } = await req.json();

  await queryOne(
    `INSERT INTO admin_audit_log (action, entity_type, entity_id, entity_name, details, admin_email)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [action, entity_type, entity_id || null, entity_name || null, details || null, admin.email]
  );

  return NextResponse.json({ ok: true });
}
