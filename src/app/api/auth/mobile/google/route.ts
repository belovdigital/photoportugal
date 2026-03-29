import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

export async function POST(req: NextRequest) {
  try {
    const { id_token } = await req.json();

    if (!id_token) {
      return NextResponse.json({ error: "Google ID token required" }, { status: 400 });
    }

    // Verify Google ID token
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
    if (!googleRes.ok) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const googleUser = await googleRes.json() as {
      sub: string; email: string; name: string; picture: string;
      given_name?: string; family_name?: string;
    };

    if (!googleUser.email) {
      return NextResponse.json({ error: "No email in Google token" }, { status: 400 });
    }

    // Find or create user
    let user = await queryOne<{ id: string; email: string; name: string; role: string; avatar_url: string | null }>(
      "SELECT id, email, name, role, avatar_url FROM users WHERE email = $1 OR google_id = $2",
      [googleUser.email, googleUser.sub]
    );

    if (!user) {
      // Create new user (default: client)
      const newUser = await queryOne<{ id: string }>(
        `INSERT INTO users (name, first_name, last_name, email, google_id, avatar_url, role, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, 'client', TRUE)
         RETURNING id`,
        [
          googleUser.name,
          googleUser.given_name || googleUser.name.split(" ")[0],
          googleUser.family_name || null,
          googleUser.email,
          googleUser.sub,
          googleUser.picture || null,
        ]
      );

      if (!newUser) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }

      // Create notification preferences
      await queryOne(
        "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [newUser.id]
      );

      user = {
        id: newUser.id,
        email: googleUser.email,
        name: googleUser.name,
        role: "client",
        avatar_url: googleUser.picture || null,
      };
    } else {
      // Update google_id and avatar if missing
      await queryOne(
        "UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2) WHERE id = $3",
        [googleUser.sub, googleUser.picture || null, user.id]
      );
    }

    // Check ban
    const banCheck = await queryOne<{ is_banned: boolean }>(
      "SELECT COALESCE(is_banned, FALSE) as is_banned FROM users WHERE id = $1",
      [user.id]
    );
    if (banCheck?.is_banned) {
      return NextResponse.json({ error: "Account is suspended" }, { status: 403 });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
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
    console.error("[mobile/google] error:", error);
    return NextResponse.json({ error: "Google login failed" }, { status: 500 });
  }
}
