import { query } from "@/lib/db";

/**
 * Admin "wasted demand" view — per-photographer funnel for the last 30
 * days from photographer_daily_stats, sorted by traffic. Rows with real
 * traffic but zero paid bookings are the outreach list (fix languages /
 * packages / response time — the Carla Lima & no-offer playbook).
 *
 * Server component; rendered into AdminDashboard's photographerStats tab.
 */

interface Row {
  slug: string;
  display_name: string;
  views: number;
  uniques: number;
  impressions: number;
  inquiries: number;
  paid: number;
  photo_opens: number;
  avg_response_minutes: number | null;
  packages_count: number;
  languages_count: number;
}

export async function AdminPhotographerStatsTab() {
  // NB: prod photographer_profiles has no display_name column (schema.sql
  // is aspirational there) — names come from users. .catch keeps a data
  // hiccup from 500-ing the whole admin page (matches page.tsx pattern).
  const rows = await query<Row>(
    `SELECT pp.slug, u.name AS display_name,
            COALESCE(SUM(s.profile_views), 0)::int AS views,
            COALESCE(SUM(s.unique_visitors), 0)::int AS uniques,
            COALESCE(SUM(s.card_impressions + s.concierge_impressions + COALESCE(s.gsc_impressions, 0)), 0)::int AS impressions,
            COALESCE(SUM(s.inquiries), 0)::int AS inquiries,
            COALESCE(SUM(s.paid_bookings), 0)::int AS paid,
            COALESCE(SUM(s.photo_opens), 0)::int AS photo_opens,
            pp.avg_response_minutes,
            (SELECT COUNT(*) FROM packages p WHERE p.photographer_id = pp.id AND p.is_public = TRUE AND p.revoked_at IS NULL)::int AS packages_count,
            COALESCE(array_length(pp.languages, 1), 0) AS languages_count
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     LEFT JOIN photographer_daily_stats s
       ON s.photographer_id = pp.id AND s.date >= (NOW() AT TIME ZONE 'Europe/Lisbon')::date - 30
     WHERE pp.is_approved = TRUE AND pp.is_test = FALSE
     GROUP BY pp.id, u.name
     ORDER BY 3 DESC`,
  ).catch(() => [] as Row[]);

  const wasted = rows.filter((r) => r.uniques >= 15 && r.paid === 0);

  function convPct(inq: number, uniq: number): string {
    if (uniq < 10) return "—";
    return `${((inq / uniq) * 100).toFixed(1)}%`;
  }

  function replyLabel(min: number | null): string {
    if (min === null) return "—";
    if (min < 60) return `${min}m`;
    return `${Math.round(min / 60)}h`;
  }

  function gapBadges(r: Row): string[] {
    const gaps: string[] = [];
    if (r.languages_count === 0) gaps.push("no languages");
    if (r.packages_count === 0) gaps.push("no packages");
    if ((r.avg_response_minutes ?? 0) > 24 * 60) gaps.push("slow replies");
    if (r.uniques >= 15 && r.inquiries === 0) gaps.push("0 inquiries");
    return gaps;
  }

  function renderTable(data: Row[], highlight: boolean) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 font-medium">Photographer</th>
              <th className="px-3 py-3 text-right font-medium">Shown</th>
              <th className="px-3 py-3 text-right font-medium">Views</th>
              <th className="px-3 py-3 text-right font-medium">Uniques</th>
              <th className="px-3 py-3 text-right font-medium">Inquiries</th>
              <th className="px-3 py-3 text-right font-medium">Conv</th>
              <th className="px-3 py-3 text-right font-medium">Paid</th>
              <th className="px-3 py-3 text-right font-medium">Reply</th>
              <th className="px-4 py-3 font-medium">Gaps</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const gaps = gapBadges(r);
              const isWasted = highlight && r.uniques >= 15 && r.paid === 0;
              return (
                <tr key={r.slug} className={`border-b border-gray-50 ${isWasted ? "bg-red-50/60" : ""}`}>
                  <td className="px-4 py-2.5">
                    <a href={`/photographers/${r.slug}`} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:text-red-600">
                      {r.display_name}
                    </a>
                    <span className="ml-2 text-xs text-gray-400">{r.slug}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{r.impressions.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{r.views.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{r.uniques.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{r.inquiries}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{convPct(r.inquiries, r.uniques)}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.paid > 0 ? "text-emerald-600" : "text-gray-400"}`}>{r.paid}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{replyLabel(r.avg_response_minutes)}</td>
                  <td className="px-4 py-2.5">
                    {gaps.map((g) => (
                      <span key={g} className="mr-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        {g}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Wasted demand (last 30 days)</h2>
        <p className="mb-4 mt-1 text-sm text-gray-500">
          Photographers with ≥15 unique profile visitors and zero paid bookings — the outreach list. Fix what the Gaps column says first.
        </p>
        {wasted.length > 0 ? renderTable(wasted, true) : <p className="text-sm text-gray-400">Nobody is wasting demand right now 🎉</p>}
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">All photographers</h2>
        <p className="mb-4 mt-1 text-sm text-gray-500">Same funnel for everyone, sorted by profile views.</p>
        {renderTable(rows, false)}
      </div>
    </div>
  );
}
