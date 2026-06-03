import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { requireStripe } from "@/lib/stripe";
import { consumeHold } from "@/lib/blind-booking/holds";

export const dynamic = "force-dynamic";

// POST /api/concierge/blind-booking/accept
//
// Public endpoint — no auth required. The visitor came in via the
// Concierge chat, the LLM emitted offer_blind_booking, and now they
// clicked "Yes, book it" on the inline card. We:
//   1. Consume the in-memory hold (5-min TTL from chat)
//   2. Find-or-create a user from { email, name, phone }
//   3. INSERT a booking with photographer_id=NULL, status='unmatched',
//      blind_booking=TRUE
//   4. Create a Stripe Checkout Session with capture_method=manual
//      (auth-hold only — captured when admin assigns a photographer)
//   5. Return { booking_id, checkout_url }
//
// The visitor reaches their dashboard later by clicking "View booking"
// in the confirmation email and resetting their password (no signup
// friction during the flow).
export async function POST(req: NextRequest) {
  try {
    // Rate limit — this endpoint creates a user + booking + Stripe
    // customer + Checkout Session each call. Without limits it's a
    // DoS / spam vector (audit finding #7).
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "anonymous";
    if (!checkRateLimit(`blind-accept:ip:${ip}`, 5, 60_000)) {
      return NextResponse.json(
        { error: "Too many booking attempts from this network. Try again in a minute." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
    }
    const holdId = String(body.hold_id || "").trim();
    const chatId = String(body.chat_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 100);
    const phone = String(body.phone || "").trim().slice(0, 30);
    const meetingHint = String(body.meeting_hint || "").trim().slice(0, 500);
    const rawLocale = typeof body.locale === "string" ? body.locale : "";
    const locale: "pt" | "de" | "es" | "fr" | "en" =
      rawLocale === "pt" || rawLocale === "de" || rawLocale === "es" || rawLocale === "fr"
        ? rawLocale
        : "en";

    // Per-email rate limit too — different IPs hitting the same email
    // is still spam (e.g. botnet).
    if (email && !checkRateLimit(`blind-accept:email:${email}`, 3, 60_000)) {
      return NextResponse.json(
        { error: "Too many booking attempts for this email. Try again in a minute." },
        { status: 429 }
      );
    }

    if (!holdId) {
      return NextResponse.json({ error: "Missing hold_id" }, { status: 400 });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      return NextResponse.json({ error: "Valid phone required" }, { status: 400 });
    }

    const hold = consumeHold(holdId);
    if (!hold) {
      return NextResponse.json(
        { error: "This booking offer has expired. Please ask again in chat." },
        { status: 410 }
      );
    }

    // Bind hold to the chat that minted it. If the chat had a real ID,
    // the request must echo the same chat_id back — otherwise a leaked
    // hold_id (logs, screenshot) could be claimed by anyone (audit
    // finding #8). Anonymous holds (chat_id === "anonymous") accept
    // any chat_id since there's nothing to bind against.
    if (hold.chat_id !== "anonymous" && hold.chat_id !== chatId) {
      return NextResponse.json(
        { error: "This booking offer was not issued for this session." },
        { status: 403 }
      );
    }

    // Defence-in-depth: even if chat-route validated the date, the
    // hold could have been minted hours ago — re-check the date is
    // still in the future before charging the card.
    {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (new Date(hold.date + "T00:00:00Z") < today) {
        return NextResponse.json(
          { error: "Shoot date is in the past — please ask the concierge for a new date." },
          { status: 410 }
        );
      }
    }

    // Find or create user. Existing email → reuse (they'll log in later
    // to manage). New email → random password, welcome email triggers
    // a separate "set your password" link.
    let user = await queryOne<{ id: string; email: string; name: string }>(
      "SELECT id, email, name FROM users WHERE email = $1",
      [email]
    );
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const passwordHash = await hash(randomPassword, 12);
      const firstName = name.split(" ")[0] || name;
      const lastName = name.split(" ").slice(1).join(" ") || null;
      user = await queryOne<{ id: string; email: string; name: string }>(
        `INSERT INTO users (email, name, first_name, last_name, password_hash, role, phone, locale)
         VALUES ($1, $2, $3, $4, $5, 'client', $6, $7)
         RETURNING id, email, name`,
        [email, name, firstName, lastName, passwordHash, phone, locale]
      );
      if (!user) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }
    } else {
      // Refresh phone if blank — visitor just gave us a current one.
      await queryOne(
        `UPDATE users SET phone = COALESCE(NULLIF(phone, ''), $1) WHERE id = $2 RETURNING id`,
        [phone, user.id]
      );
    }

    // Build the booking message — combine meeting hint with origin trail.
    const message = meetingHint
      ? `[Blind booking via Concierge] Meeting hint: ${meetingHint}`
      : `[Blind booking via Concierge]`;

    // INSERT booking — photographer_id NULL, status='unmatched',
    // blind_booking=TRUE. Region goes into location_slug so existing
    // admin views & emails surface it.
    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (
         client_id, photographer_id, location_slug, shoot_date,
         group_size, occasion, message, total_price, status,
         blind_booking, utm_source, utm_medium
       ) VALUES (
         $1, NULL, $2, $3, $4, $5, $6, $7, 'unmatched',
         TRUE, 'concierge', 'blind_booking'
       ) RETURNING id`,
      [
        user.id,
        hold.region,
        hold.date,
        hold.party_size,
        hold.occasion,
        message,
        hold.price_eur,
      ]
    );

    if (!booking) {
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }

    // Stripe Checkout — capture_method=manual. We charge €price_eur
    // straight (no service fee added on top — blind price IS the
    // all-in price the visitor saw on the card).
    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
    const localePrefix = locale !== "en" ? `/${locale}` : "";

    // Get or create Stripe customer
    let customerId: string | null = null;
    const customerRow = await queryOne<{ stripe_customer_id: string | null }>(
      "SELECT stripe_customer_id FROM users WHERE id = $1",
      [user.id]
    );
    customerId = customerRow?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await requireStripe().customers.create({
        email: user.email,
        name: user.name,
        phone,
        metadata: { user_id: user.id, source: "blind_booking" },
      });
      customerId = customer.id;
      await queryOne(
        "UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id",
        [customerId, user.id]
      );
    }

    const session = await requireStripe().checkout.sessions.create(
      {
        customer: customerId,
        mode: "payment",
        locale: locale === "en" ? "auto" : (locale as "pt" | "de" | "es" | "fr"),
        adaptive_pricing: { enabled: true },
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Photo Portugal photoshoot — handpicked photographer",
                description: `${hold.region.replace(/-/g, " ")} · ${hold.duration_minutes} min · ${hold.occasion} · ${hold.date}. Authorised now, charged only when your photographer is confirmed (within 24h). Auto-refund otherwise.`,
              },
              unit_amount: hold.price_eur * 100,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          capture_method: "manual",
          metadata: {
            booking_id: booking.id,
            blind_booking: "1",
            region: hold.region,
            occasion: hold.occasion,
            date: hold.date,
          },
        },
        success_url: `${BASE_URL}${localePrefix}/dashboard/bookings?payment=success&booking=${booking.id}&blind=1`,
        cancel_url: `${BASE_URL}${localePrefix}/concierge?blind_cancelled=1`,
        metadata: {
          booking_id: booking.id,
          type: "booking",
          blind_booking: "1",
        },
      },
      { idempotencyKey: `blind_${booking.id}` }
    );

    // Fire-and-forget welcome email if new user — they'll need to
    // reset password to actually log in later. Errors don't block.
    if (isNewUser) {
      import("@/lib/email").then(({ sendEmail }) =>
        sendEmail(
          email,
          "Welcome to Photo Portugal — your booking is being processed",
          `<div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
            <h2 style="color: #C94536;">Welcome, ${(name.split(" ")[0] || name)
              .replace(/[<>]/g, "")}!</h2>
            <p>We've received your booking request. Our team is hand-picking the right photographer for you and will confirm within 24 hours.</p>
            <p>To access your booking dashboard, you'll need to set a password — click the link below:</p>
            <p><a href="${BASE_URL}${localePrefix}/auth/forgot-password?email=${encodeURIComponent(email)}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Set your password</a></p>
            <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch((err: unknown) => console.error("[blind-booking/accept] welcome email error:", err))
      );
    }

    return NextResponse.json({
      booking_id: booking.id,
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("[concierge/blind-booking/accept] error:", err);
    try {
      const { logServerError } = await import("@/lib/error-logger");
      await logServerError(err, { path: "/api/concierge/blind-booking/accept", method: "POST", statusCode: 500 });
    } catch {}
    return NextResponse.json({ error: "Could not process your booking" }, { status: 500 });
  }
}
