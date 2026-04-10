import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { encode } from "next-auth/jwt";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const user = await queryOne<{ id: string; email: string; name: string; role: string }>(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [user_id]
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Create a NextAuth JWT token for this user
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: "Auth secret not configured" }, { status: 500 });

    const salt = "__Secure-authjs.session-token";
    const token = await encode({
      token: {
        name: user.name,
        email: user.email,
        picture: null,
        sub: user.id,
        id: user.id,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      },
      secret,
      salt,
    });

    const response = NextResponse.json({ success: true, name: user.name, role: user.role });

    // Set the NextAuth session cookie (production uses __Secure- prefix)
    response.cookies.set(salt, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });

    return response;
  } catch (error) {
    console.error("[impersonate] error:", error);
    return NextResponse.json({ error: "Failed to impersonate" }, { status: 500 });
  }
}
