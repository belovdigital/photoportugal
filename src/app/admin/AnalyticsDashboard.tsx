"use client";

import { useState, useEffect } from "react";

interface AnalyticsData {
  ga4?: {
    users: number;
    usersPrev: number;
    sessions: number;
    sessionsPrev: number;
    pageviews: number;
    pageviewsPrev: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  gsc?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topPages?: { path: string; views: number; users: number }[];
  topQueries?: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topSearchPages?: { page: string; clicks: number; impressions: number; position: number }[];
  trafficSources?: { channel: string; sessions: number; users: number }[];
  topCountries?: { country: string; users: number }[];
  funnel?: Record<string, number>;
  insights?: string[];
  ga4Error?: string;
  gscError?: string;
}

function Change({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const color = pct > 0 ? "text-green-600" : pct < 0 ? "text-red-600" : "text-gray-400";
  return <span className={`text-xs font-medium ${color}`}>{pct > 0 ? "+" : ""}{pct}%</span>;
}

const FUNNEL_STEPS = [
  { key: "page_view", label: "Visited Site" },
  { key: "view_item", label: "Viewed Photographer" },
  { key: "add_to_cart", label: "Started Booking" },
  { key: "begin_checkout", label: "Submitted Request" },
  { key: "purchase", label: "Paid" },
  { key: "delivery_accepted", label: "Accepted Photos" },
  { key: "review_submitted", label: "Left Review" },
];

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Loading analytics...</p>;
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>;
  if (!data) return null;

  const ga4 = data.ga4;
  const gsc = data.gsc;

  return (
    <div className="space-y-8">
      {/* Smart Insights */}
      {data.insights && data.insights.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-amber-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            Smart Insights
          </h3>
          <ul className="mt-3 space-y-1.5">
            {data.insights.map((insight, i) => (
              <li key={i} className="text-sm text-amber-700">• {insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {data.ga4Error && <p className="text-xs text-red-500">{data.ga4Error}</p>}
      {data.gscError && <p className="text-xs text-red-500">{data.gscError}</p>}

      {/* GA4 Overview */}
      {ga4 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Website Traffic (30 days)</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Users", value: ga4.users, prev: ga4.usersPrev },
              { label: "Sessions", value: ga4.sessions, prev: ga4.sessionsPrev },
              { label: "Pageviews", value: ga4.pageviews, prev: ga4.pageviewsPrev },
              { label: "Avg Duration", value: `${Math.floor(ga4.avgSessionDuration / 60)}m ${ga4.avgSessionDuration % 60}s`, prev: 0 },
              { label: "Bounce Rate", value: `${ga4.bounceRate}%`, prev: 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
                {typeof s.prev === "number" && s.prev > 0 && (
                  <Change current={typeof s.value === "number" ? s.value : 0} previous={s.prev} />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* GSC Overview */}
      {gsc && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Google Search (30 days)</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Clicks", value: gsc.clicks },
              { label: "Impressions", value: gsc.impressions.toLocaleString() },
              { label: "CTR", value: `${gsc.ctr}%` },
              { label: "Avg Position", value: gsc.position },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Client Funnel */}
      {data.funnel && Object.keys(data.funnel).length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Client Funnel (30 days)</h3>
          <div className="space-y-2">
            {FUNNEL_STEPS.map((step, i) => {
              const count = data.funnel![step.key] || 0;
              const prevCount = i > 0 ? (data.funnel![FUNNEL_STEPS[i - 1].key] || 0) : count;
              const rate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
              const maxCount = data.funnel![FUNNEL_STEPS[0].key] || 1;
              const barWidth = Math.max((count / maxCount) * 100, 2);

              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div className="w-36 text-right text-xs font-medium text-gray-500">{step.label}</div>
                  <div className="flex-1">
                    <div className="h-7 overflow-hidden rounded-full bg-warm-100">
                      <div
                        className="flex h-full items-center rounded-full bg-primary-500 px-3 text-xs font-bold text-white transition-all"
                        style={{ width: `${barWidth}%` }}
                      >
                        {count > 0 ? count : ""}
                      </div>
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs text-gray-400">
                    {i > 0 && rate > 0 ? `${rate}%` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Traffic Sources */}
      {data.trafficSources && data.trafficSources.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Traffic Sources</h3>
            <div className="mt-3 space-y-2">
              {data.trafficSources.map((s) => (
                <div key={s.channel} className="flex items-center justify-between rounded-lg bg-white border border-warm-200 px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-700">{s.channel}</span>
                  <span className="text-sm text-gray-500">{s.sessions} sessions</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Countries */}
          {data.topCountries && data.topCountries.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top Countries</h3>
              <div className="mt-3 space-y-2">
                {data.topCountries.map((c) => (
                  <div key={c.country} className="flex items-center justify-between rounded-lg bg-white border border-warm-200 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-700">{c.country}</span>
                    <span className="text-sm text-gray-500">{c.users} users</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Search Queries */}
      {data.topQueries && data.topQueries.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Top Search Queries (GSC)</h3>
          <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-warm-200 bg-warm-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Query</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">CTR</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {data.topQueries.map((q) => (
                  <tr key={q.query}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{q.query}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{q.clicks}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{q.impressions}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{q.ctr}%</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{q.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Top Pages */}
      {data.topPages && data.topPages.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Top Pages (GA4)</h3>
          <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-warm-200 bg-warm-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Page</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Views</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {data.topPages.map((p) => (
                  <tr key={p.path}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 max-w-xs truncate">{p.path}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{p.views}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{p.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
