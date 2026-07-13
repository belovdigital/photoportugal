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
}

function sumTotals(rows: DailyRow[]): Totals {
  const t: Totals = {
    profileViews: 0, uniqueVisitors: 0, returningVisitors: 0,
    cardImpressions: 0, cardClicks: 0, photoOpens: 0,
    conciergeImpressions: 0, conciergeClicks: 0,
    gscImpressions: 0, gscClicks: 0,
    inquiries: 0, paidBookings: 0,
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
  }
  return t;
}

function mergeBreakdowns(rows: DailyRow[], field: "countries" | "devices" | "sources" | "intents" | "surfaces"): Record<string, number> {
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

  const profile = await queryOne<{ id: string; created_at: string }>(
    "SELECT id, created_at FROM photographer_profiles WHERE user_id = $1",
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
              card_impressions, card_clicks, photo_opens,
              concierge_impressions, concierge_clicks,
              gsc_impressions, gsc_clicks,
              inquiries, paid_bookings,
              countries, devices, sources, intents, surfaces
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
      };
    }).filter((d) => d.date <= today);

    const [photoRows, platformBookingIntents, platformConciergeIntents, meta] = await Promise.all([
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
    ]);

    // Platform-wide demand mix — the "am I offering what people are
    // searching for?" comparison photographers asked for.
    const platformIntents: Record<string, number> = {};
    for (const r of [...platformBookingIntents, ...platformConciergeIntents]) {
      const key = canonicalizeShootType(r.occasion) || r.occasion;
      platformIntents[key] = (platformIntents[key] || 0) + r.count;
    }

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
