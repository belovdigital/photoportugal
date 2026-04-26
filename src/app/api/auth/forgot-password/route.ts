import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`forgot-password:${ip}`, 3, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Always return success to avoid revealing whether email exists
    const user = await queryOne<{ id: string; name: string }>(
      "SELECT id, name FROM users WHERE email = $1",
      [email]
    );

    if (user) {
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await queryOne(
        `UPDATE users
         SET password_reset_token = $1, password_reset_expires = $2
         WHERE id = $3`,
        [token, expires.toISOString(), user.id]
      );

      await sendPasswordResetEmail(email, user.name, token);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/forgot-password", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
