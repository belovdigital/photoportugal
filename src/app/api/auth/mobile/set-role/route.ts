import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { applyUserRole } from "@/lib/apply-user-role";
import jwt from "jsonwebtoken";

// POST { role: "photographer" | "client" } — the app's role-choice screen
// after a first OAuth sign-in (mobile Google/Apple create users as
// 'client' with no role question — the Lingyu case). Same rules as the
// web endpoint via lib/apply-user-role: fresh accounts pick freely,
// empty client accounts may become photographers.
// Returns a REFRESHED JWT so the app immediately routes into the right
// role group without a re-login.
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { role?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.role !== "photographer" && body.role !== "client") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const dbUser = await queryOne<{ email: string; name: string }>(
    "SELECT email, name FROM users WHERE id = $1", [user.id]
  );
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const result = await applyUserRole(dbUser.email, body.role, dbUser.name);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "not_allowed" }, { status: 403 });
    }
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });
    const token = jwt.sign(
      { id: user.id, email: dbUser.email, role: body.role },
      secret,
      { expiresIn: "30d" }
    );
    return NextResponse.json({ success: true, role: body.role, token });
  } catch (e) {
    console.error("[mobile/set-role] error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
