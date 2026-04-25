import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "year" | "custom";

function resolvePeriod(period: string, from?: string | null, to?: string | null): {
  where: string;
  prevWhere: string;
  bucket: "hour" | "day" | "week" | "month";
} {
  switch (period) {
    case "today":
      return {
        where: "started_at >= DATE_TRUNC('day', NOW())",
        prevWhere: "started_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day') AND started_at < DATE_TRUNC('day', NOW())",
        bucket: "hour",
      };
    case "yesterday":
      return {
        where: "started_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day') AND started_at < DATE_TRUNC('day', NOW())",
        prevWhere: "started_at >= DATE_TRUNC('day', NOW() - INTERVAL '2 days') AND started_at < DATE_TRUNC('day', NOW() - INTERVAL '1 day')",
        bucket: "hour",
      };
    case "7d":
      return {
        where: "started_at >= NOW() - INTERVAL '7 days'",
        prevWhere: "started_at >= NOW() - INTERVAL '14 days' AND started_at < NOW() - INTERVAL '7 days'",
        bucket: "day",
      };
    case "year":
      return {
        where: "started_at >= NOW() - INTERVAL '1 year'",
        prevWhere: "started_at >= NOW() - INTERVAL '2 years' AND started_at < NOW() - INTERVAL '1 year'",
        bucket: "week",
      };
    case "custom": {
      if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        const spanDays = Math.max(1, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
        return {
          where: `started_at >= '${from}'::date AND started_at < ('${to}'::date + INTERVAL '1 day')`,
          prevWhere: `started_at >= '${from}'::date - INTERVAL '${spanDays + 1} days' AND started_at < '${from}'::date`,
          bucket: spanDays <= 2 ? "hour" : spanDays <= 62 ? "day" : spanDays <= 365 ? "week" : "month",
        };
      }
      // fall through to default
    }
    case "30d":
    default:
      return {
        where: "started_at >= NOW() - INTERVAL '30 days'",
        prevWhere: "started_at >= NOW() - INTERVAL '60 days' AND started_at < NOW() - INTERVAL '30 days'",
        bucket: "day",
      };
  }
}

// Same WHERE clause but for bookings.created_at
const bk = (w: string) => w.replace(/started_at/g, "b.created_at");

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const period = (url.searchParams.get("period") || "30d") as PeriodKey;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const { where, prevWhere, bucket } = resolvePeriod(period, from, to);

  // Keep current partial bucket filtered out for non-"today" periods (consistent with charts)
  const excludePartial = period !== "today"
    ? `AND DATE_TRUNC('${bucket}', started_at) < DATE_TRUNC('${bucket}', NOW())`
    : "";

  let visitorStats, visitorStatsPrev, liveCount, bookingStats, bookingStatsPrev,
      sessionSeries, bookingSeries, revenueBySource, revenueByLocation, funnel, heatmap;
  try {
    [
      visitorStats,
      visitorStatsPrev,
      liveCount,
      bookingStats,
      bookingStatsPrev,
      sessionSeries,
      bookingSeries,
      revenueBySource,
      revenueByLocation,
      funnel,
      heatmap,
    ] = await Promise.all([
    // Visitors + sessions for current period
    queryOne<{ visitors: string; sessions: string }>(`
      SELECT COUNT(DISTINCT visitor_id) as visitors, COUNT(*) as sessions
      FROM visitor_sessions WHERE ${where}
    `),
    queryOne<{ visitors: string; sessions: string }>(`
      SELECT COUNT(DISTINCT visitor_id) as visitors, COUNT(*) as sessions
      FROM visitor_sessions WHERE ${prevWhere}
    `),
    // Live: active sessions (last activity within last 5 min)
    queryOne<{ count: string }>(`
      SELECT COUNT(DISTINCT visitor_id) as count FROM visitor_sessions
      WHERE last_activity_at >= NOW() - INTERVAL '5 minutes'
    `).catch(() => ({ count: "0" })),
    // Bookings (created in period) — counts and revenue
    queryOne<{ paid: string; inquiries: string; pending: string; cancelled: string; revenue: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND status NOT IN ('inquiry','cancelled'))::text as paid,
        COUNT(*) FILTER (WHERE status = 'inquiry')::text as inquiries,
        COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
        COUNT(*) FILTER (WHERE status = 'cancelled')::text as cancelled,
        COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid' AND status NOT IN ('inquiry','cancelled')), 0)::text as revenue
      FROM bookings b WHERE ${bk(where)}
    `),
    queryOne<{ paid: string; revenue: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND status NOT IN ('inquiry','cancelled'))::text as paid,
        COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid' AND status NOT IN ('inquiry','cancelled')), 0)::text as revenue
      FROM bookings b WHERE ${bk(prevWhere)}
    `),
    // Session time series (visitors + sessions per bucket)
    query<{ day: string; sessions: string; visitors: string }>(`
      SELECT DATE_TRUNC('${bucket}', started_at)::text as day,
             COUNT(*)::text as sessions,
             COUNT(DISTINCT visitor_id)::text as visitors
      FROM visitor_sessions
      WHERE ${where} ${excludePartial}
      GROUP BY DATE_TRUNC('${bucket}', started_at)
      ORDER BY day ASC
    `),
    // Booking time series (paid bookings + revenue per bucket)
    query<{ day: string; bookings: string; revenue: string }>(`
      SELECT DATE_TRUNC('${bucket}', b.created_at)::text as day,
             COUNT(*) FILTER (WHERE payment_status = 'paid' AND status NOT IN ('inquiry','cancelled'))::text as bookings,
             COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid' AND status NOT IN ('inquiry','cancelled')), 0)::text as revenue
      FROM bookings b
      WHERE ${bk(where)} ${excludePartial.replace(/started_at/g, "b.created_at")}
      GROUP BY DATE_TRUNC('${bucket}', b.created_at)
      ORDER BY day ASC
    `),
    // Revenue by traffic source (clients who signed up in period → their bookings in period)
    query<{ source: string; medium: string | null; users: string; paid_bookings: string; revenue: string }>(`
      SELECT
        COALESCE(u.utm_source, 'direct') as source,
        u.utm_medium as medium,
        COUNT(DISTINCT u.id)::text as users,
        COUNT(b.id) FILTER (WHERE b.payment_status = 'paid' AND b.status NOT IN ('inquiry','cancelled'))::text as paid_bookings,
        COALESCE(SUM(b.total_price) FILTER (WHERE b.payment_status = 'paid' AND b.status NOT IN ('inquiry','cancelled')), 0)::text as revenue
      FROM users u
      LEFT JOIN bookings b ON b.client_id = u.id AND ${bk(where)}
      WHERE u.created_at >= NOW() - INTERVAL '2 years'
      GROUP BY COALESCE(u.utm_source, 'direct'), u.utm_medium
      HAVING COUNT(DISTINCT u.id) > 0 OR COUNT(b.id) > 0
      ORDER BY COALESCE(SUM(b.total_price) FILTER (WHERE b.payment_status = 'paid' AND b.status NOT IN ('inquiry','cancelled')), 0) DESC,
               COUNT(b.id) FILTER (WHERE b.payment_status = 'paid' AND b.status NOT IN ('inquiry','cancelled')) DESC
      LIMIT 8
    `),
    // Revenue by location (from paid bookings in period)
    query<{ location_slug: string; bookings: string; revenue: string }>(`
      SELECT COALESCE(b.location_slug, 'unknown') as location_slug,
             COUNT(*)::text as bookings,
             COALESCE(SUM(total_price), 0)::text as revenue
      FROM bookings b
      WHERE ${bk(where)} AND payment_status = 'paid' AND status NOT IN ('inquiry','cancelled')
      GROUP BY COALESCE(b.location_slug, 'unknown')
      ORDER BY COALESCE(SUM(total_price), 0) DESC
      LIMIT 8
    `),
    // Simple funnel: Visitors → Viewed photographer → Inquiry → Booking created → Paid
    queryOne<{ visitors: string; viewed: string; inquiry: string; created: string; paid: string }>(`
      SELECT
        (SELECT COUNT(DISTINCT visitor_id) FROM visitor_sessions WHERE ${where})::text as visitors,
        (SELECT COUNT(DISTINCT vs.visitor_id) FROM visitor_sessions vs
          WHERE ${where} AND (vs.landing_page LIKE '/photographers/%' OR vs.pageviews::text LIKE '%/photographers/%')
        )::text as viewed,
        (SELECT COUNT(*) FROM bookings b WHERE ${bk(where)} AND b.status = 'inquiry')::text as inquiry,
        (SELECT COUNT(*) FROM bookings b WHERE ${bk(where)} AND b.status NOT IN ('inquiry','cancelled'))::text as created,
        (SELECT COUNT(*) FROM bookings b WHERE ${bk(where)} AND b.payment_status = 'paid' AND b.status NOT IN ('inquiry','cancelled'))::text as paid
    `),
    // Heatmap: sessions by weekday (0=Sun..6=Sat) × hour (0..23)
    query<{ dow: string; hour: string; count: string }>(`
      SELECT EXTRACT(DOW FROM started_at)::text as dow,
             EXTRACT(HOUR FROM started_at)::text as hour,
             COUNT(*)::text as count
      FROM visitor_sessions
      WHERE ${where}
      GROUP BY EXTRACT(DOW FROM started_at), EXTRACT(HOUR FROM started_at)
    `),
    ]);
  } catch (err) {
    console.error("[admin/overview] query error:", err);
    return NextResponse.json({ error: "Query failed", detail: (err as Error).message }, { status: 500 });
  }

  const conversionRate = (() => {
    const visitors = parseInt(visitorStats?.visitors || "0");
    const paid = parseInt(bookingStats?.paid || "0");
    return visitors > 0 ? (paid / visitors) * 100 : 0;
  })();
  const conversionRatePrev = (() => {
    const visitors = parseInt(visitorStatsPrev?.visitors || "0");
    const paid = parseInt(bookingStatsPrev?.paid || "0");
    return visitors > 0 ? (paid / visitors) * 100 : 0;
  })();

  return NextResponse.json({
    period,
    bucket,
    summary: {
      visitors: parseInt(visitorStats?.visitors || "0"),
      visitorsPrev: parseInt(visitorStatsPrev?.visitors || "0"),
      sessions: parseInt(visitorStats?.sessions || "0"),
      sessionsPrev: parseInt(visitorStatsPrev?.sessions || "0"),
      bookings: parseInt(bookingStats?.paid || "0"),
      bookingsPrev: parseInt(bookingStatsPrev?.paid || "0"),
      revenue: parseFloat(bookingStats?.revenue || "0"),
      revenuePrev: parseFloat(bookingStatsPrev?.revenue || "0"),
      conversionRate: Math.round(conversionRate * 100) / 100,
      conversionRatePrev: Math.round(conversionRatePrev * 100) / 100,
      inquiries: parseInt(bookingStats?.inquiries || "0"),
      pending: parseInt(bookingStats?.pending || "0"),
      cancelled: parseInt(bookingStats?.cancelled || "0"),
    },
    live: {
      count: parseInt(liveCount?.count || "0"),
    },
    sessionSeries,
    bookingSeries,
    revenueBySource,
    revenueByLocation,
    funnel: {
      visitors: parseInt(funnel?.visitors || "0"),
      viewed: parseInt(funnel?.viewed || "0"),
      inquiry: parseInt(funnel?.inquiry || "0"),
      created: parseInt(funnel?.created || "0"),
      paid: parseInt(funnel?.paid || "0"),
    },
    heatmap: heatmap.map(h => ({ dow: parseInt(h.dow), hour: parseInt(h.hour), count: parseInt(h.count) })),
  });
}
