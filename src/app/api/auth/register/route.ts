import { NextRequest, NextResponse } from "next/server";
import { capitalizeName } from "@/lib/format-name";
import { country } from "@/lib/country";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { queryOne } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";
import { defaultPhotographerSlug } from "@/lib/photographer-slug";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { first_name, last_name, name: legacyName, email, password, role, utm_source, utm_medium, utm_campaign, utm_term, locale: bodyLocale } = await req.json();
    // Capture locale: body > Accept-Language > 'en'
    const accept = req.headers.get("accept-language") || "";
    const acceptLocale = accept.match(/^([a-z]{2})/)?.[1];
    const SUPPORTED_LOCALES = country.locales as readonly string[];
    const locale = SUPPORTED_LOCALES.includes(bodyLocale) ? bodyLocale : SUPPORTED_LOCALES.includes(acceptLocale || "") ? acceptLocale : "en";
    // Plenty of people type their own name in lower case at signup; it is
    // then their name in the admin, in chat, in Telegram and at the top of
    // every email we send them.
    const firstName = capitalizeName(first_name || legacyName?.split(" ")[0] || "");
    const lastName = capitalizeName(last_name || legacyName?.split(" ").slice(1).join(" ") || "", { fragment: true });
    const name = lastName ? `${firstName} ${lastName}` : firstName;

    if (!firstName || !email || !password) {
      return NextResponse.json(
        { error: "First name, email, and password are required" },
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
      `INSERT INTO users (email, name, first_name, last_name, password_hash, role, utm_source, utm_medium, utm_campaign, utm_term, locale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, email, name, role`,
      [email, name, firstName, lastName, passwordHash, validRole, utm_source || null, utm_medium || null, utm_campaign || null, utm_term || null, locale]
    );

    // If photographer, create profile with early bird logic
    if (validRole === "photographer" && user) {
      // Readable from day one — see src/lib/photographer-slug.ts. The
      // machine slug is only a fallback now.
      const slug = await defaultPhotographerSlug(name, user.id);

      // Determine early bird tier
      const photographerCount = await queryOne<{ count: string; next_num: string }>(
        "SELECT COUNT(*) as count, COALESCE(MAX(registration_number), 0) + 1 as next_num FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.registration_number > 0 AND pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE"
      );
      const count = parseInt(photographerCount?.count || "0");
      const nextNumber = parseInt(photographerCount?.next_num || "1");

      let earlyBirdTier: string | null = null;
      let earlyBirdExpires: string | null = null;
      let isFounding = false;
      let plan = "free";

      if (count < 10) {
        earlyBirdTier = "founding";
        isFounding = true;
        plan = "premium";
      } else if (count < 35) {
        // Early bird now grants 3 years of Premium (was 6 months) as a thank
        // you after we closed the program — see WhatsApp announcement.
        earlyBirdTier = "early50";
        plan = "premium";
        earlyBirdExpires = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
      } else if (count < 100) {
        // First 100: spots 36–100, 6 months Premium free.
        earlyBirdTier = "first100";
        plan = "premium";
        earlyBirdExpires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      }

      await queryOne(
        `INSERT INTO photographer_profiles (user_id, slug, plan, is_founding, early_bird_tier, early_bird_expires_at, registration_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [user.id, slug, plan, isFounding, earlyBirdTier, earlyBirdExpires, nextNumber]
      );
    }

    // Create notification preferences (defaults: all enabled)
    if (user) {
      await queryOne(
        "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [user.id]
      );
    }

    if (user && validRole === "photographer") {
      // Photographers: require email verification
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await queryOne(
        "UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3 RETURNING id",
        [token, expires.toISOString(), user.id]
      );

      sendVerificationEmail(user.email, user.name, token).catch((err) =>
        console.error("Failed to send verification email:", err)
      );
    } else if (user && validRole === "client") {
      // Clients: mark as verified immediately, send welcome email + admin notification
      await queryOne(
        "UPDATE users SET email_verified = TRUE WHERE id = $1",
        [user.id]
      );

      // Queued, not sent: a photographer signup passes through here as a
      // client first, and the role flips seconds later.
      import("@/lib/notification-queue").then(({ enqueueClientWelcome }) =>
        enqueueClientWelcome(user.id, user.email, user.name)
      ).catch(console.error);

      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`👤 New client registered: ${user.name} (${user.email})`, "clients");
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, user, autoLogin: validRole === "client" });
  } catch (error) {
    console.error("Registration error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/register", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
