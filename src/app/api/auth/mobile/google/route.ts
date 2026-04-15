import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendAdminNewClientNotification, sendWelcomeEmail } from "@/lib/email";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`mobile-google:${ip}`, 10, 60000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

      // Send welcome email for new mobile users (always clients on mobile)
      sendWelcomeEmail(googleUser.email, googleUser.name, "client").catch((err) => console.error("[auth/google] welcome email error:", err));
      sendAdminNewClientNotification(googleUser.name, googleUser.email).catch((err) => console.error("[auth/google] admin notification error:", err));
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`👤 <b>New Client (Google, mobile)</b>\n\n<b>Name:</b> ${googleUser.name}\n<b>Email:</b> ${googleUser.email}`, "clients");
      }).catch((err) => console.error("[auth/google] telegram error:", err));
      query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [user.id]).catch((err) => console.error("[auth/google] admin_notified update error:", err));
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
    console.error("[mobile/google] error:", error);
    return NextResponse.json({ error: "Google login failed" }, { status: 500 });
  }
}
