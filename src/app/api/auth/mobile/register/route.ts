import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`mobile-register:${ip}`, 5, 60000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { name, email, password, role } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Name, email and password required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const validRole = role === "photographer" ? "photographer" : "client";

    // Check if email already exists
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || null;

    const user = await queryOne<{ id: string }>(
      `INSERT INTO users (name, first_name, last_name, email, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING id`,
      [name.trim(), firstName, lastName, email.toLowerCase().trim(), passwordHash, validRole]
    );

    if (!user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Send email verification
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await queryOne(
      "UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3",
      [verificationToken, verificationExpires.toISOString(), user.id]
    );
    sendVerificationEmail(email.toLowerCase().trim(), name.trim(), verificationToken + "&source=mobile").catch(err =>
      console.error("[mobile/register] verification email error:", err)
    );

    // Create photographer profile if needed
    if (validRole === "photographer") {
      const slug = `p-${user.id.slice(0, 7)}`;
      await queryOne(
        `INSERT INTO photographer_profiles (user_id, slug, bio, languages, shoot_types)
         VALUES ($1, $2, '', '{}', '{}')`,
        [user.id, slug]
      );
    }

    // Create notification preferences
    await queryOne(
      "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, email: email.toLowerCase().trim(), role: validRole },
      getJwtSecret(),
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role: validRole,
        avatar_url: null,
      },
    });
  } catch (error) {
    console.error("[mobile/register] error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
