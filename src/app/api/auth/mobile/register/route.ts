import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Name, email and password required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
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
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id`,
      [name.trim(), firstName, lastName, email.toLowerCase().trim(), passwordHash, validRole]
    );

    if (!user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

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
      JWT_SECRET,
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
