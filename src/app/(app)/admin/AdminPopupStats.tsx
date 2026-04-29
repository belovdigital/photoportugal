"use client";

import { useEffect, useState } from "react";

interface TotalsRow {
  event_type: string;
  count_7d: number;
  count_30d: number;
  count_all: number;
}

interface DailyRow {
  day: string;
  event_type: string;
  count: number;
}

interface ByPageRow {
  page_path: string | null;
  count: number;
}

interface PopupStatsResponse {
  totals: TotalsRow[];
  daily: DailyRow[];
  byPage: ByPageRow[];
  funnel: {
    shown_30d: number;
    submitted_30d: number;
    dismissed_30d: number;
    browse_clicked_30d: number;
    submit_rate_pct: number;
    engagement_rate_pct: number;
  };
}

const EVENT_LABELS: Record<string, string> = {
  shown: "Shown",
  submitted: "Submitted",
  dismissed: "Dismissed",
  browse_clicked: "Browse clicked",
};

const EVENT_COLOURS: Record<string, string> = {
  shown: "bg-blue-500",
  submitted: "bg-emerald-500",
  dismissed: "bg-gray-400",
  browse_clicked: "bg-amber-500",
};

/**
 * Admin tab content showing exit-intent popup performance — totals per
 * event type, a 30-day daily breakdown, top source pages, and the
 * derived funnel (submit rate, total engagement). Reads from
 * `/api/admin/popup-stats`.
 */
export function AdminPopupStats() {
  const [data, setData] = useState<PopupStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/popup-stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: PopupStatsResponse) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error}</p>;
  if (!data) return null;

  const { totals, daily, byPage, funnel } = data;

  // Pivot daily rows → { day: { shown, submitted, dismissed, browse_clicked } }
  const dailyByDate = new Map<string, Record<string, number>>();
  daily.forEach((r) => {
    const slot = dailyByDate.get(r.day) ?? {};
    slot[r.event_type] = r.count;
    dailyByDate.set(r.day, slot);
  });
  const dailyRows = [...dailyByDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Exit-intent popup</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tracks how many visitors saw the AI Concierge popup and what they did with it.
          Last 30 days unless noted.
        </p>
      </div>

      {/* Funnel cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Shown" value={funnel.shown_30d} />
        <Card label="Submitted" value={funnel.submitted_30d} accent="emerald" />
        <Card label="Submit rate" value={`${funnel.submit_rate_pct}%`} accent="emerald" />
        <Card label="Engagement rate" value={`${funnel.engagement_rate_pct}%`} hint="submit + browse / shown" accent="amber" />
      </div>

      {/* Totals breakdown by event type */}
      <div className="rounded-xl border border-warm-200 bg-white">
        <div className="border-b border-warm-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Totals by event</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-warm-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-right">7 days</th>
              <th className="px-4 py-2 text-right">30 days</th>
              <th className="px-4 py-2 text-right">All time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {totals.map((r) => (
              <tr key={r.event_type}>
                <td className="px-4 py-2">
                  <span className={`inline-block h-2 w-2 rounded-full mr-2 ${EVENT_COLOURS[r.event_type] ?? "bg-gray-400"}`} />
                  {EVENT_LABELS[r.event_type] ?? r.event_type}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.count_7d}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.count_30d}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.count_all}</td>
              </tr>
            ))}
            {totals.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No data yet — once the popup fires you&apos;ll see counts here.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top pages */}
      <div className="rounded-xl border border-warm-200 bg-white">
        <div className="border-b border-warm-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Top pages where popup fires</h3>
          <p className="text-xs text-gray-500">Last 30 days · `shown` events</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-warm-100">
            {byPage.map((r, i) => (
              <tr key={`${r.page_path}-${i}`}>
                <td className="px-4 py-2 truncate max-w-[60%]">{r.page_path || "(unknown)"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
            {byPage.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-400">No popup shown in the last 30 days.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Daily series */}
      <div className="rounded-xl border border-warm-200 bg-white">
        <div className="border-b border-warm-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Daily breakdown — last 30 days</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-warm-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Day</th>
              <th className="px-4 py-2 text-right">Shown</th>
              <th className="px-4 py-2 text-right">Submitted</th>
              <th className="px-4 py-2 text-right">Dismissed</th>
              <th className="px-4 py-2 text-right">Browse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {dailyRows.map(([day, counts]) => (
              <tr key={day}>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{day}</td>
                <td className="px-4 py-2 text-right tabular-nums">{counts.shown ?? 0}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{counts.submitted ?? 0}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-500">{counts.dismissed ?? 0}</td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-700">{counts.browse_clicked ?? 0}</td>
              </tr>
            ))}
            {dailyRows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: "emerald" | "amber" }) {
  const colorClass = accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="rounded-xl border border-warm-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${colorClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
