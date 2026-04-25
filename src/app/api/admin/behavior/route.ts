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

function resolveWhere(period: string, from?: string | null, to?: string | null): string {
  switch (period) {
    case "today": return "started_at >= DATE_TRUNC('day', NOW())";
    case "yesterday": return "started_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day') AND started_at < DATE_TRUNC('day', NOW())";
    case "7d": return "started_at >= NOW() - INTERVAL '7 days'";
    case "year": return "started_at >= NOW() - INTERVAL '1 year'";
    case "custom":
      if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return `started_at >= '${from}'::date AND started_at < ('${to}'::date + INTERVAL '1 day')`;
      }
      // fall through
    case "30d":
    default:
      return "started_at >= NOW() - INTERVAL '30 days'";
  }
}

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "30d";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const where = resolveWhere(period, from, to);

  try {
    const [flows, landingPages, dropOff] = await Promise.all([
      // Top 3-page sequences. Aggregate first 3 paths of each session's pageview array, join with arrow.
      query<{ sequence: string; count: string }>(`
        SELECT array_to_string(
                 (ARRAY(SELECT p->>'path' FROM jsonb_array_elements(vs.pageviews) p))[1:3],
                 ' → '
               ) as sequence,
               COUNT(*)::text as count
        FROM visitor_sessions vs
        WHERE ${where}
          AND vs.pageviews IS NOT NULL
          AND jsonb_typeof(vs.pageviews) = 'array'
          AND jsonb_array_length(vs.pageviews) >= 2
          AND vs.user_agent NOT ILIKE '%bot%'
        GROUP BY sequence
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC
        LIMIT 12
      `),
      // Bounce rate per landing page
      query<{ page: string; sessions: string; bounced: string }>(`
        SELECT landing_page as page,
               COUNT(*)::text as sessions,
               COUNT(*) FILTER (WHERE pageview_count <= 1)::text as bounced
        FROM visitor_sessions
        WHERE ${where} AND landing_page IS NOT NULL
        GROUP BY landing_page
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `),
      // Drop-off: last page before leaving (among sessions with 2+ pageviews so bouncers don't dominate)
      query<{ from_page: string; count: string }>(`
        WITH last_pages AS (
          SELECT (
            SELECT p->>'path'
            FROM jsonb_array_elements(vs.pageviews) WITH ORDINALITY AS t(p, ord)
            ORDER BY ord DESC LIMIT 1
          ) AS from_page
          FROM visitor_sessions vs
          WHERE ${where}
            AND vs.pageviews IS NOT NULL
            AND jsonb_typeof(vs.pageviews) = 'array'
            AND jsonb_array_length(vs.pageviews) >= 2
            AND vs.pageview_count >= 2
            AND vs.user_agent NOT ILIKE '%bot%'
        )
        SELECT from_page, COUNT(*)::text as count
        FROM last_pages
        WHERE from_page IS NOT NULL
        GROUP BY from_page
        ORDER BY COUNT(*) DESC
        LIMIT 12
      `),
    ]);

    return NextResponse.json({
      flows: flows.map(f => ({ sequence: f.sequence, count: parseInt(f.count) })),
      landingPages: landingPages.map(p => {
        const sessions = parseInt(p.sessions);
        const bounced = parseInt(p.bounced);
        return {
          page: p.page,
          sessions,
          bounced,
          bounceRate: sessions > 0 ? Math.round((bounced / sessions) * 100) : 0,
        };
      }),
      dropOff: dropOff.map(d => ({ fromPage: d.from_page, toPage: "exit", count: parseInt(d.count) })),
    });
  } catch (err) {
    console.error("[admin/behavior] error:", err);
    return NextResponse.json({ error: "Query failed", detail: (err as Error).message }, { status: 500 });
  }
}
