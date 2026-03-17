import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const userId = (session.user as { id?: string }).id;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Photographer ID required" }, { status: 400 });
    }

    // Build dynamic update query
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
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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
