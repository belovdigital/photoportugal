import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { sendBookingNotification, sendBookingRequestToClient, sendAdminNewBookingNotification } from "@/lib/email";
import { sendSMS, sendAdminSMS } from "@/lib/sms";
import { maskSurname } from "@/lib/photographer-name";
import { bookingGroupSizeEstimateColumnExists } from "@/lib/booking-group-size-fields";
import {
  getBufferedBusyWindows,
  getPhotographerCalendarBufferMinutes,
  hasAvailableBookingStart,
  lisbonLocalMinutesToUtc,
} from "@/lib/booking-availability";

// Create a booking request
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to book" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { photographer_id, package_id, location_slug, location_detail, shoot_date: shoot_date_raw, shoot_date_coords, shoot_time, flexible_date_from: flexible_date_from_raw, flexible_date_from_coords, flexible_date_to: flexible_date_to_raw, flexible_date_to_coords, group_size, group_size_is_estimate, occasion, message, client_phone, utm_source, utm_medium, utm_campaign, utm_term, gclid,
      // Gift booking fields (all optional; require is_gift=true to take effect)
      is_gift, gift_recipient_name, gift_recipient_email, gift_recipient_phone,
      gift_reveal_mode, gift_reveal_days_before,
      // Gift-card redemption: when true and the client is in gift mode
      // (users.active_gift_card_id), this booking is paid for by the
      // gift card — no Stripe charge, fixed photographer payout.
      gift_card_redemption,
      // Fast-track: when client clicked "Book Now" on a BOOKING_CARD
      // sent by the photographer in chat, we skip the manual photographer-
      // confirm step. The photographer already committed by sending the
      // card. proposal_message_id is the chat message id of that card;
      // server validates it against the message + package and only then
      // sets status='confirmed' so the next API call (stripe/checkout)
      // works directly.
      proposal_message_id,
    } = await req.json();

    // ─── Bulletproof date reconciliation ──────────────────────────────
    // The DatePicker sends both a YYYY-MM-DD string AND the raw click
    // coordinates (year + 1-indexed month + day). If they disagree —
    // which has happened in production with the symptom "client picked
    // June but the booking says July" — we trust the coordinates as
    // ground truth and rebuild the string from them. The mismatch gets
    // logged loudly so we can find the root cause. The booking still
    // succeeds (rather than failing in front of a paying customer).
    function reconcileDate(raw: unknown, coords: unknown, fieldName: string): string | null {
      const rawStr = typeof raw === "string" ? raw : (raw == null ? null : String(raw));
      const c = coords as { year?: unknown; month?: unknown; day?: unknown } | null;
      if (!c || typeof c.year !== "number" || typeof c.month !== "number" || typeof c.day !== "number") {
        return rawStr; // No coords (legacy clients) — accept string as-is.
      }
      const rebuilt = `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
      if (rawStr && rawStr !== "flexible" && rawStr !== rebuilt) {
        console.error(`[bookings] date MISMATCH in ${fieldName}: string="${rawStr}" coords=${JSON.stringify(c)} → using coords ("${rebuilt}"). user=${userId} photographer=${photographer_id}`);
        return rebuilt;
      }
      return rawStr;
    }

    const shoot_date = shoot_date_raw === "flexible"
      ? "flexible"
      : reconcileDate(shoot_date_raw, shoot_date_coords, "shoot_date");
    const flexible_date_from = reconcileDate(flexible_date_from_raw, flexible_date_from_coords, "flexible_date_from");
    const flexible_date_to = reconcileDate(flexible_date_to_raw, flexible_date_to_coords, "flexible_date_to");

    if (!photographer_id) {
      return NextResponse.json({ error: "Photographer is required" }, { status: 400 });
    }

    // Diagnostic: repeated client reports of "I picked June but the
    // booking says July." Server path is a clean string passthrough, so
    // log the raw shoot_date we receive — next repro we can confirm
    // whether the browser sent the wrong string or whether the picker
    // displays one thing but submits another.
    console.log(`[bookings] received shoot_date="${shoot_date}" flexible_from="${flexible_date_from || ""}" flexible_to="${flexible_date_to || ""}" user=${userId} photographer=${photographer_id}`);

    // Phone is required at the platform boundary — keeps a fallback channel
    // when email lands in spam. Strip non-digits to count length.
    const phoneDigits = typeof client_phone === "string" ? client_phone.replace(/[^\d]/g, "") : "";
    if (phoneDigits.length < 6) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    // Persist to user's profile so they don't have to re-enter on the
    // next booking. Always overwrite — they just confirmed it's current.
    await queryOne("UPDATE users SET phone = $1 WHERE id = $2 RETURNING id", [client_phone.trim(), userId]).catch(() => {});

    // Verify photographer exists and is approved. Pull min_lead_time_hours
    // here too so we can validate the shoot date in a single roundtrip.
    const photographerCheck = await queryOne<{
      is_approved: boolean; user_id: string; min_lead_time_hours: number;
    }>(
      "SELECT is_approved, user_id, COALESCE(min_lead_time_hours, 0) as min_lead_time_hours FROM photographer_profiles WHERE id = $1",
      [photographer_id]
    );
    if (!photographerCheck) {
      return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
    }
    if (!photographerCheck.is_approved) {
      return NextResponse.json({ error: "This photographer is not yet approved" }, { status: 400 });
    }

    // Prevent self-booking
    if (photographerCheck.user_id === userId) {
      return NextResponse.json({ error: "You cannot book yourself" }, { status: 400 });
    }

    // Notice-period validation. Photographers can require N hours of
    // advance notice before a shoot (set in dashboard/settings). 0 = no
    // restriction. Compared against shoot_date at midnight UTC, which is
    // good enough for a "X hours ahead" gate (a few hours of TZ skew
    // doesn't change a 24/48/120h window).
    const isFlexible = shoot_date === "flexible";
    const minLeadHours = photographerCheck.min_lead_time_hours || 0;
    if (!isFlexible && shoot_date && minLeadHours > 0) {
      const shootStart = new Date(`${shoot_date}T00:00:00Z`).getTime();
      const earliestAllowed = Date.now() + minLeadHours * 3600 * 1000;
      if (shootStart < earliestAllowed) {
        const days = Math.round(minLeadHours / 24);
        const niceWindow = minLeadHours < 24
          ? `${minLeadHours} hours`
          : days === 1 ? "1 day" : `${days} days`;
        return NextResponse.json({
          error: `This photographer requires at least ${niceWindow} of advance notice. Please pick a later date.`,
          code: "min_lead_time",
          minLeadTimeHours: minLeadHours,
        }, { status: 400 });
      }
    }

    // Check availability for non-flexible bookings
    if (!isFlexible && shoot_date) {
      const conflict = await queryOne<{ id: string }>(
        `SELECT id FROM photographer_unavailability
         WHERE photographer_id = $1 AND date_from <= $2::date AND date_to >= $2::date`,
        [photographer_id, shoot_date]
      );
      if (conflict) {
        return NextResponse.json({ error: "This photographer is not available on the selected date. Please choose a different date or check \"I'm flexible with dates\"." }, { status: 400 });
      }

      // Calendar/booking conflict. Build an availability window from the
      // preferred time bucket and package duration, then check whether at
      // least one concrete start time still fits after applying the
      // photographer's buffer around external calendar events and existing
      // Photo Portugal bookings.
      try {
        // Pull duration from the chosen package (if any) so the window we
        // check matches the actual shoot length. Without a package we
        // assume 2h (most common shoot length).
        let durationMin = 120;
        if (package_id) {
          const pkgDur = await queryOne<{ duration_minutes: number }>(
            "SELECT duration_minutes FROM packages WHERE id = $1 AND photographer_id = $2",
            [package_id, photographer_id]
          );
          if (pkgDur?.duration_minutes) durationMin = pkgDur.duration_minutes;
        }

        const bufferMinutes = await getPhotographerCalendarBufferMinutes(photographer_id);
        const rangeStart = lisbonLocalMinutesToUtc(shoot_date, 0);
        const rangeEnd = lisbonLocalMinutesToUtc(shoot_date, 24 * 60 + durationMin + bufferMinutes);
        // Exclude the booker's own existing bookings — they shouldn't be
        // blocked by their own pending hold on the same photographer/date.
        const busyWindows = await getBufferedBusyWindows(photographer_id, rangeStart, rangeEnd, bufferMinutes, undefined, userId);

        if (!hasAvailableBookingStart(shoot_date, shoot_time, durationMin, busyWindows)) {
          return NextResponse.json({
            error: "The photographer is busy around the requested time. Please pick another date or time.",
            code: "calendar_conflict",
          }, { status: 400 });
        }
      } catch (calErr) {
        // Don't block bookings if the calendar lookup itself errors —
        // worst case we miss a conflict, which is preferable to a 500
        // breaking the whole booking flow over a stale connection.
        console.error("[bookings] calendar overlap check failed:", calErr);
      }
    }

    // Get package price if selected. Also enforce one-off proposal
    // targeting: a custom package (custom_for_user_id IS NOT NULL) can
    // only be booked by the user it was sent to. This stops a different
    // client from booking another client's negotiated price by guessing
    // the package_id.
    const normalizedGroupSize = Math.max(1, Math.min(99, Number(group_size) || 2));

    let totalPrice = null;
    if (package_id) {
      const pkg = await queryOne<{ price: number; custom_for_user_id: string | null; is_group_package: boolean; revoked_at: string | null }>(
        "SELECT price, custom_for_user_id, COALESCE(is_group_package, FALSE) as is_group_package, revoked_at FROM packages WHERE id = $1 AND photographer_id = $2",
        [package_id, photographer_id]
      );
      if (pkg) {
        if (pkg.revoked_at) {
          return NextResponse.json({
            error: "This offer has been withdrawn by the photographer.",
            code: "offer_withdrawn",
          }, { status: 410 });
        }
        if (pkg.custom_for_user_id && pkg.custom_for_user_id !== userId) {
          return NextResponse.json({
            error: "This proposal isn't available to you.",
            code: "custom_proposal_mismatch",
          }, { status: 403 });
        }
        // Apply large-group surcharge unless the package itself is
        // explicitly priced for groups (e.g. "Large Group Comporta",
        // "Big Family Photoshoot") — those already factor in the extra
        // work, double-charging would surprise both sides.
        const { largeGroupMultiplier } = await import("@/lib/stripe");
        const mult = pkg.is_group_package ? 1 : largeGroupMultiplier(normalizedGroupSize);
        totalPrice = Math.round(Number(pkg.price) * mult * 100) / 100;
      }
    }

    // ─── Gift-card redemption ──────────────────────────────────────────
    // When the booking is paid for by a gift card we override the price
    // and payout to the tier-fixed numbers, bypass Stripe entirely, and
    // mark the card as 'redeemed'. Validation:
    //   - viewer has users.active_gift_card_id set
    //   - card.status = 'claimed'
    //   - card not expired
    //   - the chosen package belongs to this photographer AND has
    //     tier = card.tier (i.e. they picked the right standard package
    //     for their gift — UI enforces this but verify server-side too)
    //   - photographer.accepts_gift_cards = TRUE
    let giftCardForRedemption: { id: string; tier: string; amount: number; photographer_payout: number } | null = null;
    if (gift_card_redemption === true) {
      const viewer = await queryOne<{ active_gift_card_id: string | null }>(
        "SELECT active_gift_card_id FROM users WHERE id = $1",
        [userId]
      );
      if (!viewer?.active_gift_card_id) {
        return NextResponse.json({ error: "No active gift card on this account." }, { status: 400 });
      }
      const card = await queryOne<{ id: string; tier: string; status: string; expires_at: string; amount: number; photographer_payout: number }>(
        "SELECT id, tier, status, expires_at, amount, photographer_payout FROM gift_cards WHERE id = $1",
        [viewer.active_gift_card_id]
      );
      if (!card) {
        return NextResponse.json({ error: "Gift card not found." }, { status: 400 });
      }
      if (card.status !== "claimed") {
        return NextResponse.json({ error: "This gift card is not redeemable." }, { status: 400 });
      }
      if (new Date(card.expires_at) < new Date()) {
        return NextResponse.json({ error: "This gift card has expired." }, { status: 400 });
      }
      const tierPkg = await queryOne<{ id: string; tier: string }>(
        "SELECT id, tier::text as tier FROM packages WHERE id = $1 AND photographer_id = $2",
        [package_id, photographer_id]
      );
      if (!tierPkg || tierPkg.tier !== card.tier) {
        return NextResponse.json({ error: "Selected package doesn't match your gift card tier." }, { status: 400 });
      }
      const photographerOptIn = await queryOne<{ accepts_gift_cards: boolean | null }>(
        "SELECT accepts_gift_cards FROM photographer_profiles WHERE id = $1",
        [photographer_id]
      );
      if (photographerOptIn?.accepts_gift_cards === false) {
        return NextResponse.json({ error: "This photographer does not currently accept gift cards." }, { status: 400 });
      }

      giftCardForRedemption = card;
      // Lock to the tier-fixed numbers regardless of what the client sent.
      totalPrice = Number(card.amount);
    }

    // ─── Gift booking validation ───────────────────────────────────────
    // Three new pieces: recipient identity (name + email + WhatsApp),
    // when to surface it (gift_reveal_at), and a backing user row for the
    // recipient (created dormant if no user exists yet).
    const isGift = !!is_gift;
    let giftRecipientUserId: string | null = null;
    let giftRevealAt: Date | null = null;

    if (isGift) {
      const recipName = typeof gift_recipient_name === "string" ? gift_recipient_name.trim() : "";
      const recipEmailRaw = typeof gift_recipient_email === "string" ? gift_recipient_email.trim().toLowerCase() : "";
      const recipPhoneRaw = typeof gift_recipient_phone === "string" ? gift_recipient_phone.trim() : "";

      if (!recipName) {
        return NextResponse.json({ error: "Recipient name is required for a gift booking" }, { status: 400 });
      }
      if (!recipEmailRaw || !recipEmailRaw.includes("@") || !recipEmailRaw.includes(".")) {
        return NextResponse.json({ error: "Recipient email is required for a gift booking" }, { status: 400 });
      }
      const recipPhoneDigits = recipPhoneRaw.replace(/[^\d]/g, "");
      if (recipPhoneDigits.length < 6) {
        return NextResponse.json({ error: "Recipient WhatsApp number is required for a gift booking" }, { status: 400 });
      }

      // Buyer can't gift to themselves (would conflate roles).
      const buyer = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = $1", [userId]);
      if (buyer && buyer.email.toLowerCase() === recipEmailRaw) {
        return NextResponse.json({ error: "Recipient email matches your own — enter the gift recipient's email." }, { status: 400 });
      }

      // Find existing user or create a dormant one. Either way we end up
      // with a user row whose email exactly matches what the buyer typed,
      // so the /gift/claim flow can lock the email field readonly.
      const existing = await queryOne<{ id: string }>(
        "SELECT id FROM users WHERE LOWER(email) = $1",
        [recipEmailRaw]
      );
      if (existing) {
        giftRecipientUserId = existing.id;
      } else {
        const firstName = recipName.split(" ")[0];
        const lastName = recipName.split(" ").slice(1).join(" ");
        // Inherit buyer's locale so the reveal email is in their language.
        const buyerLocale = await queryOne<{ locale: string | null }>(
          "SELECT locale FROM users WHERE id = $1",
          [userId]
        );
        const dormantLocale = buyerLocale?.locale || "en";
        const created = await queryOne<{ id: string }>(
          // email_verified=TRUE: clients are verified from birth (platform
          // policy 2026-07-06) — an unverified auto-account is a permanent
          // lockout, since nobody ever emails these users a verify link.
          `INSERT INTO users (email, name, first_name, last_name, role, locale, email_verified, password_hash)
           VALUES ($1, $2, $3, $4, 'client', $5, TRUE, NULL)
           RETURNING id`,
          [recipEmailRaw, recipName, firstName, lastName, dormantLocale]
        );
        giftRecipientUserId = created?.id || null;
        if (giftRecipientUserId) {
          // Default notification prefs so reveal email isn't blocked by
          // missing row (other code defaults to enabled when no row exists,
          // but explicit is safer).
          await queryOne(
            "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
            [giftRecipientUserId]
          );
        }
      }

      // Reveal scheduling. "immediate" = send the gift card right now.
      // "days_before" = N days before shoot_date (clamp 1..60). For flexible
      // bookings we can't compute a real date, so we fall back to immediate.
      const mode = gift_reveal_mode === "days_before" ? "days_before" : "immediate";
      if (mode === "immediate" || isFlexible || !shoot_date) {
        giftRevealAt = new Date();
      } else {
        const n = Math.max(1, Math.min(60, Number(gift_reveal_days_before) || 3));
        const reveal = new Date(`${shoot_date}T09:00:00Z`);
        reveal.setUTCDate(reveal.getUTCDate() - n);
        // If that lands in the past (shoot is sooner than N days), reveal now.
        giftRevealAt = reveal.getTime() < Date.now() ? new Date() : reveal;
      }
    }

    // ─── Fast-track validation ─────────────────────────────────────────
    // Only valid when EVERY check passes — fail open to the regular
    // pending-confirm flow on any mismatch so spoofed URLs never bypass
    // the photographer's agreement. The booking goes straight to
    // status='confirmed' (skipping the inquiry/pending step) so the
    // client gets a "Pay now" button immediately. Stripe checkout
    // session is created in a separate follow-up call from the client.
    let fastTrack = false;
    if (proposal_message_id && typeof proposal_message_id === "string") {
      try {
        const msg = await queryOne<{
          id: string; text: string; sender_id: string; client_id: string | null;
          photographer_id: string | null; created_at: string;
        }>(
          `SELECT id, text, sender_id, client_id, photographer_id, created_at
             FROM messages WHERE id = $1`,
          [proposal_message_id]
        );
        const checks: string[] = [];
        if (!msg) checks.push("not found");
        else {
          if (!msg.text || !msg.text.startsWith("BOOKING_CARD:")) checks.push("not a booking card");
          if (msg.client_id !== userId) checks.push("not your conversation");
          if (msg.photographer_id !== photographer_id) checks.push("photographer mismatch");
          if (Date.now() - new Date(msg.created_at).getTime() > 90 * 24 * 3600 * 1000) {
            checks.push("proposal older than 90 days");
          }
          // Sender must be the photographer (a client can't fast-track
          // their own message). photographer_profiles.user_id is the
          // sender we expect.
          if (checks.length === 0) {
            const pp = await queryOne<{ user_id: string }>(
              "SELECT user_id FROM photographer_profiles WHERE id = $1",
              [photographer_id]
            );
            if (!pp || pp.user_id !== msg.sender_id) checks.push("sender is not the photographer");
          }
          // The BOOKING_CARD's package_id must match the URL's package_id —
          // otherwise the client manipulated the request to fast-track a
          // different package than the photographer offered.
          if (checks.length === 0) {
            try {
              const payload = JSON.parse(msg.text.slice("BOOKING_CARD:".length));
              if (!payload.package_id || payload.package_id !== package_id) {
                checks.push("package_id mismatch");
              }
            } catch {
              checks.push("malformed booking card payload");
            }
          }
        }
        if (checks.length === 0) {
          fastTrack = true;
        } else {
          console.warn(`[bookings] fast-track rejected: ${checks.join(", ")} (msg=${proposal_message_id} user=${userId} photographer=${photographer_id} package=${package_id})`);
        }
      } catch (err) {
        console.error("[bookings] fast-track validation error:", err);
      }
    }
    const initialStatus = fastTrack ? "confirmed" : "pending";

    const hasGroupSizeEstimateColumn = await bookingGroupSizeEstimateColumnExists();
    const giftCols = ", is_gift, gift_recipient_name, gift_recipient_email, gift_recipient_phone, gift_recipient_user_id, gift_reveal_at";
    const giftVals = isGift
      ? [isGift, gift_recipient_name.trim(), gift_recipient_email.trim().toLowerCase(), gift_recipient_phone.trim(), giftRecipientUserId, giftRevealAt]
      : [false, null, null, null, null, null];

    // Gift-card columns: link the card and pre-pay the booking when it's
    // a redemption. Payout is locked to the tier-fixed amount, service fee
    // is zero (recipient doesn't pay anything), payment_status is 'paid'
    // so reminders and Stripe checkout don't fire for this booking.
    const gcCols = giftCardForRedemption
      ? ", gift_card_id, service_fee, payout_amount, platform_fee, payment_status"
      : "";
    const gcExtraParams = giftCardForRedemption
      ? [giftCardForRedemption.id, 0, Number(giftCardForRedemption.photographer_payout), 0, "paid"]
      : [];
    // Build placeholder string $26..$30 (after gift fields finished at $25/$24).
    const baseCount = hasGroupSizeEstimateColumn ? 25 : 24;
    const gcPlaceholders = giftCardForRedemption
      ? ", " + Array.from({ length: 5 }, (_, i) => `$${baseCount + 1 + i}`).join(", ")
      : "";

    // status is one of two safe literals we own (initialStatus is set
    // above based on fastTrack), so interpolating is fine — keeps the
    // dynamic placeholder count untouched and avoids the giftCols /
    // gcCols off-by-one trap.
    const booking = hasGroupSizeEstimateColumn
      ? await queryOne<{ id: string }>(
          `INSERT INTO bookings (client_id, photographer_id, package_id, location_slug, location_detail, shoot_date, shoot_time, flexible_date_from, flexible_date_to, group_size, group_size_is_estimate, occasion, message, total_price, status, utm_source, utm_medium, utm_campaign, utm_term, gclid${giftCols}${gcCols})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '${initialStatus}', $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25${gcPlaceholders})
           RETURNING id`,
          [userId, photographer_id, package_id || null, location_slug || null, location_detail?.trim() || null, isFlexible ? null : shoot_date, (shoot_time && shoot_time !== "flexible") ? shoot_time : null, isFlexible ? (flexible_date_from || null) : null, isFlexible ? (flexible_date_to || null) : null, normalizedGroupSize, !!group_size_is_estimate, occasion || null, message || null, totalPrice, utm_source || null, utm_medium || null, utm_campaign || null, utm_term || null, gclid || null, ...giftVals, ...gcExtraParams]
        )
      : await queryOne<{ id: string }>(
          `INSERT INTO bookings (client_id, photographer_id, package_id, location_slug, location_detail, shoot_date, shoot_time, flexible_date_from, flexible_date_to, group_size, occasion, message, total_price, status, utm_source, utm_medium, utm_campaign, utm_term, gclid${giftCols}${gcCols})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '${initialStatus}', $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24${gcPlaceholders})
           RETURNING id`,
          [userId, photographer_id, package_id || null, location_slug || null, location_detail?.trim() || null, isFlexible ? null : shoot_date, (shoot_time && shoot_time !== "flexible") ? shoot_time : null, isFlexible ? (flexible_date_from || null) : null, isFlexible ? (flexible_date_to || null) : null, normalizedGroupSize, occasion || null, message || null, totalPrice, utm_source || null, utm_medium || null, utm_campaign || null, utm_term || null, gclid || null, ...giftVals, ...gcExtraParams]
        );

    // Attribute the booking back to a concierge recommendation, if one
    // exists. We find the most recent concierge chat from this user that
    // surfaced this photographer, then mark every recommendation event
    // for that (chat, photographer) pair as having led to a booking.
    // Best-effort — if the lookup fails or finds nothing the booking
    // still succeeds; this is purely funnel telemetry.
    if (booking?.id) {
      void (async () => {
        try {
          const { queryOne } = await import("@/lib/db");
          const recent = await queryOne<{ id: string; occasion: string | null }>(
            `SELECT cc.id, cc.occasion FROM concierge_chats cc
               JOIN concierge_recommendation_events r ON r.chat_id = cc.id
              WHERE cc.user_id = $1
                AND r.photographer_id = $2
                AND r.shown_at >= NOW() - INTERVAL '14 days'
              ORDER BY r.shown_at DESC LIMIT 1`,
            [userId, photographer_id]
          );
          if (recent?.id) {
            // Persist the link directly on the booking so the
            // photographer notification path can read it without an
            // expensive backwards join.
            await queryOne(
              "UPDATE bookings SET concierge_chat_id = $1 WHERE id = $2 RETURNING id",
              [recent.id, booking.id]
            ).catch(() => null);
            // Back-fill the booking's occasion from the concierge chat when
            // the booking form didn't capture one — so wedding (and every
            // other) concierge-driven booking is attributable by occasion
            // without overwriting an explicit client choice.
            if (recent.occasion) {
              await queryOne(
                "UPDATE bookings SET occasion = $1 WHERE id = $2 AND (occasion IS NULL OR occasion = '') RETURNING id",
                [recent.occasion, booking.id]
              ).catch(() => null);
            }
            const { markBookingFromConcierge } = await import("@/lib/concierge/recommendation-events");
            await markBookingFromConcierge(recent.id, photographer_id);
          }
        } catch (err) {
          console.error("[bookings] concierge attribution failed:", err);
        }
      })();
    }

    // Finalize gift-card redemption: mark card as 'redeemed', link
    // booking_id, clear the user's active_gift_card_id so they're no
    // longer in gift-mode. Atomic so a parallel race can't redeem twice.
    if (giftCardForRedemption && booking?.id) {
      const claimed = await queryOne<{ id: string }>(
        `UPDATE gift_cards SET status = 'redeemed', redeemed_at = NOW(), booking_id = $1
          WHERE id = $2 AND status = 'claimed' RETURNING id`,
        [booking.id, giftCardForRedemption.id]
      );
      if (!claimed) {
        // Card was redeemed concurrently — undo the booking insert.
        await queryOne("DELETE FROM bookings WHERE id = $1 RETURNING id", [booking.id]).catch(() => null);
        return NextResponse.json({ error: "Gift card was redeemed elsewhere just now. Please try again." }, { status: 409 });
      }
      await queryOne(
        "UPDATE users SET active_gift_card_id = NULL WHERE id = $1 AND active_gift_card_id = $2 RETURNING id",
        [userId, giftCardForRedemption.id]
      ).catch(() => null);
    }

    // Post the client's booking message to the chat as the first real message —
    // gives the photographer something concrete to react to and starts the
    // conversation off naturally instead of an empty thread.
    const trimmedMessage = (message || "").trim();
    if (trimmedMessage && booking?.id) {
      try {
        await queryOne(
          "INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, FALSE) RETURNING id",
          [booking.id, userId, trimmedMessage]
        );
      } catch (err) {
        console.error("[bookings] failed to post client message to chat:", err);
      }
    }

    // Upload "Booking Created" offline conversion to Google Ads if gclid present
    if (gclid && booking?.id) {
      const clientUser = await queryOne<{ email: string; phone: string | null }>(
        "SELECT email, phone FROM users WHERE id = $1",
        [userId]
      ).catch(() => null);
      import("@/lib/google-ads-conversions").then(({ uploadBookingCreatedConversion }) => {
        uploadBookingCreatedConversion(gclid, totalPrice ? Number(totalPrice) : 0, {
          email: clientUser?.email,
          phone: clientUser?.phone,
        }, `booking:${booking.id}:created`);
      }).catch((err) => console.error("[bookings] gads conversion upload error:", err));
    }

    // Convert any inquiry between same client & photographer to point to this booking
    await queryOne(
      "UPDATE bookings SET converted_to_booking_id = $3 WHERE client_id = $1 AND photographer_id = $2 AND status = 'inquiry' AND id != $3 RETURNING id",
      [userId, photographer_id, booking!.id]
    ).catch(() => {});

    // Send email notification to photographer (if enabled)
    try {
      const photographerInfo = await queryOne<{ email: string; display_name: string; user_id: string }>(
        `SELECT u.email, u.name as display_name, u.id as user_id FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
        [photographer_id]
      );
      const prefs = await queryOne<{ email_bookings: boolean; sms_bookings: boolean }>(
        "SELECT email_bookings, sms_bookings FROM notification_preferences WHERE user_id = $1",
        [photographerInfo?.user_id]
      );
      const clientInfo = await queryOne<{ name: string; email: string }>("SELECT name, email FROM users WHERE id = $1", [userId]);
      const pkgInfo = package_id ? await queryOne<{ name: string }>("SELECT name FROM packages WHERE id = $1", [package_id]) : null;

      const { formatShootDate } = await import("@/lib/format-shoot-date");
      const dateDisplay = isFlexible && flexible_date_from && flexible_date_to
        ? `flexible (${formatShootDate(flexible_date_from, "en") || flexible_date_from} — ${formatShootDate(flexible_date_to, "en") || flexible_date_to})`
        : (formatShootDate(shoot_date, "en") || shoot_date || null);

      if (photographerInfo && clientInfo && prefs?.email_bookings !== false) {
        sendBookingNotification(
          photographerInfo.email,
          photographerInfo.display_name,
          clientInfo.name,
          pkgInfo?.name || null,
          dateDisplay,
          null,
          booking?.id || null
        );
      }

      // Confirm to client that request was sent
      if (photographerInfo && clientInfo) {
        sendBookingRequestToClient(
          clientInfo.email,
          clientInfo.name,
          photographerInfo.display_name,
          pkgInfo?.name || null,
          dateDisplay
        );
      }

      // Notify admin about new booking
      if (photographerInfo && clientInfo) {
        sendAdminNewBookingNotification(
          clientInfo.name,
          photographerInfo.display_name,
          pkgInfo?.name || null,
          dateDisplay
        );
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`📅 <b>New Booking!</b>\n\n<b>Client:</b> ${clientInfo!.name}\n<b>Photographer:</b> ${photographerInfo!.display_name}\n<b>Package:</b> ${pkgInfo?.name || "Custom"}\n<b>Date:</b> ${dateDisplay || "Flexible"}\n\n<a href="https://photoportugal.com/admin">Open Admin →</a>`, "bookings");
        }).catch((err) => console.error("[bookings] telegram new booking error:", err));
      }

      // Check if this client came from ads
      try {
        const clientUtm = await queryOne<{utm_source: string | null}>(
          "SELECT utm_source FROM users WHERE id = $1", [userId]
        );
        if (clientUtm?.utm_source) {
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`🎯 <b>Ad Visitor Booked!</b>\n\nSource: ${clientUtm!.utm_source}\n${clientInfo!.name} → ${photographerInfo!.display_name}`, "bookings");
          }).catch((err) => console.error("[bookings] telegram ad visitor error:", err));
        }
      } catch {}

      // Send SMS notification to photographer (if enabled and phone number exists)
      if (photographerInfo && clientInfo && prefs?.sms_bookings !== false) {
        const photographerPhone = await queryOne<{ phone: string | null }>(
          "SELECT phone FROM users WHERE id = $1",
          [photographerInfo.user_id]
        );
        if (photographerPhone?.phone) {
          sendSMS(
            photographerPhone.phone,
            `New booking request on Photo Portugal from ${clientInfo.name}. Log in to review: https://photoportugal.com/dashboard/bookings`
          ).catch(err => console.error("[sms] new booking error:", err));
        }
      }

      // SMS notification to all admin phones
      if (photographerInfo && clientInfo) {
        sendAdminSMS(
          `New booking: ${clientInfo.name} → ${photographerInfo.display_name}${pkgInfo?.name ? ` (${pkgInfo.name})` : ""}${dateDisplay ? `, ${dateDisplay}` : ""}`
        );
      }

      // Push notification to photographer
      if (photographerInfo && clientInfo) {
        const clientFirst = (clientInfo!.name || "").split(" ")[0] || "A client";
        const bookingBody = [pkgInfo?.name, dateDisplay, location_slug].filter(Boolean).join(" · ") || "Tap to view details";
        import("@/lib/push").then(m =>
          m.sendPushNotification(
            photographerInfo!.user_id,
            `📅 Booking request from ${clientFirst}`,
            bookingBody,
            {
              type: "booking",
              bookingId: booking?.id || "",
              channelId: "bookings",
              categoryId: "BOOKING",
            }
          )
        ).catch((err) => console.error("[bookings] push notification error:", err));
        // Real-time bookings-list refresh on photographer's other
        // open clients.
        import("@/lib/realtime").then((m) =>
          m.notifyUser(photographerInfo!.user_id, "booking_created", { bookingId: booking?.id })
        );
      }

      // Telegram notification to photographer
      if (clientInfo) {
        const clientFirst = clientInfo.name.split(" ")[0];
        import("@/lib/notify-photographer").then(m =>
          m.notifyPhotographerViaTelegram(
            photographer_id,
            `New booking request from ${clientFirst}!\n\nPackage: ${pkgInfo?.name || "Custom"}\nDate: ${dateDisplay || "Flexible"}\n\nView: https://photoportugal.com/dashboard/bookings`
          )
        ).catch((err) => console.error("[bookings] telegram photographer notify error:", err));
      }
    } catch {}

    return NextResponse.json({ success: true, booking_id: booking?.id, fast_track: fastTrack });
  } catch (error) {
    console.error("[bookings] create error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

// Get bookings for current user
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // Read role from DB (JWT may be stale)
  let role = user.role;
  try {
    const dbUser = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
    if (dbUser) role = dbUser.role;
  } catch {}

  try {
    let bookings;
    if (role === "photographer") {
      const profile = await queryOne<{ id: string }>(
        "SELECT id FROM photographer_profiles WHERE user_id = $1",
        [userId]
      );
      if (!profile) return NextResponse.json([]);

      bookings = await query(
        `SELECT b.*, u.name as client_name, u.email as client_email, u.avatar_url as client_avatar,
                p.name as package_name, p.duration_minutes, p.num_photos,
                -- Photographer's tip share (90%), in cents. Photographer-safe.
                (SELECT t.payout_cents FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_payout_cents
         FROM bookings b
         JOIN users u ON u.id = b.client_id
         LEFT JOIN packages p ON p.id = b.package_id
         WHERE b.photographer_id = $1 AND b.status != 'inquiry'
         ORDER BY b.created_at DESC`,
        [profile.id]
      );
      // Strip the client-side money columns the photographer must NEVER see:
      // the 15% service fee we add ON TOP (charged to the client), the gross
      // the client actually paid, and the promo/coupon details. They keep
      // total_price (their base rate), payout_amount (their take-home), and
      // platform_fee (our commission from them). `SELECT b.*` leaked all of
      // these into the JSON even though the UI only rendered total_price.
      for (const b of bookings as Array<Record<string, unknown>>) {
        delete b.service_fee;
        delete b.stripe_amount_subtotal_cents;
        delete b.stripe_amount_paid_cents;
        delete b.stripe_amount_discount_cents;
        delete b.stripe_promo_code;
        delete b.stripe_coupon_name;
        delete b.stripe_coupon_percent_off;
      }
    } else {
      // Bookings where the user is either the buyer (client_id) or the
      // gift recipient. The viewer_role column lets the UI render
      // "Booking" vs "Gift you sent" vs "Gift for you" without an extra
      // query.
      bookings = await query(
        `SELECT b.*, u.name as photographer_name, pp.slug as photographer_slug,
                u.avatar_url as photographer_avatar,
                p.name as package_name, p.duration_minutes, p.num_photos,
                CASE
                  WHEN b.client_id = $1 AND b.is_gift = TRUE THEN 'gift_buyer'
                  WHEN b.gift_recipient_user_id = $1 THEN 'gift_recipient'
                  ELSE 'client'
                END as viewer_role
         FROM bookings b
         LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
         LEFT JOIN users u ON u.id = pp.user_id
         LEFT JOIN packages p ON p.id = b.package_id
         WHERE (b.client_id = $1 OR b.gift_recipient_user_id = $1) AND b.status != 'inquiry'
         ORDER BY b.created_at DESC`,
        [userId]
      );
    }

    // Anti-disintermediation: in the CLIENT's booking list, mask the
    // photographer's surname while the booking is still UNPAID (pre-payment
    // lead). Once paid, the full name shows for coordination. Photographer-
    // viewer rows carry client_name (no photographer_name) and are untouched.
    for (const b of bookings as Array<Record<string, unknown>>) {
      if (typeof b.photographer_name === "string" && b.payment_status !== "paid") {
        b.photographer_name = maskSurname(b.photographer_name as string);
      }
    }

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("[bookings] get error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to get bookings" }, { status: 500 });
  }
}
