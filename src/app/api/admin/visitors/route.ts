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

  // Recent sessions (last 20)
  const recentSessions = await query<{
    id: string; visitor_id: string; user_name: string | null; user_email: string | null;
    device_type: string | null; country: string | null; language: string | null;
    landing_page: string | null; referrer: string | null; utm_source: string | null;
    utm_medium: string | null; utm_term: string | null;
    pageview_count: number; started_at: string; pageviews: string | null;
  }>(`
    SELECT vs.id, vs.visitor_id,
           u.name as user_name, u.email as user_email,
           vs.device_type, vs.country, vs.language,
           vs.landing_page, vs.referrer, vs.utm_source, vs.utm_medium, vs.utm_term,
           vs.pageview_count, vs.started_at,
           vs.pageviews::text
    FROM visitor_sessions vs
    LEFT JOIN users u ON u.id = vs.user_id
    ORDER BY vs.started_at DESC LIMIT ${sessionLimit}
  `);

  // Sessions by day (last 14 days)
  const dailySessions = await query<{ day: string; sessions: string; visitors: string }>(`
    SELECT started_at::date::text as day,
           COUNT(*)::text as sessions,
           COUNT(DISTINCT visitor_id)::text as visitors
    FROM visitor_sessions
    WHERE started_at >= NOW() - INTERVAL '14 days'
    GROUP BY started_at::date ORDER BY day DESC
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
  });
}
