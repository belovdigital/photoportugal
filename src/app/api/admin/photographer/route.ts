import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Photographer ID required" }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if ("is_verified" in updates) {
      fields.push(`is_verified = $${paramIndex++}`);
      values.push(updates.is_verified);
    }
    if ("is_featured" in updates) {
      fields.push(`is_featured = $${paramIndex++}`);
      values.push(updates.is_featured);
    }
    if ("plan" in updates && ["free", "pro", "premium"].includes(updates.plan)) {
      fields.push(`plan = $${paramIndex++}`);
      values.push(updates.plan);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    values.push(id);
    await queryOne(
      `UPDATE photographer_profiles SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING id`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
