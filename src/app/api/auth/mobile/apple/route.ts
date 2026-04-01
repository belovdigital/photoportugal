import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";
import { checkRateLimit } from "@/lib/rate-limit";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return s;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`mobile-apple:${ip}`, 10, 60000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { identityToken, fullName, email: clientEmail } = await req.json();

    if (!identityToken) {
      return NextResponse.json({ error: "Identity token required" }, { status: 400 });
    }

    // Decode the Apple identity token (JWT) to get user info
    // Apple tokens are signed JWTs - we decode to get sub (Apple user ID) and email
    const decoded = jwt.decode(identityToken) as {
      sub: string; // Apple user ID
      email?: string;
      email_verified?: string;
      iss?: string;
    } | null;

    if (!decoded?.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // Verify issuer
    if (decoded.iss !== "https://appleid.apple.com") {
      return NextResponse.json({ error: "Invalid token issuer" }, { status: 400 });
    }

    const appleId = decoded.sub;
    const email = decoded.email || clientEmail;

    // Build name from fullName (Apple only sends name on FIRST sign-in)
    let name = "Apple User";
    if (fullName) {
      const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
      if (parts.length > 0) name = parts.join(" ");
    }

    // Check if user exists by apple_id
    let user = await queryOne<{ id: string; email: string; name: string; role: string; is_banned: boolean }>(
      "SELECT id, email, name, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE apple_id = $1",
      [appleId]
    );

    if (!user && email) {
      // Check by email
      user = await queryOne<{ id: string; email: string; name: string; role: string; is_banned: boolean }>(
        "SELECT id, email, name, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE email = $1",
        [email.toLowerCase()]
      );
      if (user) {
        // Link Apple ID to existing account
        await queryOne("UPDATE users SET apple_id = $1 WHERE id = $2", [appleId, user.id]);
      }
    }

    if (user?.is_banned) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    if (!user) {
      // Create new user
      if (!email) {
        return NextResponse.json({ error: "Email required for new account" }, { status: 400 });
      }

      const nameParts = name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || null;

      user = await queryOne<{ id: string; email: string; name: string; role: string; is_banned: boolean }>(
        `INSERT INTO users (name, first_name, last_name, email, apple_id, role, email_verified)
         VALUES ($1, $2, $3, $4, $5, 'client', TRUE)
         RETURNING id, email, name, role, FALSE as is_banned`,
        [name, firstName, lastName, email.toLowerCase(), appleId]
      );

      if (!user) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }

      // Create notification preferences
      await queryOne(
        "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [user.id]
      );
    }

    // Update name if we have it and current is "Apple User"
    if (name !== "Apple User" && user.name === "Apple User") {
      await queryOne("UPDATE users SET name = $1 WHERE id = $2", [name, user.id]);
      user.name = name;
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
        avatar_url: null,
        isNew: !user.role || user.role === "client",
      },
    });
  } catch (error) {
    console.error("[mobile/apple] error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
