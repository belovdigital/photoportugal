import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`reset-password:${ip}`, 3, 900_000)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find user with valid, non-expired token. Banned users can't reset
    // (the token match fails for them — same generic error, no ban leak).
    const user = await queryOne<{ id: string }>(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()
         AND COALESCE(is_banned, FALSE) = FALSE`,
      [token]
    );

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    // Completing a reset via a link we EMAILED them is ownership proof —
    // at least as strong as a verification click. Mark the email verified
    // so the subsequent login isn't rejected by the authorize() check.
    // (Without this, auto-created accounts — e.g. blind bookings — could
    // reset successfully and STILL be locked out with "verify your
    // email", a link that was never sent to them.)
    await queryOne(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           email_verified = TRUE
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/reset-password", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
