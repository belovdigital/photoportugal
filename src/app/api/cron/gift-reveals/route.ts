import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendGiftRevealEmail } from "@/lib/gift-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Picks up bookings where the gift reveal is due and the email hasn't
// been sent yet, then emails the recipient a magic-link to /gift/claim.
// Runs from server cron every couple of minutes; we use a PG advisory
// lock so overlapping invocations don't double-send.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lock = await queryOne<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock(917365412) as acquired"
  );
  if (!lock?.acquired) {
    return NextResponse.json({ ok: true, skipped: "lock_held" });
  }

  let sent = 0;
  let errors = 0;
  try {
    const rows = await query<{
      booking_id: string;
      gift_recipient_user_id: string;
      gift_recipient_email: string;
      gift_recipient_name: string;
      buyer_name: string;
      photographer_name: string;
      photographer_slug: string;
      package_name: string | null;
      shoot_date: string | null;
      shoot_time: string | null;
      location_slug: string | null;
      location_detail: string | null;
      recipient_locale: string | null;
      buyer_message: string | null;
    }>(
      `SELECT b.id as booking_id, b.gift_recipient_user_id, b.gift_recipient_email,
              b.gift_recipient_name,
              buyer.name as buyer_name,
              pu.name as photographer_name,
              pp.slug as photographer_slug,
              p.name as package_name,
              b.shoot_date::text as shoot_date,
              b.shoot_time,
              b.location_slug,
              b.location_detail,
              r.locale as recipient_locale,
              b.message as buyer_message
         FROM bookings b
         JOIN users buyer ON buyer.id = b.client_id
         JOIN users r ON r.id = b.gift_recipient_user_id
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         LEFT JOIN packages p ON p.id = b.package_id
        WHERE b.is_gift = TRUE
          AND b.gift_reveal_at IS NOT NULL
          AND b.gift_reveal_at <= NOW()
          AND b.gift_reveal_sent_at IS NULL
          AND b.gift_recipient_user_id IS NOT NULL
          AND b.gift_recipient_email IS NOT NULL
        ORDER BY b.gift_reveal_at ASC
        LIMIT 50`
    );

    for (const r of rows) {
      // Lock the row optimistically — set sent_at first, so a parallel
      // worker (even with the advisory lock not held) won't double-send.
      const claimed = await queryOne<{ id: string }>(
        `UPDATE bookings SET gift_reveal_sent_at = NOW()
          WHERE id = $1 AND gift_reveal_sent_at IS NULL
          RETURNING id`,
        [r.booking_id]
      );
      if (!claimed) continue;

      try {
        const locLabel = [
          r.location_detail,
          r.location_slug ? r.location_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null,
        ].filter(Boolean).join(" — ") || null;

        await sendGiftRevealEmail(r.gift_recipient_email, {
          recipientUserId: r.gift_recipient_user_id,
          bookingId: r.booking_id,
          recipientName: r.gift_recipient_name || "there",
          buyerName: r.buyer_name,
          photographerName: r.photographer_name,
          photographerSlug: r.photographer_slug,
          packageName: r.package_name,
          shootDate: r.shoot_date,
          shootTime: r.shoot_time,
          locationLabel: locLabel,
          locale: r.recipient_locale || "en",
          buyerMessage: r.buyer_message,
        });
        sent++;
      } catch (sendErr) {
        // Roll back the sent_at lock so the next cron retries.
        await queryOne(
          "UPDATE bookings SET gift_reveal_sent_at = NULL WHERE id = $1 RETURNING id",
          [r.booking_id]
        ).catch(() => null);
        console.error("[cron/gift-reveals] send error:", sendErr);
        errors++;
      }
    }
  } finally {
    await queryOne("SELECT pg_advisory_unlock(917365412) as released").catch(() => null);
  }

  return NextResponse.json({ ok: true, sent, errors });
}
