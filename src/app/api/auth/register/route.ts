import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const validRole = role === "photographer" ? "photographer" : "client";

    // Check if user exists
    const existing = await queryOne(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await queryOne<{ id: string; email: string; name: string; role: string }>(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, name, passwordHash, validRole]
    );

    // If photographer, create empty profile
    if (validRole === "photographer" && user) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await queryOne(
        `INSERT INTO photographer_profiles (user_id, slug, display_name)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [user.id, slug + "-" + user.id.slice(0, 4), name]
      );
    }

    // Send welcome email (non-blocking)
    if (user) {
      sendWelcomeEmail(user.email, user.name, user.role as "client" | "photographer").catch((err) =>
        console.error("Failed to send welcome email:", err)
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
