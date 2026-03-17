import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await queryOne<{ id: string; password_hash: string; role: string }>(
      "SELECT id, password_hash, role FROM users WHERE email = $1",
      [email]
    );

    if (!user || !user.password_hash || user.role !== "admin") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const match = await compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create admin token (base64 of email:timestamp)
    const token = Buffer.from(`${email}:${Date.now()}`).toString("base64");

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("[admin/login] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
