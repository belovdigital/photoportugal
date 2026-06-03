import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { requireStripe, SERVICE_FEE_RATE } from "@/lib/stripe";
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
    // Two input modes:
    //  1. Concierge AI path — body has { hold_id, chat_id }; we
    //     consume the in-memory hold for region/occasion/date/etc.
    //  2. Direct modal path — body has raw fields { region, occasion,
    //     date, duration_minutes, party_size }; we price server-side.
    // Both modes require the contact triple (name/email/phone).
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

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      return NextResponse.json({ error: "Valid phone required" }, { status: 400 });
    }

    // Resolve booking parameters from either mode.
    type ResolvedOffer = {
      region: string;
      date: string;
      occasion: string;
      party_size: number;
      duration_minutes: number;
      price_eur: number;
    };
    let hold: ResolvedOffer;

    if (holdId) {
      const fromMem = consumeHold(holdId);
      if (!fromMem) {
        return NextResponse.json(
          { error: "This booking offer has expired. Please ask again in chat." },
          { status: 410 }
        );
      }
      // Bind hold to the chat that minted it. Anonymous holds accept
      // any chat_id since there's nothing to bind against.
      if (fromMem.chat_id !== "anonymous" && fromMem.chat_id !== chatId) {
        return NextResponse.json(
          { error: "This booking offer was not issued for this session." },
          { status: 403 }
        );
      }
      hold = {
        region: fromMem.region,
        date: fromMem.date,
        occasion: fromMem.occasion,
        party_size: fromMem.party_size,
        duration_minutes: fromMem.duration_minutes,
        price_eur: fromMem.price_eur,
      };
    } else {
      // Direct modal path — validate raw inputs + price server-side.
      const region = String(body.region || "").trim().toLowerCase();
      const date = String(body.date || "").trim();
      const occasion = String(body.occasion || "").trim().toLowerCase();
      const partySize = Number(body.party_size);
      const durationMinutes = Number(body.duration_minutes) || 60;
      if (!region || !occasion) {
        return NextResponse.json({ error: "Region and occasion required" }, { status: 400 });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
      }
      if (!Number.isFinite(partySize) || partySize < 1 || partySize > 30) {
        return NextResponse.json({ error: "Party size must be 1-30" }, { status: 400 });
      }
      if (![60, 120, 180].includes(durationMinutes)) {
        return NextResponse.json({ error: "Duration must be 60, 120, or 180 minutes" }, { status: 400 });
      }
      const { priceForSlug, slugToRegion } = await import("@/lib/blind-booking/pricing");
      const priced = await priceForSlug(region, occasion, durationMinutes);
      const canonicalRegion = slugToRegion(region);
      if (!priced || !canonicalRegion) {
        return NextResponse.json(
          { error: "Sorry, blind booking isn't available for this region/occasion combination yet." },
          { status: 400 }
        );
      }
      hold = {
        region: canonicalRegion,
        date,
        occasion,
        party_size: partySize,
        duration_minutes: priced.duration_minutes,
        price_eur: priced.price_eur,
      };
    }

    // Defence-in-depth: re-check the date is in the future for both
    // paths (hold may have been minted hours ago; raw input could lie).
    {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (new Date(hold.date + "T00:00:00Z") < today) {
        return NextResponse.json(
          { error: "Shoot date is in the past — pick a future date." },
          { status: 400 }
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

    // INSERT booking — status='confirmed' + photographer_id=NULL.
    // The combination "confirmed + no photographer" IS the marker for
    // "blind booking awaiting admin assignment" — no separate enum
    // value needed (refactor 2026-06-03). total_price stores the
    // BASE photographer rate (matches non-blind semantics: package
    // price, before service fee). Stripe charges base × 1.125; payout
    // split is computed at admin-assign time. blind_booking flag
    // persists as a permanent analytics marker.
    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (
         client_id, photographer_id, location_slug, shoot_date,
         group_size, occasion, message, total_price, status,
         confirmed_at, blind_booking, utm_source, utm_medium
       ) VALUES (
         $1, NULL, $2, $3, $4, $5, $6, $7, 'confirmed',
         NOW(), TRUE, 'concierge', 'blind_booking'
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

    // Same fee structure as the rest of the marketplace: client pays
    // photographer rate + 12.5% platform service fee. Payout split
    // (commission per photographer's plan) is computed at admin-assign
    // time when we know the photographer's plan.
    const totalClientPaysCents = Math.round(hold.price_eur * (1 + SERVICE_FEE_RATE) * 100);
    const serviceFeeEur = Math.round(hold.price_eur * SERVICE_FEE_RATE);

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
                description: `${hold.region.replace(/-/g, " ")} · ${hold.duration_minutes} min · ${hold.occasion} · ${hold.date}. Includes €${serviceFeeEur} platform service fee. Authorised now, charged only when your photographer is confirmed (within 24h). Auto-refund otherwise.`,
              },
              unit_amount: totalClientPaysCents,
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
