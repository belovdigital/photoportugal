import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { requireStripe, largeGroupMultiplier } from "@/lib/stripe";
import { blindBaseFromTotal, blindServiceFeeFromTotal } from "@/lib/blind-booking/pricing";
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
      // Hold price already includes 9+ large-group surcharge (applied
      // by chat route's offer_blind_booking handler before mintHold).
      // Pass through as-is — do NOT multiply again.
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
      // price_eur is the CLIENT-INCLUSIVE summer-offer total (€279/465/649);
      // apply the 9+ large-group +50% surcharge to it (matches non-blind flow).
      const surchargedTotalEur = Math.round(Number(priced.price_eur) * largeGroupMultiplier(partySize));
      hold = {
        region: canonicalRegion,
        date,
        occasion,
        party_size: partySize,
        duration_minutes: priced.duration_minutes,
        price_eur: surchargedTotalEur,
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
      // email_verified = TRUE from birth: nobody ever sends these
      // auto-created accounts a verification link, so FALSE means the
      // login authorize() check locks them out FOREVER — even after a
      // successful password reset (David De Almeida, 2026-07-06: reset
      // worked, login still said "verify your email", he gave up and
      // created a duplicate account). The visitor is mid-Stripe-checkout
      // with this address and every booking email lands there — that is
      // stronger ownership proof than a verification click.
      user = await queryOne<{ id: string; email: string; name: string }>(
        `INSERT INTO users (email, name, first_name, last_name, password_hash, role, phone, locale, email_verified)
         VALUES ($1, $2, $3, $4, $5, 'client', $6, $7, TRUE)
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

    // Build the booking message — combine meeting hint with an HONEST
    // origin trail. holdId present = the offer came out of a concierge
    // CHAT; absent = the visitor used the Quick Booking form (modal/
    // homepage button) and there is NO conversation to look up. The old
    // single "via Concierge" label sent admins hunting for chat history
    // that never existed (David De Almeida case, 2026-07-06).
    const origin = holdId ? "via Concierge chat" : "Quick Booking form";
    const message = meetingHint
      ? `[Blind booking — ${origin}] Meeting hint: ${meetingHint}`
      : `[Blind booking — ${origin}]`;

    // Visitor id from the tracking cookie — hard-links the booking to the
    // anonymous browsing session so the admin card can show the client's
    // journey (landing page, referrer, pages viewed) even when there was
    // no concierge chat.
    const visitorId = (req.cookies.get("vid")?.value || "").slice(0, 64) || null;

    // Bind the (previously anonymous) concierge chat to this client and
    // store its id on the booking for a hard link, so the admin card can
    // show the exact conversation.
    let boundChatId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId) ? chatId : null;
    if (boundChatId) {
      // Concierge-chat path — we have the explicit id.
      await queryOne(
        "UPDATE concierge_chats SET user_id = $1 WHERE id = $2 AND user_id IS NULL RETURNING id",
        [user.id, boundChatId]
      ).catch(() => {});
    } else {
      // Quick Booking FORM path — no chat_id is passed. But the visitor
      // very often chatted with the bot anonymously earlier (drawer),
      // gave a phone/email, left, then came back and booked via the form
      // (David De Almeida, 2026-07-06: chatted "surprise proposal in
      // Sintra" on Jul 3, booked via form Jul 6 — phone matched, nothing
      // linked). Retro-link the most recent anonymous chat by phone (last
      // 9 digits, country-code-agnostic) or email, within 30 days.
      const phoneDigits = phone.replace(/\D/g, "");
      const phoneKey = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : null;
      if (phoneKey || email) {
        const matched = await queryOne<{ id: string }>(
          `SELECT id FROM concierge_chats
            WHERE user_id IS NULL
              AND created_at > NOW() - INTERVAL '30 days'
              AND (
                ($1::text IS NOT NULL AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || $1::text)
                OR ($2::text <> '' AND lower(email) = $2::text)
              )
            ORDER BY created_at DESC
            LIMIT 1`,
          [phoneKey, email]
        ).catch(() => null);
        if (matched?.id) {
          boundChatId = matched.id;
          await queryOne(
            "UPDATE concierge_chats SET user_id = $1 WHERE id = $2 AND user_id IS NULL RETURNING id",
            [user.id, matched.id]
          ).catch(() => {});
        }
      }
    }
    const chatUuid = boundChatId;

    // INSERT booking — status='confirmed' + photographer_id=NULL.
    // The combination "confirmed + no photographer" IS the marker for
    // "blind booking awaiting admin assignment" — no separate enum
    // value needed (refactor 2026-06-03). total_price stores the BASE
    // photographer rate (matches non-blind semantics) — since the 2026-07
    // summer offer that base is DERIVED from the inclusive price the
    // client saw: base = hold.price_eur − 15% platform cut. Stripe
    // charges hold.price_eur straight (it IS the all-in number); payout
    // split (standard commission on the base) is computed at admin-assign
    // time. blind_booking flag persists as a permanent analytics marker.
    const booking = await queryOne<{ id: string }>(
      `INSERT INTO bookings (
         client_id, photographer_id, location_slug, shoot_date,
         group_size, occasion, message, total_price, service_fee, status,
         confirmed_at, blind_booking, utm_source, utm_medium, concierge_chat_id, visitor_id
       ) VALUES (
         $1, NULL, $2, $3, $4, $5, $6, $7, $8, 'confirmed',
         NOW(), TRUE, $10, 'blind_booking', $9, $11
       ) RETURNING id`,
      [
        user.id,
        hold.region,
        hold.date,
        hold.party_size,
        hold.occasion,
        message,
        // base + fee reconstruct the exact client charge:
        // 237.15 + 41.85 = 279 — keeps every "total_price + service_fee"
        // consumer (refunds, analytics) money-correct for blind rows.
        blindBaseFromTotal(hold.price_eur),
        Math.round((hold.price_eur - blindBaseFromTotal(hold.price_eur)) * 100) / 100,
        chatUuid,
        // utm_source distinguishes the two funnels honestly; utm_medium
        // stays 'blind_booking' for both so blind-funnel filters keep working.
        holdId ? "concierge" : "quick_booking",
        visitorId,
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

    // Summer super-offer: hold.price_eur IS the all-inclusive number the
    // visitor saw (€279/465/649) — charge it straight, nothing added on
    // top. The 15% platform cut + photographer base are carved out of it
    // (see blindBaseFromTotal); commission split lands at admin-assign.
    const totalClientPaysCents = Math.round(hold.price_eur * 100);
    const serviceFeeEur = Math.round(blindServiceFeeFromTotal(hold.price_eur));

    const session = await requireStripe().checkout.sessions.create(
      {
        customer: customerId,
        mode: "payment",
        locale: locale === "en" ? "auto" : (locale as "pt" | "de" | "es" | "fr"),
        adaptive_pricing: { enabled: true },
        // Blind bookings are pay-NOW by design (unlike standard bookings'
        // 24h grace). 1h session: either they pay in this sitting or the
        // session dies and the unpaid-blind cron cancels the row shortly
        // after. Stripe minimum is 30 min.
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
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

    // Admin heads-up at CREATION time (fire-and-forget). Until 2026-07-07
    // admins were only notified from the Stripe webhook AFTER payment, so
    // a visitor who opened checkout and never paid was invisible — the
    // blind booking sat in the admin queue with no ping. Now: TG + email
    // immediately, explicitly marked "awaiting payment"; the webhook sends
    // the louder "authorised — assign now" follow-up on payment.
    {
      const clientLabel = `${name.replace(/[<>]/g, "")} (${email})`;
      const factsText = `${hold.occasion} · ${hold.region} · ${hold.date} · ${hold.party_size} ppl · ${hold.duration_minutes} min · €${hold.price_eur} all-in`;
      import("@/lib/telegram").then(({ sendTelegram }) =>
        sendTelegram(
          `<b>🕐 Blind booking created — awaiting payment</b>\nBooking: <code>${booking.id}</code>\n${factsText}\nClient: ${clientLabel}\nNo Stripe hold yet — client is in checkout. If it never turns "authorised", they abandoned payment.\n<a href="https://photoportugal.com/admin">Open admin queue</a>`,
          "bookings"
        )
      ).catch((err) => console.error("[blind-booking/accept] admin telegram error:", err));
      import("@/lib/email").then(async ({ sendEmail, getAdminEmail }) => {
        const adminEmail = await getAdminEmail();
        if (!adminEmail) return;
        await sendEmail(
          adminEmail,
          `🕐 Blind booking created (awaiting payment) — ${hold.occasion} in ${hold.region}`,
          `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;">
            <h2 style="color:#C94536;">Blind booking created — awaiting payment</h2>
            <p><strong>${factsText}</strong></p>
            <p>Client: ${clientLabel}<br/>Booking ID: <code>${booking.id}</code></p>
            <p>No Stripe authorisation yet — the client is in checkout. A separate "authorised" notification follows if they complete payment.</p>
            <p><a href="https://photoportugal.com/admin" style="display:inline-block;background:#C94536;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open admin queue</a></p>
          </div>`
        );
      }).catch((err) => console.error("[blind-booking/accept] admin email error:", err));
    }

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
