import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
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

    // Create photographer profile with early bird tier (same logic as web set-role)
    if (validRole === "photographer") {
      const slug = `p-${user.id.replace(/-/g, "").slice(0, 10)}`;
      await withTransaction(async (client) => {
        await client.query("LOCK TABLE photographer_profiles IN EXCLUSIVE MODE");
        const countResult = await client.query(
          "SELECT COUNT(*) as count, COALESCE(MAX(registration_number), 0) + 1 as next_num FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.registration_number > 0 AND pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE"
        );
        const row = countResult.rows[0] as { count: string; next_num: string };
        const count = parseInt(row?.count || "0");
        const nextNumber = parseInt(row?.next_num || "1");

        let earlyBirdTier: string | null = null;
        let earlyBirdExpires: string | null = null;
        let isFounding = false;
        let plan = "free";

        if (count < 10) {
          earlyBirdTier = "founding";
          isFounding = true;
          plan = "premium";
        } else if (count < 35) {
          earlyBirdTier = "early50";
          plan = "premium";
          earlyBirdExpires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
        } else if (count < 85) {
          earlyBirdTier = "first50";
          plan = "pro";
          earlyBirdExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }

        await client.query(
          `INSERT INTO photographer_profiles (user_id, slug, plan, is_founding, early_bird_tier, early_bird_expires_at, registration_number, bio, languages, shoot_types)
           VALUES ($1, $2, $3, $4, $5, $6, $7, '', '{}', '{}')
           ON CONFLICT (user_id) DO NOTHING`,
          [user.id, slug, plan, isFounding, earlyBirdTier, earlyBirdExpires, nextNumber]
        );
      });
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
