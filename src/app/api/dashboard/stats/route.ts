import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";
import { canonicalizeShootType } from "@/lib/shoot-type-labels";

export const dynamic = "force-dynamic";

/**
 * Photographer analytics for /dashboard/stats (web + mobile app).
 *
 * Reads photographer_daily_stats (see db/photographer-analytics.sql and
 * src/lib/photographer-stats-rollup.ts) — never raw sessions — so the
 * request stays cheap no matter how much traffic history exists.
 *
 * Returns COUNTS ONLY. No revenue/fee fields belong here — money lives
 * exclusively in the payouts screen (payout-based, per policy).
 */

const DAY_MS = 86_400_000;
const ALLOWED_WINDOWS = new Set([30, 90, 180]);
const TOP_PHOTOS_WINDOW_DAYS = 30;
const TOP_PHOTOS_LIMIT = 12;
const PLATFORM_INTENT_WINDOW_DAYS = 90;

function lisbonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

function shiftDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function thumbSrc(url: string, thumbnailUrl: string | null): string {
  if (thumbnailUrl) return thumbnailUrl;
  return url.startsWith("/uploads/") ? `/api/img/${url.replace("/uploads/", "")}?w=600&q=80&f=webp` : url;
}

interface DailyRow {
  date: string;
  profile_views: number;
  unique_visitors: number;
  returning_visitors: number;
  card_impressions: number;
  card_clicks: number;
  photo_opens: number;
  concierge_impressions: number;
  concierge_clicks: number;
  gsc_impressions: number | null;
  gsc_clicks: number | null;
  inquiries: number;
  paid_bookings: number;
  book_opens: number;
  missed_matches: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
  sources: Record<string, number>;
  intents: Record<string, number>;
  surfaces: Record<string, number>;
}

interface Totals {
  profileViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  cardImpressions: number;
  cardClicks: number;
  photoOpens: number;
  conciergeImpressions: number;
  conciergeClicks: number;
  gscImpressions: number;
  gscClicks: number;
  inquiries: number;
  paidBookings: number;
  bookOpens: number;
}

function sumTotals(rows: DailyRow[]): Totals {
  const t: Totals = {
    profileViews: 0, uniqueVisitors: 0, returningVisitors: 0,
    cardImpressions: 0, cardClicks: 0, photoOpens: 0,
    conciergeImpressions: 0, conciergeClicks: 0,
    gscImpressions: 0, gscClicks: 0,
    inquiries: 0, paidBookings: 0,
    bookOpens: 0,
  };
  for (const r of rows) {
    t.profileViews += r.profile_views;
    t.uniqueVisitors += r.unique_visitors;
    t.returningVisitors += r.returning_visitors;
    t.cardImpressions += r.card_impressions;
    t.cardClicks += r.card_clicks;
    t.photoOpens += r.photo_opens;
    t.conciergeImpressions += r.concierge_impressions;
    t.conciergeClicks += r.concierge_clicks;
    t.gscImpressions += r.gsc_impressions || 0;
    t.gscClicks += r.gsc_clicks || 0;
    t.inquiries += r.inquiries;
    t.paidBookings += r.paid_bookings;
    t.bookOpens += r.book_opens;
  }
  return t;
}

function mergeBreakdowns(rows: DailyRow[], field: "countries" | "devices" | "sources" | "intents" | "surfaces" | "missed_matches"): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r[field] || {})) {
      out[k] = (out[k] || 0) + (typeof v === "number" ? v : 0);
    }
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{
    id: string;
    user_id: string;
    created_at: string;
    languages: string[] | null;
    shoot_types: string[] | null;
    bio: string | null;
    tagline: string | null;
    cover_url: string | null;
    is_verified: boolean;
    verification_requested_at: string | null;
    telegram_chat_id: string | null;
    avg_response_minutes: number | null;
    avatar_url: string | null;
  }>(
    `SELECT pp.id, pp.user_id, pp.created_at, pp.languages, pp.shoot_types, pp.bio, pp.tagline,
            pp.cover_url, pp.is_verified, pp.verification_requested_at, pp.telegram_chat_id,
            pp.avg_response_minutes, u.avatar_url
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     WHERE pp.user_id = $1`,
    [user.id],
  );
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "90", 10);
  const days = ALLOWED_WINDOWS.has(daysParam) ? daysParam : 90;

  const today = lisbonToday();
  const from = shiftDays(today, -(days - 1));
  const prevFrom = shiftDays(from, -days);

  try {
    const rows = await query<DailyRow & { date: string }>(
      `SELECT date::text AS date, profile_views, unique_visitors, returning_visitors,
              card_impressions, card_clicks, photo_opens, book_opens,
              concierge_impressions, concierge_clicks,
              gsc_impressions, gsc_clicks,
              inquiries, paid_bookings,
              countries, devices, sources, intents, surfaces, missed_matches
       FROM photographer_daily_stats
       WHERE photographer_id = $1 AND date >= $2::date
       ORDER BY date ASC`,
      [profile.id, prevFrom],
    );

    const current = rows.filter((r) => r.date >= from);
    const previous = rows.filter((r) => r.date < from);

    // Sparse rows → dense timeline (missing days rendered as zeros)
    const byDate = new Map(current.map((r) => [r.date, r]));
    const timeline = Array.from({ length: days }, (_, i) => {
      const date = shiftDays(from, i);
      const r = byDate.get(date);
      return {
        date,
        views: r?.profile_views || 0,
        uniques: r?.unique_visitors || 0,
        impressions: r?.card_impressions || 0,
        clicks: r?.card_clicks || 0,
        conciergeImpressions: r?.concierge_impressions || 0,
        gscImpressions: r?.gsc_impressions || 0,
        inquiries: r?.inquiries || 0,
        paid: r?.paid_bookings || 0,
        bookOpens: r?.book_opens || 0,
      };
    }).filter((d) => d.date <= today);

    const REPLY_CTE = (photographerFilter: string) => `
      WITH b AS (
        SELECT b.id, b.created_at, b.package_id, b.total_price, b.client_id, pp.user_id AS ph_user
        FROM bookings b JOIN photographer_profiles pp ON pp.id = b.photographer_id
        WHERE b.photographer_id IS NOT NULL ${photographerFilter} AND b.created_at >= $1::date
      ), f AS (
        SELECT b.id, b.package_id, b.total_price,
          fm.created_at AS first_client, fr.created_at AS first_reply,
          EXISTS (SELECT 1 FROM messages mo WHERE mo.booking_id = b.id AND mo.sender_id = b.ph_user AND mo.text LIKE 'BOOKING_CARD:%') AS card_sent
        FROM b
        LEFT JOIN LATERAL (
          SELECT m.created_at FROM messages m
          WHERE m.booking_id = b.id AND m.sender_id = b.client_id AND m.is_system = FALSE
          ORDER BY m.created_at LIMIT 1) fm ON TRUE
        LEFT JOIN LATERAL (
          SELECT m.created_at FROM messages m
          WHERE m.booking_id = b.id AND m.sender_id = b.ph_user AND m.is_system = FALSE
            AND fm.created_at IS NOT NULL AND m.created_at > fm.created_at
          ORDER BY m.created_at LIMIT 1) fr ON TRUE
      )
      SELECT COUNT(*)::int AS inq,
        COUNT(*) FILTER (WHERE card_sent OR package_id IS NOT NULL OR COALESCE(total_price, 0) > 0)::int AS offered,
        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_reply - first_client)) / 60)
           FILTER (WHERE first_reply IS NOT NULL))::int AS median_reply,
        (PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_reply - first_client)) / 60)
           FILTER (WHERE first_reply IS NOT NULL))::int AS p25_reply
      FROM f`;

    const [photoRows, platformBookingIntents, platformConciergeIntents, meta,
           myReply, platformReply, offerImpactRows, benchRow, annotationRows,
           portfolioCountRow, packagesCountRow, locationsCountRow] = await Promise.all([
      query<{ id: string; url: string; thumbnail_url: string | null; caption: string | null; sort_order: number | null; opens: number }>(
        `SELECT pi.id, pi.url, pi.thumbnail_url, pi.caption, pi.sort_order, SUM(s.opens)::int AS opens
         FROM portfolio_item_daily_stats s
         JOIN portfolio_items pi ON pi.id = s.item_id
         WHERE s.photographer_id = $1 AND s.date >= $2::date
         GROUP BY pi.id, pi.url, pi.thumbnail_url, pi.caption, pi.sort_order
         ORDER BY opens DESC
         LIMIT ${TOP_PHOTOS_LIMIT}`,
        [profile.id, shiftDays(today, -(TOP_PHOTOS_WINDOW_DAYS - 1))],
      ),
      query<{ occasion: string; count: number }>(
        `SELECT occasion, COUNT(*)::int AS count FROM bookings
         WHERE occasion IS NOT NULL AND created_at > NOW() - INTERVAL '${PLATFORM_INTENT_WINDOW_DAYS} days'
         GROUP BY occasion`,
      ),
      query<{ occasion: string; count: number }>(
        `SELECT occasion, COUNT(*)::int AS count FROM concierge_chats
         WHERE occasion IS NOT NULL AND created_at > NOW() - INTERVAL '${PLATFORM_INTENT_WINDOW_DAYS} days'
         GROUP BY occasion`,
      ),
      queryOne<{ data_since: string | null; card_since: string | null; gsc_since: string | null }>(
        `SELECT MIN(date)::text AS data_since,
                MIN(date) FILTER (WHERE card_impressions > 0)::text AS card_since,
                MIN(date) FILTER (WHERE gsc_impressions IS NOT NULL)::text AS gsc_since
         FROM photographer_daily_stats WHERE photographer_id = $1`,
        [profile.id],
      ),
      queryOne<{ inq: number; offered: number; median_reply: number | null; p25_reply: number | null }>(
        REPLY_CTE("AND b.photographer_id = $2"), [from, profile.id],
      ),
      queryOne<{ inq: number; offered: number; median_reply: number | null; p25_reply: number | null }>(
        REPLY_CTE(""), [from],
      ),
      // Offer-speed impact, platform-wide, matured bookings only (≥7 days
      // old so "never offered" isn't just "created yesterday").
      query<{ bucket: string; n: number; paid: number }>(
        `WITH b AS (
           SELECT b.id, b.created_at, b.payment_status, b.package_id,
                  pp.user_id AS ph_user
           FROM bookings b JOIN photographer_profiles pp ON pp.id = b.photographer_id
           WHERE b.created_at BETWEEN NOW() - INTERVAL '180 days' AND NOW() - INTERVAL '7 days'
         ), x AS (
           SELECT b.*, (SELECT MIN(m.created_at) FROM messages m
                        WHERE m.booking_id = b.id AND m.sender_id = b.ph_user
                          AND m.text LIKE 'BOOKING_CARD:%') AS card_at
           FROM b
         )
         SELECT CASE
             WHEN (package_id IS NOT NULL AND card_at IS NULL)
               OR (card_at IS NOT NULL AND card_at <= created_at + INTERVAL '24 hours') THEN 'fast'
             WHEN card_at IS NOT NULL THEN 'slow'
             ELSE 'never'
           END AS bucket,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid
         FROM x GROUP BY 1`,
      ),
      // Benchmarks: photographers sharing a location (≥5) else platform.
      queryOne<{ used_peers: number; n: number; med_views: number | null; med_conv: number | null; med_reply: number | null }>(
        `WITH peers AS (
           SELECT DISTINCT pl2.photographer_id AS id
           FROM photographer_locations pl1
           JOIN photographer_locations pl2 ON pl2.location_slug = pl1.location_slug
           WHERE pl1.photographer_id = $1
         ), pool AS (
           SELECT (SELECT COUNT(*) FROM peers) >= 5 AS use_peers
         ), members AS (
           SELECT pp.id FROM photographer_profiles pp, pool WHERE NOT pool.use_peers AND pp.is_approved = TRUE
           UNION ALL
           SELECT peers.id FROM peers, pool WHERE pool.use_peers
         ), agg AS (
           SELECT s.photographer_id,
                  SUM(s.profile_views)::float AS views,
                  SUM(s.unique_visitors)::float AS uniq,
                  SUM(s.inquiries)::float AS inq
           FROM photographer_daily_stats s JOIN members m ON m.id = s.photographer_id
           WHERE s.date >= $2::date GROUP BY 1
         )
         SELECT (SELECT use_peers FROM pool)::int AS used_peers,
                (SELECT COUNT(*) FROM members)::int AS n,
                (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY views))::int AS med_views,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (CASE WHEN uniq > 0 THEN inq / uniq END)) AS med_conv,
                (SELECT (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ppx.avg_response_minutes))::int
                   FROM photographer_profiles ppx JOIN members mx ON mx.id = ppx.id
                  WHERE ppx.avg_response_minutes IS NOT NULL) AS med_reply
         FROM agg`,
        [profile.id, from],
      ),
      query<{ date: string; field: string }>(
        `SELECT DISTINCT ((occurred_at AT TIME ZONE 'Europe/Lisbon')::date)::text AS date, field
         FROM photographer_profile_changes
         WHERE photographer_id = $1 AND occurred_at >= $2::date
         ORDER BY 1`,
        [profile.id, from],
      ),
      queryOne<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM portfolio_items WHERE photographer_id = $1", [profile.id],
      ),
      queryOne<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM packages WHERE photographer_id = $1 AND is_public = TRUE AND revoked_at IS NULL", [profile.id],
      ),
      queryOne<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM photographer_locations WHERE photographer_id = $1", [profile.id],
      ),
    ]);

    // Platform-wide demand mix — the "am I offering what people are
    // searching for?" comparison photographers asked for.
    const platformIntents: Record<string, number> = {};
    for (const r of [...platformBookingIntents, ...platformConciergeIntents]) {
      const key = canonicalizeShootType(r.occasion) || r.occasion;
      platformIntents[key] = (platformIntents[key] || 0) + r.count;
    }

    // ── Profile score & suggested actions ─────────────────────────────
    const portfolioCount = portfolioCountRow?.n || 0;
    const packagesCount = packagesCountRow?.n || 0;
    const locationsCount = locationsCountRow?.n || 0;
    const checks: { key: string; ok: boolean; weight: number; href: string }[] = [
      { key: "portfolio", ok: portfolioCount >= 8, weight: 15, href: "/dashboard/portfolio" },
      { key: "packages", ok: packagesCount >= 1, weight: 15, href: "/dashboard/packages" },
      { key: "languages", ok: (profile.languages || []).length >= 1, weight: 10, href: "/dashboard/profile" },
      { key: "bio", ok: (profile.bio || "").trim().length >= 200, weight: 10, href: "/dashboard/profile" },
      { key: "shootTypes", ok: (profile.shoot_types || []).length >= 2, weight: 10, href: "/dashboard/profile" },
      { key: "locations", ok: locationsCount >= 1, weight: 10, href: "/dashboard/profile" },
      { key: "verified", ok: profile.is_verified || Boolean(profile.verification_requested_at), weight: 10, href: "/dashboard/settings" },
      { key: "tagline", ok: (profile.tagline || "").trim().length > 0, weight: 5, href: "/dashboard/profile" },
      { key: "avatar", ok: Boolean(profile.avatar_url), weight: 5, href: "/dashboard/profile" },
      { key: "cover", ok: Boolean(profile.cover_url), weight: 5, href: "/dashboard/profile" },
      { key: "telegram", ok: Boolean(profile.telegram_chat_id), weight: 5, href: "/dashboard/settings" },
    ];
    const scoreTotal = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);

    const myInq = myReply?.inq || 0;
    const myOffered = myReply?.offered || 0;
    const actions: { key: string; href: string }[] = [];
    // Stat-driven actions outrank checklist gaps — they map to the
    // proven leak (inquiries without an offer).
    if (myInq >= 3 && myOffered / myInq < 0.5) actions.push({ key: "sendOffers", href: "/dashboard/messages" });
    if ((myReply?.median_reply ?? 0) > 24 * 60) actions.push({ key: "replyFaster", href: "/dashboard/messages" });
    for (const c of [...checks].filter((c) => !c.ok).sort((a, b) => b.weight - a.weight)) {
      if (actions.length >= 3) break;
      actions.push({ key: c.key, href: c.href });
    }

    const impact = { fast: { n: 0, paid: 0 }, slow: { n: 0, paid: 0 }, never: { n: 0, paid: 0 } };
    for (const r of offerImpactRows) {
      if (r.bucket === "fast" || r.bucket === "slow" || r.bucket === "never") impact[r.bucket] = { n: r.n, paid: r.paid };
    }

    const missedMatches = mergeBreakdowns(current, "missed_matches");

    return NextResponse.json({
      range: { from, to: today, days },
      totals: { current: sumTotals(current), previous: sumTotals(previous) },
      timeline,
      breakdowns: {
        countries: mergeBreakdowns(current, "countries"),
        devices: mergeBreakdowns(current, "devices"),
        sources: mergeBreakdowns(current, "sources"),
        intents: mergeBreakdowns(current, "intents"),
        surfaces: mergeBreakdowns(current, "surfaces"),
      },
      platformIntents: Object.fromEntries(Object.entries(platformIntents).sort((a, b) => b[1] - a[1]).slice(0, 12)),
      photos: photoRows.map((p) => ({
        id: p.id,
        thumb: thumbSrc(p.url, p.thumbnail_url),
        caption: p.caption,
        position: p.sort_order,
        opens: p.opens,
      })),
      responseStats: {
        inquiries: myInq,
        offered: myOffered,
        medianReplyMinutes: myReply?.median_reply ?? null,
        lifetimeAvgReplyMinutes: profile.avg_response_minutes,
        platform: {
          medianReplyMinutes: platformReply?.median_reply ?? null,
          p25ReplyMinutes: platformReply?.p25_reply ?? null,
          inquiries: platformReply?.inq || 0,
          offered: platformReply?.offered || 0,
        },
        offerImpact: impact,
      },
      benchmarks: benchRow
        ? {
            pool: benchRow.used_peers ? "peers" : "platform",
            n: benchRow.n,
            medViews: benchRow.med_views,
            medConvPct: benchRow.med_conv !== null ? Math.round(Number(benchRow.med_conv) * 1000) / 10 : null,
            medReplyMinutes: benchRow.med_reply,
          }
        : null,
      score: { total: scoreTotal, max: 100, checks, actions },
      annotations: annotationRows,
      missedMatches,
      meta: {
        today,
        dataSince: meta?.data_since || null,
        cardDataSince: meta?.card_since || null,
        gscDataSince: meta?.gsc_since || null,
        profileCreatedAt: profile.created_at,
      },
    });
  } catch (e) {
    console.error("[dashboard/stats]", e);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
