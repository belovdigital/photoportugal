import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? !!verifyToken(token) : false;
}

/**
 * Aggregated stats for the exit-intent popup. Returns:
 *   - totals — last 7 / 30 days counts per event type
 *   - daily — series for the last 30 days (one row per day per type)
 *   - byPage — top page paths where popup gets shown
 *   - funnel — conversion (submitted / shown) over the last 30 days
 *
 * Admin UI hits this once and renders cards + a small bar chart.
 */
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const totals = await query<{ event_type: string; count_7d: number; count_30d: number; count_all: number }>(
    `SELECT event_type,
            COUNT(*) FILTER (WHERE occurred_at >= now() - interval '7 days')::int as count_7d,
            COUNT(*) FILTER (WHERE occurred_at >= now() - interval '30 days')::int as count_30d,
            COUNT(*)::int as count_all
     FROM popup_events
     GROUP BY event_type
     ORDER BY event_type`
  );

  const daily = await query<{ day: string; event_type: string; count: number }>(
    `SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
            event_type,
            COUNT(*)::int as count
     FROM popup_events
     WHERE occurred_at >= now() - interval '30 days'
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 ASC`
  );

  const byPage = await query<{ page_path: string | null; count: number }>(
    `SELECT page_path, COUNT(*)::int as count
     FROM popup_events
     WHERE event_type = 'shown'
       AND occurred_at >= now() - interval '30 days'
     GROUP BY page_path
     ORDER BY count DESC
     LIMIT 15`
  );

  // Funnel: submitted / shown ratio over last 30 days. Same visitor_id may
  // submit without being recorded as shown if they reload — fine for a
  // rough conversion signal.
  const shown30 = totals.find((r) => r.event_type === "shown")?.count_30d ?? 0;
  const submitted30 = totals.find((r) => r.event_type === "submitted")?.count_30d ?? 0;
  const dismissed30 = totals.find((r) => r.event_type === "dismissed")?.count_30d ?? 0;
  const browseClicked30 = totals.find((r) => r.event_type === "browse_clicked")?.count_30d ?? 0;

  return NextResponse.json({
    totals,
    daily,
    byPage,
    funnel: {
      shown_30d: shown30,
      submitted_30d: submitted30,
      dismissed_30d: dismissed30,
      browse_clicked_30d: browseClicked30,
      submit_rate_pct: shown30 > 0 ? Math.round((submitted30 / shown30) * 1000) / 10 : 0,
      engagement_rate_pct: shown30 > 0 ? Math.round(((submitted30 + browseClicked30) / shown30) * 1000) / 10 : 0,
    },
  });
}
