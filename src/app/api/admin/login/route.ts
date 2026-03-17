import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { queryOne } from "@/lib/db";
import crypto from "crypto";

function signToken(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

export function verifyToken(token: string): { email: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const parts = decoded.split(":");
    const hmac = parts.pop()!;
    const payload = parts.join(":");
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (hmac !== expected) return null;

    const [email, ts] = payload.split(":");
    const timestamp = parseInt(ts);
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return null;
    return { email, timestamp };
  } catch {
    return null;
  }
}

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

    const token = signToken(`${email}:${Date.now()}`);

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("[admin/login] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
