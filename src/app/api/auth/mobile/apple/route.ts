import { NextRequest, NextResponse } from "next/server";
import { capitalizeName } from "@/lib/format-name";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendAdminNewClientNotification } from "@/lib/email";
import { verifyAppleIdentityToken, OAuthTokenInvalid } from "@/lib/mobile-oauth";

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

    // Cryptographically verify the token against Apple's public keys —
    // signature, issuer, audience (our bundle id) and expiry. Anything that
    // fails is a forgery or a token minted for another app; either way it must
    // not reach the account lookup below, which trusts `sub`/`email`.
    let decoded;
    try {
      decoded = await verifyAppleIdentityToken(identityToken);
    } catch (err) {
      if (err instanceof OAuthTokenInvalid) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw err;
    }

    const appleId = decoded.sub;
    // Only adopt the token's email when Apple says it verified it. An
    // unverified email must never match an existing account by email below —
    // that is the link-to-anyone path the signature check now closes, and
    // this keeps it closed for the edge where Apple omits verification.
    const tokenEmail = decoded.email_verified ? decoded.email : undefined;
    const email = tokenEmail || clientEmail;

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

    if (!user && tokenEmail) {
      // Link to an existing account ONLY on the email Apple itself verified —
      // never on `clientEmail`, which the app sends unverified. Matching an
      // existing account on a caller-supplied address and attaching this
      // apple_id to it is exactly the takeover the signature check closes;
      // using `email` (which falls back to clientEmail) here would leave a
      // narrower version of it open for tokens whose email_verified is false.
      user = await queryOne<{ id: string; email: string; name: string; role: string; is_banned: boolean }>(
        "SELECT id, email, name, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE email = $1",
        [tokenEmail.toLowerCase()]
      );
      if (user) {
        await queryOne("UPDATE users SET apple_id = $1 WHERE id = $2", [appleId, user.id]);
      }
    }

    if (user?.is_banned) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    let isNew = false;
    if (!user) {
      isNew = true;
      // Create new user (role defaults to client — the app shows the
      // role-choice screen when is_new=true)
      if (!email) {
        return NextResponse.json({ error: "Email required for new account" }, { status: 400 });
      }

      name = capitalizeName(name) || name;
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

      // Notify admin + queue the welcome (held in case the role changes)
      import("@/lib/notification-queue").then(({ enqueueClientWelcome }) =>
        enqueueClientWelcome(user!.id, email.toLowerCase(), name)
      ).catch((err) => console.error("[auth/apple] welcome queue error:", err));
      sendAdminNewClientNotification(name, email.toLowerCase()).catch((err) => console.error("[auth/apple] admin notification error:", err));
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`👤 <b>New Client (Apple, app)</b>\n\n<b>Name:</b> ${name}\n<b>Email:</b> ${email}`, "clients");
      }).catch((err) => console.error("[auth/apple] telegram error:", err));
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
      is_new: isNew,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: null,
        // Was `!user.role || role === "client"` — that misread EVERY
        // existing client as new. Now true only on actual creation.
        isNew,
      },
    });
  } catch (error) {
    console.error("[mobile/apple] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/mobile/apple", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
