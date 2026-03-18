import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
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

    // Find user with valid, non-expired token
    const user = await queryOne<{ id: string }>(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()`,
      [token]
    );

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    await queryOne(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
