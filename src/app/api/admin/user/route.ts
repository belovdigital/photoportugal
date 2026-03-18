import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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
    const { id, is_banned } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    if (typeof is_banned !== "boolean") {
      return NextResponse.json({ error: "is_banned must be a boolean" }, { status: 400 });
    }

    // Don't allow banning admins
    const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [id]);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.role === "admin") {
      return NextResponse.json({ error: "Cannot ban admin users" }, { status: 400 });
    }

    await queryOne(
      "UPDATE users SET is_banned = $1 WHERE id = $2 RETURNING id",
      [is_banned, id]
    );

    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] user update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
