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

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const sessionLimit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 200);
  const roleFilter = url.searchParams.get("role") || "all";
  const countryFilter = url.searchParams.get("country") || "all";

  // Summary stats
  const [summary, summaryPrev] = await Promise.all([
    queryOne<{ sessions: string; visitors: string; linked: string; avg_pages: string; avg_duration: string }>(`
      SELECT COUNT(*) as sessions,
             COUNT(DISTINCT visitor_id) as visitors,
             COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as linked,
             ROUND(AVG(pageview_count), 1)::text as avg_pages,
             ROUND(AVG(EXTRACT(EPOCH FROM last_activity_at - started_at) / 60), 1)::text as avg_duration
      FROM visitor_sessions
      WHERE started_at >= NOW() - INTERVAL '30 days'
    `),
    queryOne<{ sessions: string; visitors: string }>(`
      SELECT COUNT(*) as sessions, COUNT(DISTINCT visitor_id) as visitors
      FROM visitor_sessions
      WHERE started_at >= NOW() - INTERVAL '60 days' AND started_at < NOW() - INTERVAL '30 days'
    `),
  ]);

  // Today stats
  const today = await queryOne<{ sessions: string; visitors: string }>(`
    SELECT COUNT(*) as sessions, COUNT(DISTINCT visitor_id) as visitors
    FROM visitor_sessions WHERE started_at >= CURRENT_DATE
  `);

  // Device breakdown
  const devices = await query<{ device_type: string; count: string }>(`
    SELECT COALESCE(device_type, 'unknown') as device_type, COUNT(*)::text as count
    FROM visitor_sessions WHERE started_at >= NOW() - INTERVAL '30 days'
    GROUP BY device_type ORDER BY count DESC
  `);

  // Country breakdown
  const countries = await query<{ country: string; count: string }>(`
    SELECT COALESCE(country, '??') as country, COUNT(*)::text as count
    FROM visitor_sessions WHERE started_at >= NOW() - INTERVAL '30 days'
    GROUP BY country ORDER BY count DESC LIMIT 15
  `);

  // Traffic sources (UTM + referrer)
  const sources = await query<{ source: string; count: string }>(`
    SELECT COALESCE(
      CASE
        WHEN utm_source IS NOT NULL AND utm_medium = 'cpc' THEN utm_source || ' (ads)'
        WHEN utm_source IS NOT NULL THEN utm_source
        WHEN referrer IS NOT NULL AND referrer != '' THEN
          CASE
            WHEN referrer ILIKE '%google%' THEN 'Google (organic)'
            WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%instagram%' THEN 'Social'
            WHEN referrer ILIKE '%photoportugal%' THEN 'Direct'
            ELSE SUBSTRING(referrer FROM 'https?://([^/]+)')
          END
        ELSE 'Direct'
      END,
      'Direct'
    ) as source,
    COUNT(*)::text as count
    FROM visitor_sessions WHERE started_at >= NOW() - INTERVAL '30 days'
    GROUP BY source ORDER BY count DESC LIMIT 10
  `);

  // Top landing pages
  const landingPages = await query<{ page: string; count: string }>(`
    SELECT COALESCE(landing_page, '/') as page, COUNT(*)::text as count
    FROM visitor_sessions WHERE started_at >= NOW() - INTERVAL '30 days'
    GROUP BY landing_page ORDER BY count DESC LIMIT 15
  `);

  // Recent sessions
  // Filter out bots: Googlebot, headless crawlers, and high-frequency scrapers
  const botFilter = `AND vs.user_agent NOT ILIKE '%googlebot%'
    AND vs.user_agent NOT ILIKE '%AdsBot%'
    AND vs.user_agent NOT ILIKE '%Mediapartners%'
    AND vs.user_agent NOT ILIKE '%bingbot%'
    AND vs.user_agent NOT ILIKE '%AhrefsBot%'
    AND vs.user_agent NOT ILIKE '%SemrushBot%'
    AND vs.user_agent NOT ILIKE '%HeadlessChrome%'
    AND vs.visitor_id NOT IN (
      SELECT visitor_id FROM visitor_sessions
      WHERE started_at >= NOW() - INTERVAL '1 hour'
      GROUP BY visitor_id HAVING COUNT(*) > 10
    )`;

  // Base filters that can run cheaply against visitor_sessions alone (no users join needed).
  // Role filter for "guest" is also cheap (just vs.user_id IS NULL). Other role filters need
  // the users join — applied after we've limited to a small candidate set.
  const baseRoleWhere = roleFilter === "guest" ? "AND vs.user_id IS NULL" : "";
  const postRoleWhere = roleFilter === "client" ? "AND u.role = 'client'"
    : roleFilter === "photographer" ? "AND u.role = 'photographer'"
    : roleFilter === "guest" ? ""
    : "AND (u.role IS NULL OR u.role != 'admin')";
  const countryWhere = countryFilter !== "all" ? `AND vs.country = $1` : "";
  const params: (string | number)[] = [];
  if (countryFilter !== "all") params.push(countryFilter);
  // Oversample when a post-join role filter could trim rows so we still fill the page.
  const overSample = (roleFilter === "client" || roleFilter === "photographer") ? 5 : 2;
  const baseLimitParam = `$${params.length + 1}`;
  params.push(sessionLimit * overSample);
  const outerLimitParam = `$${params.length + 1}`;
  params.push(sessionLimit);
  const recentSessions = await query<{
    id: string; visitor_id: string; user_name: string | null; user_email: string | null;
    user_role: string | null;
    device_type: string | null; country: string | null; language: string | null;
    landing_page: string | null; referrer: string | null; utm_source: string | null;
    utm_medium: string | null; utm_term: string | null;
    pageview_count: number; started_at: string; pageviews: string | null;
    visit_number: number; total_visits: number;
  }>(`
    WITH base AS (
      SELECT vs.id, vs.visitor_id, vs.user_id,
             vs.device_type, vs.country, vs.language,
             vs.landing_page, vs.referrer, vs.utm_source, vs.utm_medium, vs.utm_term,
             vs.pageview_count, vs.started_at, vs.pageviews::text
      FROM visitor_sessions vs
      WHERE 1=1 ${botFilter} ${baseRoleWhere} ${countryWhere}
      ORDER BY vs.started_at DESC
      LIMIT ${baseLimitParam}
    )
    SELECT b.id, b.visitor_id,
           COALESCE(b.user_id, linked.linked_uid) AS user_id,
           u.name AS user_name, u.email AS user_email, u.role AS user_role,
           b.device_type, b.country, b.language,
           b.landing_page, b.referrer, b.utm_source, b.utm_medium, b.utm_term,
           b.pageview_count, b.started_at, b.pageviews,
           COALESCE(vc.total_visits, 1) AS total_visits,
           ROW_NUMBER() OVER (PARTITION BY COALESCE(COALESCE(b.user_id, linked.linked_uid)::text, b.visitor_id) ORDER BY b.started_at) AS visit_number
    FROM base b
    LEFT JOIN LATERAL (
      SELECT user_id AS linked_uid FROM (
        SELECT vs3.user_id FROM visitor_sessions vs3
        WHERE vs3.visitor_id = b.visitor_id AND vs3.user_id IS NOT NULL
        ORDER BY vs3.started_at DESC LIMIT 1
      ) s
      UNION ALL
      SELECT u2.id FROM users u2 WHERE u2.visitor_id = b.visitor_id
      LIMIT 1
    ) linked ON TRUE
    LEFT JOIN users u ON u.id = COALESCE(b.user_id, linked.linked_uid)
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total_visits FROM visitor_sessions vs2
      WHERE COALESCE(vs2.user_id::text, vs2.visitor_id) = COALESCE(COALESCE(b.user_id, linked.linked_uid)::text, b.visitor_id)
    ) vc ON TRUE
    WHERE 1=1 ${postRoleWhere}
    ORDER BY b.started_at DESC
    LIMIT ${outerLimitParam}
  `, params);

  // Period-aware time series for the sessions chart.
  // period: today | yesterday | 7d | 30d | year | custom
  // For custom: accepts from/to (YYYY-MM-DD).
  const period = url.searchParams.get("period") || "30d";
  const customFrom = url.searchParams.get("from");
  const customTo = url.searchParams.get("to");
  let seriesWhere = "started_at >= NOW() - INTERVAL '30 days'";
  let seriesBucket: "hour" | "day" | "week" | "month" = "day";
  switch (period) {
    case "today":
      seriesWhere = "started_at >= DATE_TRUNC('day', NOW())";
      seriesBucket = "hour";
      break;
    case "yesterday":
      seriesWhere = "started_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day') AND started_at < DATE_TRUNC('day', NOW())";
      seriesBucket = "hour";
      break;
    case "7d":
      seriesWhere = "started_at >= NOW() - INTERVAL '7 days'";
      seriesBucket = "day";
      break;
    case "30d":
      seriesWhere = "started_at >= NOW() - INTERVAL '30 days'";
      seriesBucket = "day";
      break;
    case "year":
      seriesWhere = "started_at >= NOW() - INTERVAL '1 year'";
      seriesBucket = "week";
      break;
    case "custom": {
      if (customFrom && customTo && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) && /^\d{4}-\d{2}-\d{2}$/.test(customTo)) {
        seriesWhere = `started_at >= '${customFrom}'::date AND started_at < ('${customTo}'::date + INTERVAL '1 day')`;
        const spanDays = Math.floor((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000);
        seriesBucket = spanDays <= 2 ? "hour" : spanDays <= 62 ? "day" : spanDays <= 365 ? "week" : "month";
      }
      break;
    }
  }
  // Skip the current (partial) bucket for non-"today" periods — an incomplete "today"
  // would render as a misleading drop at the end of the chart.
  const excludePartial = period !== "today"
    ? `AND DATE_TRUNC('${seriesBucket}', started_at) < DATE_TRUNC('${seriesBucket}', NOW())`
    : "";
  const dailySessions = await query<{ day: string; sessions: string; visitors: string }>(`
    SELECT DATE_TRUNC('${seriesBucket}', started_at)::text as day,
           COUNT(*)::text as sessions,
           COUNT(DISTINCT visitor_id)::text as visitors
    FROM visitor_sessions
    WHERE ${seriesWhere} ${excludePartial}
    GROUP BY DATE_TRUNC('${seriesBucket}', started_at)
    ORDER BY day ASC
  `);

  return NextResponse.json({
    summary: {
      sessions: parseInt(summary?.sessions || "0"),
      sessionsPrev: parseInt(summaryPrev?.sessions || "0"),
      visitors: parseInt(summary?.visitors || "0"),
      visitorsPrev: parseInt(summaryPrev?.visitors || "0"),
      linked: parseInt(summary?.linked || "0"),
      avgPages: parseFloat(summary?.avg_pages || "0"),
      avgDuration: parseFloat(summary?.avg_duration || "0"),
    },
    today: {
      sessions: parseInt(today?.sessions || "0"),
      visitors: parseInt(today?.visitors || "0"),
    },
    devices,
    countries,
    sources,
    landingPages,
    recentSessions: recentSessions.map(s => ({
      ...s,
      pageviews: s.pageviews ? JSON.parse(s.pageviews) : [],
    })),
    dailySessions,
    seriesBucket,
    period,
  });
}
