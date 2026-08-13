import { NextRequest, NextResponse } from "next/server";
import { capitalizeName } from "@/lib/format-name";
import { query, queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendAdminNewClientNotification } from "@/lib/email";
import { verifyGoogleIdToken, OAuthTokenInvalid } from "@/lib/mobile-oauth";

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
    const { id_token, secondary_market } = await req.json();

    if (!id_token) {
      return NextResponse.json({ error: "Google ID token required" }, { status: 400 });
    }

    // Verify the token locally against Google's public keys, checking the
    // audience is one of OUR client ids. The previous `tokeninfo` call proved
    // the token was signed by Google but not that it was issued for this app —
    // so a valid Google id_token minted for any other app in the world was
    // accepted, and its `sub`/`email` trusted to find or create an account.
    let claims;
    try {
      claims = await verifyGoogleIdToken(id_token);
    } catch (err) {
      if (err instanceof OAuthTokenInvalid) {
        return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
      }
      throw err;
    }

    const googleUser = {
      sub: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified,
      // Google omits `name` for some accounts; fall back so downstream
      // .split(" ") never throws.
      name: claims.name || claims.email.split("@")[0],
      picture: claims.picture || "",
      given_name: claims.given_name,
      family_name: claims.family_name,
    };

    // Match by google_id first — that only ever matches an account that has
    // already linked THIS Google sub, so it is safe even for an unverified
    // token. Fall back to email ONLY when Google verified the address.
    //
    // Google signs id_tokens with email_verified=false for accounts on a
    // Workspace domain whose ownership was never proven, and it lets you
    // create those accounts before proving it — so matching a pre-existing
    // account on an unverified address would hand anyone that address's
    // account with a single request. This is the Google twin of the Apple
    // gate: link on an email only if the provider says it verified it.
    let user = await queryOne<{ id: string; email: string; name: string; role: string; avatar_url: string | null }>(
      "SELECT id, email, name, role, avatar_url FROM users WHERE google_id = $1",
      [googleUser.sub]
    );
    if (!user && googleUser.email_verified) {
      user = await queryOne<{ id: string; email: string; name: string; role: string; avatar_url: string | null }>(
        "SELECT id, email, name, role, avatar_url FROM users WHERE email = $1",
        [googleUser.email]
      );
    }

    // Upgrade Google's default 96-pixel avatar to a 500-pixel version so
    // it doesn't look pixelated when we zoom or show it large.
    const { normalizeAvatarUrl } = await import("@/lib/avatar-url");
    const avatarUrl = normalizeAvatarUrl(googleUser.picture || null);

    let isNew = false;
    if (!user) {
      isNew = true;
      // Create new user (default: client — the app shows a role-choice
      // screen right after when is_new=true; picking Photographer calls
      // /api/auth/mobile/set-role within the 5-minute fresh window)
      const newUser = await queryOne<{ id: string }>(
        `INSERT INTO users (name, first_name, last_name, email, google_id, avatar_url, role, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, 'client', $7)
         RETURNING id`,
        [
          capitalizeName(googleUser.name),
          capitalizeName(googleUser.given_name || googleUser.name.split(" ")[0]),
          googleUser.family_name ? capitalizeName(googleUser.family_name, { fragment: true }) : null,
          googleUser.email,
          googleUser.sub,
          avatarUrl,
          // Write the real claim, not a hardcoded TRUE — an unverified Google
          // address must not be stamped verified in our own database, where a
          // later email-based link would then trust it.
          googleUser.email_verified,
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
        avatar_url: avatarUrl,
      };

      // `secondary_market` means the app is giving an EXISTING client of
      // another country a session here so they can book abroad. It is the same
      // person, already welcomed and already counted — announcing them again
      // would send one human three welcome emails and three Telegram pings,
      // and would inflate every new-client number by the number of countries
      // they browse.
      if (!secondary_market) {
        // Queued like every other client welcome — an app signup can still turn
        // into a photographer account on the web ten minutes later.
        import("@/lib/notification-queue").then(({ enqueueClientWelcome }) =>
          enqueueClientWelcome(newUser.id, googleUser.email, googleUser.name)
        ).catch((err) => console.error("[auth/google] welcome queue error:", err));
        sendAdminNewClientNotification(googleUser.name, googleUser.email).catch((err) => console.error("[auth/google] admin notification error:", err));
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`👤 <b>New Client (Google, app)</b>\n\n<b>Name:</b> ${googleUser.name}\n<b>Email:</b> ${googleUser.email}`, "clients");
        }).catch((err) => console.error("[auth/google] telegram error:", err));
      }
      query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [user.id]).catch((err) => console.error("[auth/google] admin_notified update error:", err));
    } else {
      // Update google_id and avatar if missing
      await queryOne(
        "UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2) WHERE id = $3",
        [googleUser.sub, avatarUrl, user.id]
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
      is_new: isNew,
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
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/mobile/google", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Google login failed" }, { status: 500 });
  }
}
