import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { queryOne } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

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
    const SUPPORTED_LOCALES = ["en", "pt", "de", "es", "fr"];
    const locale = SUPPORTED_LOCALES.includes(bodyLocale) ? bodyLocale : SUPPORTED_LOCALES.includes(acceptLocale || "") ? acceptLocale : "en";
    const firstName = (first_name || legacyName?.split(" ")[0] || "").trim();
    const lastName = (last_name || legacyName?.split(" ").slice(1).join(" ") || "").trim();
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
      const shortId = user.id.replace(/-/g, "").slice(0, 10);
      let slug = `p-${shortId}`;

      // Uniqueness check — append random chars if collision
      const existing_slug = await queryOne("SELECT id FROM photographer_profiles WHERE slug = $1", [slug]);
      if (existing_slug) {
        slug = `${slug}${crypto.randomBytes(2).toString("hex").slice(0, 3)}`;
      }

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
        earlyBirdTier = "early50";
        plan = "premium";
        earlyBirdExpires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      } else if (count < 85) {
        earlyBirdTier = "first50";
        plan = "pro";
        earlyBirdExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
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

      import("@/lib/email").then(({ sendWelcomeEmail }) => {
        sendWelcomeEmail(user.email, user.name, "client").catch(console.error);
      });

      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`👤 New client registered: ${user.name} (${user.email})`, "clients");
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, user, autoLogin: validRole === "client" });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
