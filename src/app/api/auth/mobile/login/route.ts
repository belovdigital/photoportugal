import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { checkRateLimit } from "@/lib/rate-limit";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    if (!checkRateLimit(`mobile-login:${email.toLowerCase().trim()}`, 10, 60000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const user = await queryOne<{
      id: string; email: string; name: string; role: string;
      avatar_url: string | null; password_hash: string | null;
      is_banned: boolean; email_verified: boolean;
    }>(
      `SELECT id, email, name, role, avatar_url, password_hash,
              COALESCE(is_banned, FALSE) as is_banned,
              COALESCE(email_verified, FALSE) as email_verified
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Always run a bcrypt compare — against the real hash, or a throwaway one
    // when the account is absent or OAuth-only — so response time does not
    // reveal which case it is. Previously an absent account and an
    // OAuth-account answered before any hashing, and the banned/verify checks
    // fired before the password was even checked, so an unauthenticated caller
    // could enumerate which emails exist, use Google, or are banned.
    const DUMMY_HASH = "$2b$10$JrjzIQc7TjXCcfVNNZ0pdeFWUlG/20bD3f82c1DrZL0EBpf.M/VuG";
    const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);

    if (!user || !user.password_hash || !valid) {
      // One answer for absent / OAuth-only / wrong-password. The sign-in
      // screen's recovery card after repeated failures covers the "you have a
      // Google account" case without leaking it to an anonymous prober.
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // The credential is now proven, so revealing account state is safe.
    if (user.is_banned) {
      return NextResponse.json({ error: "Account is suspended" }, { status: 403 });
    }
    if (!user.email_verified) {
      return NextResponse.json({ error: "Please verify your email first" }, { status: 403 });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("[mobile/login] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/mobile/login", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
