"use client";

import { useState, useEffect, useCallback } from "react";

type SortDir = "asc" | "desc";
function useSortable<T>(initial: keyof T, initialDir: SortDir = "asc") {
  const [sort, setSort] = useState<{ key: keyof T; dir: SortDir }>({ key: initial, dir: initialDir });
  const toggle = useCallback((key: keyof T) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }, []);
  const sorted = useCallback(<R extends T>(arr: R[]) => [...arr].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    const cmp = typeof av === "string" ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
    return sort.dir === "asc" ? cmp : -cmp;
  }), [sort]);
  return { sort, toggle, sorted };
}

function SortTh({ label, col, sort, toggle, right }: { label: string; col: string; sort: { key: string; dir: SortDir }; toggle: (k: string) => void; right?: boolean }) {
  const active = sort.key === col;
  return (
    <th
      onClick={() => toggle(col)}
      className={`px-4 py-3 font-medium text-gray-500 bg-warm-50 cursor-pointer select-none hover:text-gray-800 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {label}
      <span className="ml-1 inline-block w-3 text-center">
        {active ? (sort.dir === "asc" ? "↑" : "↓") : <span className="text-gray-300">↕</span>}
      </span>
    </th>
  );
}

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
  positionDistribution?: {
    top3: { count: number; prev?: number; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    top10: { count: number; prev?: number; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    top20: { count: number; prev?: number; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    top100: { count: number; prev?: number; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    total: number;
    prevTotal?: number;
  };
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

function PositionDistribution({ dist }: { dist: NonNullable<AnalyticsData["positionDistribution"]> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { sort, toggle, sorted } = useSortable<{ query: string; clicks: number; impressions: number; position: number }>("position");

  const buckets = [
    { key: "top3", label: "TOP 3", count: dist.top3.count, prev: dist.top3.prev, queries: dist.top3.queries, color: "bg-green-500", textColor: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-200", icon: "🏆" },
    { key: "top10", label: "TOP 10", count: dist.top10.count, prev: dist.top10.prev, queries: dist.top10.queries, color: "bg-blue-500", textColor: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200", icon: "🎯" },
    { key: "top20", label: "TOP 20", count: dist.top20.count, prev: dist.top20.prev, queries: dist.top20.queries, color: "bg-yellow-500", textColor: "text-yellow-700", bgColor: "bg-yellow-50", borderColor: "border-yellow-200", icon: "📈" },
    { key: "top100", label: "TOP 100", count: dist.top100.count, prev: dist.top100.prev, queries: dist.top100.queries, color: "bg-gray-400", textColor: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200", icon: "📊" },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900">Keyword Rankings</h3>
      <p className="text-xs text-gray-400 mt-0.5">{dist.total} total keywords tracked</p>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {buckets.map((b) => (
          <button
            key={b.key}
            onClick={() => setExpanded(expanded === b.key ? null : b.key)}
            className={`rounded-xl border p-4 text-center transition hover:shadow-md ${expanded === b.key ? `${b.borderColor} ${b.bgColor} ring-1 ${b.borderColor}` : "border-warm-200 bg-white"}`}
          >
            <span className="text-lg">{b.icon}</span>
            <p className="mt-1 text-2xl font-bold text-gray-900">{b.count}</p>
            <p className="text-xs font-semibold text-gray-500">{b.label}</p>
            {b.prev !== undefined && b.prev !== null && (
              <p className={`mt-0.5 text-[10px] font-medium ${b.count > b.prev ? "text-green-500" : b.count < b.prev ? "text-red-500" : "text-gray-400"}`}>
                {b.count > b.prev ? `+${b.count - b.prev}` : b.count < b.prev ? `${b.count - b.prev}` : "="} vs prev
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Visual bar */}
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-warm-100">
        {buckets.map((b) => {
          const width = dist.total > 0 ? (b.count / dist.total) * 100 : 0;
          return width > 0 ? (
            <div key={b.key} className={`${b.color} transition-all`} style={{ width: `${width}%` }} title={`${b.label}: ${b.count}`} />
          ) : null;
        })}
      </div>

      {/* Expanded query list */}
      {expanded && (
        <div className="mt-4 rounded-xl border border-warm-200 bg-white overflow-auto max-h-[500px]">
          <table className="w-full min-w-[400px] text-xs sm:text-sm">
            <thead className="border-b border-warm-200 bg-warm-50 sticky top-0 z-10">
              <tr>
                <SortTh label="Query" col="query" sort={sort as { key: string; dir: SortDir }} toggle={toggle as (k: string) => void} />
                <SortTh label="Pos." col="position" sort={sort as { key: string; dir: SortDir }} toggle={toggle as (k: string) => void} right />
                <SortTh label="Clicks" col="clicks" sort={sort as { key: string; dir: SortDir }} toggle={toggle as (k: string) => void} right />
                <SortTh label="Impr." col="impressions" sort={sort as { key: string; dir: SortDir }} toggle={toggle as (k: string) => void} right />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {sorted(buckets.find((b) => b.key === expanded)?.queries ?? []).map((q) => (
                <tr key={q.query}>
                  <td className="px-2 sm:px-4 py-2 font-medium text-gray-900">{q.query}</td>
                  <td className="px-2 sm:px-4 py-2 text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                      q.position <= 3 ? "bg-green-100 text-green-700" :
                      q.position <= 10 ? "bg-blue-100 text-blue-700" :
                      q.position <= 20 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {q.position}
                    </span>
                    {(q as { positionChange?: number | null }).positionChange != null && (q as { positionChange?: number | null }).positionChange !== 0 && (
                      <span className={`ml-1 text-[10px] font-medium ${(q as { positionChange: number }).positionChange > 0 ? "text-green-500" : "text-red-500"}`}>
                        {(q as { positionChange: number }).positionChange > 0 ? `↑${(q as { positionChange: number }).positionChange}` : `↓${Math.abs((q as { positionChange: number }).positionChange)}`}
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right text-gray-500">{q.clicks}</td>
                  <td className="px-2 sm:px-4 py-2 text-right text-gray-500">{q.impressions}</td>
                </tr>
              ))}
              {(buckets.find((b) => b.key === expanded)?.queries.length || 0) === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No queries in this range yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ANALYTICS_TABS = [
  { key: "visitors", label: "Visitors", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "traffic", label: "Traffic", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "seo", label: "SEO", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: "ads", label: "Ads", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "funnel", label: "Funnel", icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" },
] as const;

interface VisitorData {
  summary: { sessions: number; sessionsPrev: number; visitors: number; visitorsPrev: number; linked: number; avgPages: number; avgDuration: number };
  today: { sessions: number; visitors: number };
  devices: { device_type: string; count: string }[];
  countries: { country: string; count: string }[];
  sources: { source: string; count: string }[];
  landingPages: { page: string; count: string }[];
  recentSessions: {
    id: string; visitor_id: string; user_name: string | null; user_email: string | null;
    user_role: string | null;
    device_type: string | null; country: string | null; language: string | null;
    landing_page: string | null; referrer: string | null; utm_source: string | null;
    utm_medium: string | null; utm_term: string | null;
    pageview_count: number; started_at: string; pageviews: { path: string; ts: string; duration_ms?: number }[];
  }[];
  dailySessions: { day: string; sessions: string; visitors: string }[];
}

const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  PT: { flag: "🇵🇹", name: "Portugal" }, US: { flag: "🇺🇸", name: "United States" }, GB: { flag: "🇬🇧", name: "United Kingdom" },
  DE: { flag: "🇩🇪", name: "Germany" }, FR: { flag: "🇫🇷", name: "France" }, ES: { flag: "🇪🇸", name: "Spain" },
  IT: { flag: "🇮🇹", name: "Italy" }, BR: { flag: "🇧🇷", name: "Brazil" }, CA: { flag: "🇨🇦", name: "Canada" },
  AU: { flag: "🇦🇺", name: "Australia" }, NL: { flag: "🇳🇱", name: "Netherlands" }, BE: { flag: "🇧🇪", name: "Belgium" },
  CH: { flag: "🇨🇭", name: "Switzerland" }, AT: { flag: "🇦🇹", name: "Austria" }, IE: { flag: "🇮🇪", name: "Ireland" },
  SE: { flag: "🇸🇪", name: "Sweden" }, NO: { flag: "🇳🇴", name: "Norway" }, DK: { flag: "🇩🇰", name: "Denmark" },
  FI: { flag: "🇫🇮", name: "Finland" }, PL: { flag: "🇵🇱", name: "Poland" }, RU: { flag: "🇷🇺", name: "Russia" },
  UA: { flag: "🇺🇦", name: "Ukraine" }, CZ: { flag: "🇨🇿", name: "Czechia" }, GR: { flag: "🇬🇷", name: "Greece" },
  RO: { flag: "🇷🇴", name: "Romania" }, HU: { flag: "🇭🇺", name: "Hungary" }, TR: { flag: "🇹🇷", name: "Turkey" },
  IN: { flag: "🇮🇳", name: "India" }, CN: { flag: "🇨🇳", name: "China" }, JP: { flag: "🇯🇵", name: "Japan" },
  KR: { flag: "🇰🇷", name: "South Korea" }, ZA: { flag: "🇿🇦", name: "South Africa" }, MX: { flag: "🇲🇽", name: "Mexico" },
  AR: { flag: "🇦🇷", name: "Argentina" }, CO: { flag: "🇨🇴", name: "Colombia" }, CL: { flag: "🇨🇱", name: "Chile" },
  IL: { flag: "🇮🇱", name: "Israel" }, AE: { flag: "🇦🇪", name: "UAE" }, SG: { flag: "🇸🇬", name: "Singapore" },
};
const getCountry = (code: string) => COUNTRY_INFO[code] || { flag: "🏳️", name: code };

function VisitorsTab() {
  const [vd, setVd] = useState<VisitorData | null>(null);
  const [vLoading, setVLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionLimit, setSessionLimit] = useState(30);
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    setVLoading(true);
    fetch(`/api/admin/visitors?limit=${sessionLimit}&role=${roleFilter}`)
      .then(r => r.json())
      .then(d => { setVd(d); setVLoading(false); })
      .catch(() => setVLoading(false));
  }, [sessionLimit, roleFilter]);

  if (vLoading) return <p className="text-sm text-gray-400">Loading visitor data...</p>;
  if (!vd) return <p className="text-sm text-gray-400">No visitor data yet</p>;

  const { summary: s, today: t } = vd;
  const maxDaily = Math.max(...vd.dailySessions.map(d => parseInt(d.sessions)), 1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Sessions (30d)", value: s.sessions, prev: s.sessionsPrev },
          { label: "Unique Visitors", value: s.visitors, prev: s.visitorsPrev },
          { label: "Today", value: t.sessions, sub: `${t.visitors} unique` },
          { label: "Avg Pages", value: s.avgPages },
          { label: "Avg Duration", value: `${s.avgDuration}m` },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-warm-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
            {"prev" in c && typeof c.prev === "number" && c.prev > 0 && (
              <Change current={typeof c.value === "number" ? c.value : 0} previous={c.prev} />
            )}
            {"sub" in c && <p className="text-[10px] text-gray-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {vd.dailySessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Sessions (last 14 days)</h3>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {[...vd.dailySessions].reverse().map(d => {
              const count = parseInt(d.sessions);
              const barH = maxDaily > 0 ? Math.max((count / maxDaily) * 120, count > 0 ? 6 : 0) : 0;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end" title={`${d.day}: ${d.sessions} sessions, ${d.visitors} visitors`}>
                  {count > 0 && <span className="text-[10px] font-medium text-gray-500 mb-1">{count}</span>}
                  <div className="w-full rounded-t bg-primary-500" style={{ height: barH }} />
                  <span className="text-[9px] text-gray-400 mt-1">{d.day.slice(8)}.{d.day.slice(5, 7)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Devices + Countries + Sources */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Devices */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Devices</h3>
          <div className="space-y-1.5">
            {vd.devices.map(d => (
              <div key={d.device_type} className="flex items-center justify-between rounded-lg bg-white border border-warm-200 px-3 py-2">
                <span className="text-sm text-gray-700">
                  {d.device_type === "mobile" ? "Mobile" : d.device_type === "desktop" ? "Desktop" : d.device_type === "tablet" ? "Tablet" : d.device_type}
                </span>
                <span className="text-sm font-semibold text-gray-900">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Countries</h3>
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {vd.countries.map(c => (
              <div key={c.country} className="flex items-center justify-between rounded-lg bg-white border border-warm-200 px-3 py-2">
                <span className="text-sm text-gray-700">{getCountry(c.country).flag} {getCountry(c.country).name}</span>
                <span className="text-sm font-semibold text-gray-900">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sources */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Traffic Sources</h3>
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {vd.sources.map(s => (
              <div key={s.source} className="flex items-center justify-between rounded-lg bg-white border border-warm-200 px-3 py-2">
                <span className="text-sm text-gray-700 truncate">{s.source}</span>
                <span className="text-sm font-semibold text-gray-900 ml-2">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Landing Pages */}
      {vd.landingPages.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Landing Pages</h3>
          <div className="rounded-xl border border-warm-200 bg-white overflow-auto max-h-64">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-warm-50 border-b border-warm-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Page</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {vd.landingPages.map(p => (
                  <tr key={p.page}>
                    <td className="px-3 py-2 text-gray-900 truncate max-w-xs">{p.page}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Recent Visitors</h3>
          <div className="flex gap-1">
            {[
              { key: "all", label: "All", icon: "👥" },
              { key: "client", label: "Clients", icon: "🧳" },
              { key: "photographer", label: "Photographers", icon: "📸" },
              { key: "guest", label: "Guests", icon: "👻" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setRoleFilter(f.key); setSessionLimit(30); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  roleFilter === f.key
                    ? "bg-primary-500 text-white"
                    : "bg-warm-100 text-gray-500 hover:bg-warm-200"
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {vd.recentSessions.map(session => {
            const isExpanded = expandedSession === session.id;
            const time = new Date(session.started_at);
            const ago = Math.round((Date.now() - time.getTime()) / 60000);
            const agoStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
            const totalMs = session.pageviews.reduce((sum: number, pv: { duration_ms?: number }) => sum + (pv.duration_ms || 0), 0);
            const totalDur = totalMs > 0 ? (totalMs >= 60000 ? `${Math.round(totalMs / 60000)}m ${Math.round((totalMs % 60000) / 1000)}s` : `${Math.round(totalMs / 1000)}s`) : null;

            const PAGE_ICONS: Record<string, string> = {
              "/": "🏠", "/photographers": "📸", "/dashboard": "📊", "/dashboard/bookings": "📅",
              "/dashboard/messages": "💬", "/dashboard/profile": "👤", "/dashboard/portfolio": "🖼️",
              "/dashboard/packages": "📦", "/dashboard/settings": "⚙️",
            };
            const getIcon = (path: string) => {
              if (PAGE_ICONS[path]) return PAGE_ICONS[path];
              if (path.startsWith("/photographers/")) return "📷";
              if (path.startsWith("/book/")) return "🛒";
              if (path.startsWith("/locations/")) return "📍";
              if (path.startsWith("/blog")) return "📝";
              if (path.startsWith("/delivery/")) return "🎁";
              return "📄";
            };
            const shortPath = (path: string) => {
              if (path === "/") return "Home";
              return path.replace(/^\//, "").replace(/\//g, " / ");
            };

            return (
              <button
                key={session.id}
                onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                className={`w-full text-left rounded-xl border bg-white p-3 hover:shadow-sm transition ${isExpanded ? "border-primary-300 shadow-sm" : "border-warm-200"}`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-warm-100 text-xs shrink-0">
                      {session.device_type === "mobile" ? "📱" : session.device_type === "tablet" ? "📱" : "💻"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {session.user_name ? (
                          <span className="text-sm font-semibold text-primary-600 truncate">{session.user_name}</span>
                        ) : (
                          <span className="text-sm text-gray-500 truncate font-mono">{session.visitor_id.slice(0, 8)}</span>
                        )}
                        {session.user_role && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            session.user_role === "photographer" ? "bg-purple-50 text-purple-600" : "bg-emerald-50 text-emerald-600"
                          }`}>{session.user_role === "photographer" ? "📸" : "🧳"}</span>
                        )}
                        {session.user_email && <span className="text-[10px] text-gray-400 hidden sm:inline">{session.user_email}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium">{session.country ? `${getCountry(session.country).flag} ${getCountry(session.country).name}` : "🏳️ Unknown"}</span>
                        {session.utm_source && (
                          <span className="rounded-full bg-blue-50 text-blue-600 px-1.5 py-0.5 text-[9px] font-medium">via {session.utm_source}</span>
                        )}
                        {session.referrer && !session.utm_source && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">from {session.referrer.replace(/^https?:\/\//, "").split("/")[0]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs text-gray-500 font-medium">{session.pageview_count} pages</span>
                    <div className="flex items-center gap-1.5">
                      {totalDur && <span className="text-[10px] text-gray-400">{totalDur}</span>}
                      <span className="text-[10px] text-gray-400">{agoStr}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded: Visual user flow */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-warm-100" onClick={e => e.stopPropagation()}>
                    {/* Meta info */}
                    {(session.utm_term || session.language) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {session.utm_term && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">🔍 {session.utm_term}</span>
                        )}
                        {session.language && (
                          <span className="text-[10px] bg-gray-50 text-gray-500 rounded-full px-2 py-0.5">🌐 {session.language}</span>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="relative">
                      {session.pageviews.map((pv: { path: string; ts: string; duration_ms?: number }, i: number) => {
                        const isLast = i === session.pageviews.length - 1;
                        const durSec = pv.duration_ms ? Math.round(pv.duration_ms / 1000) : 0;
                        const pvTime = new Date(pv.ts);
                        const timeStr = pvTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                        return (
                          <div key={i} className="flex gap-3">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center w-5 shrink-0">
                              <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${i === 0 ? "bg-primary-500 border-primary-500" : isLast ? "bg-gray-400 border-gray-400" : "bg-white border-gray-300"}`} />
                              {!isLast && <div className="w-0.5 flex-1 bg-gray-200 min-h-[24px]" />}
                            </div>

                            {/* Page info */}
                            <div className={`flex-1 ${!isLast ? "pb-2" : ""}`}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{getIcon(pv.path)}</span>
                                <span className="text-xs font-medium text-gray-900">{shortPath(pv.path)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">{timeStr}</span>
                                {durSec > 0 && (
                                  <span className={`text-[10px] font-medium ${durSec >= 30 ? "text-green-600" : durSec >= 10 ? "text-amber-600" : "text-gray-400"}`}>
                                    {durSec >= 60 ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : `${durSec}s`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Session summary bar */}
                    {session.pageviews.length > 1 && (
                      <div className="mt-3 pt-2 border-t border-warm-50 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                          {new Date(session.started_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400">{session.pageview_count} pages</span>
                          {totalDur && <span className="text-[10px] font-medium text-gray-500">⏱ {totalDur}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
          {vd.recentSessions.length >= sessionLimit && (
            <button
              onClick={() => setSessionLimit(prev => prev + 30)}
              className="w-full py-2.5 text-sm font-medium text-primary-600 hover:text-primary-700 bg-warm-50 rounded-xl border border-warm-200 hover:bg-warm-100 transition"
            >
              Load more sessions
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("visitors");
  const queriesSort = useSortable<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>("clicks", "desc");
  const pagesSort = useSortable<{ path: string; views: number; users: number }>("views", "desc");

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
    <div className="space-y-5 sm:space-y-8">
      {/* Sub-tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-xl bg-warm-100 p-1 min-w-full sm:min-w-0">
          {ANALYTICS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap sm:px-4 sm:text-sm ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* === VISITORS TAB === */}
      {activeTab === "visitors" && <VisitorsTab />}

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

      {/* === TRAFFIC TAB === */}
      {activeTab === "traffic" && ga4 && (
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
              <div key={s.label} className="rounded-xl border border-warm-200 bg-white p-2.5 sm:p-4 text-center">
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

      {/* Traffic Sources (in Traffic tab) */}
      {activeTab === "traffic" && data.trafficSources && data.trafficSources.length > 0 && (
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

      {/* Top Pages (in Traffic tab) */}
      {activeTab === "traffic" && data.topPages && data.topPages.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Top Pages (GA4)</h3>
          <div className="overflow-auto max-h-[500px] rounded-xl border border-warm-200 bg-white">
            <table className="w-full text-xs sm:text-sm">
              <thead className="border-b border-warm-200 bg-warm-50 sticky top-0 z-10">
                <tr>
                  <SortTh label="Page" col="path" sort={pagesSort.sort as { key: string; dir: SortDir }} toggle={pagesSort.toggle as (k: string) => void} />
                  <SortTh label="Views" col="views" sort={pagesSort.sort as { key: string; dir: SortDir }} toggle={pagesSort.toggle as (k: string) => void} right />
                  <SortTh label="Users" col="users" sort={pagesSort.sort as { key: string; dir: SortDir }} toggle={pagesSort.toggle as (k: string) => void} right />
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {pagesSort.sorted(data.topPages).map((p) => (
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

      {/* === SEO TAB === */}
      {/* GSC Overview */}
      {activeTab === "seo" && gsc && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Google Search (30 days)</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Clicks", value: gsc.clicks },
              { label: "Impressions", value: gsc.impressions.toLocaleString() },
              { label: "CTR", value: `${gsc.ctr}%` },
              { label: "Avg Position", value: gsc.position },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-warm-200 bg-white p-2.5 sm:p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Position Distribution */}
      {activeTab === "seo" && data.positionDistribution && data.positionDistribution.total > 0 && (
        <PositionDistribution dist={data.positionDistribution} />
      )}

      {/* Top Search Queries (in SEO tab) */}
      {activeTab === "seo" && data.topQueries && data.topQueries.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Top Search Queries (GSC)</h3>
          <div className="overflow-auto max-h-[500px] rounded-xl border border-warm-200 bg-white">
            <table className="w-full text-xs sm:text-sm">
              <thead className="border-b border-warm-200 bg-warm-50 sticky top-0 z-10">
                <tr>
                  <SortTh label="Query" col="query" sort={queriesSort.sort as { key: string; dir: SortDir }} toggle={queriesSort.toggle as (k: string) => void} />
                  <SortTh label="Clicks" col="clicks" sort={queriesSort.sort as { key: string; dir: SortDir }} toggle={queriesSort.toggle as (k: string) => void} right />
                  <SortTh label="Impressions" col="impressions" sort={queriesSort.sort as { key: string; dir: SortDir }} toggle={queriesSort.toggle as (k: string) => void} right />
                  <SortTh label="CTR" col="ctr" sort={queriesSort.sort as { key: string; dir: SortDir }} toggle={queriesSort.toggle as (k: string) => void} right />
                  <SortTh label="Position" col="position" sort={queriesSort.sort as { key: string; dir: SortDir }} toggle={queriesSort.toggle as (k: string) => void} right />
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {queriesSort.sorted(data.topQueries).map((q) => (
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

      {/* === FUNNEL TAB === */}
      {/* Client Funnel */}
      {activeTab === "funnel" && data.funnel && Object.keys(data.funnel).length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900">Client Funnel (30 days)</h3>
          <div className="space-y-1">
            {FUNNEL_STEPS.map((step, i) => {
              const count = data.funnel![step.key] || 0;
              const prevCount = i > 0 ? (data.funnel![FUNNEL_STEPS[i - 1].key] || 0) : count;
              const firstCount = data.funnel![FUNNEL_STEPS[0].key] || 1;
              const stepRate = i === 0 ? 100 : prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
              const totalRate = i > 0 ? Math.round((count / firstCount) * 100) : 100;
              const barWidth = Math.max((count / firstCount) * 100, count > 0 ? 3 : 1);

              // Color based on funnel position
              const barColor = i === 0 ? "bg-primary-500" :
                stepRate >= 30 ? "bg-green-500" :
                stepRate >= 10 ? "bg-amber-500" :
                count > 0 ? "bg-red-400" : "bg-gray-300";

              return (
                <div key={step.key}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-20 sm:w-32 shrink-0 text-right">
                      <span className="text-[10px] sm:text-xs font-medium text-gray-600">{step.label}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-8 overflow-hidden rounded-lg bg-warm-100">
                        <div
                          className={`flex h-full items-center rounded-lg px-3 text-xs font-bold text-white transition-all ${barColor}`}
                          style={{ width: `${barWidth}%`, minWidth: count > 0 ? 40 : 20 }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                    <div className="w-16 sm:w-20 shrink-0 text-right">
                      {i > 0 ? (
                        <div>
                          <span className={`text-xs font-semibold ${stepRate >= 30 ? "text-green-600" : stepRate >= 10 ? "text-amber-600" : "text-red-500"}`}>
                            {stepRate}%
                          </span>
                          <p className="text-[9px] text-gray-400">{totalRate}% total</p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">100%</span>
                      )}
                    </div>
                  </div>
                  {/* Drop-off arrow between steps */}
                  {i < FUNNEL_STEPS.length - 1 && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-20 sm:w-32" />
                      <div className="flex-1 flex justify-center">
                        <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7" /></svg>
                      </div>
                      <div className="w-16 sm:w-20" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* === ADS TAB === */}
      {activeTab === "ads" && <GoogleAdsSection />}
    </div>
  );
}

function GoogleAdsSection() {
  const [stats, setStats] = useState<{
    visits: number;
    visitsToday: number;
    visits7d: number;
    signups: number;
    bookingsFromAds: number;
    paidBookings: number;
    revenueFromAds: number;
    visitToBookingRate: string;
    bookingToPayRate: string;
    topKeywords: { keyword: string; visits: number; bookings: number; revenue: number }[];
    topLandingPages: { page: string; visits: number }[];
    dailyVisits: { date: string; visits: number }[];
    recentVisitors: { keyword: string; campaign: string; landing: string; time: string; pages: string[]; converted: boolean }[];
    topAdPages: { page: string; views: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ads-stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
        Google Ads
      </h3>

      {loading ? (
        <p className="text-sm text-gray-400">Loading ads data...</p>
      ) : !stats || stats.visits === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-white p-5">
          <p className="text-sm text-gray-500">Google Ads tracking active. Waiting for first ad clicks...</p>
          <div className="mt-3 rounded-lg bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Tracking:</p>
            <ul className="text-xs text-blue-600 space-y-0.5">
              <li>• Ad clicks + page journeys (UTM)</li>
              <li>• booking_submitted, payment_completed, client_signup (gtag with value)</li>
              <li>• AW-18043729532</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Funnel */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
            {[
              { label: "Ad Clicks", value: stats.visits, sub: `${stats.visitsToday} today` },
              { label: "Signups", value: stats.signups, sub: stats.visits > 0 ? `${((stats.signups / stats.visits) * 100).toFixed(0)}% rate` : "" },
              { label: "Bookings", value: stats.bookingsFromAds, sub: `${stats.visitToBookingRate}% rate` },
              { label: "Paid", value: stats.paidBookings, sub: `${stats.bookingToPayRate}% rate` },
              { label: "Revenue", value: null, sub: stats.revenueFromAds > 0 ? `€${Math.round(stats.revenueFromAds)}` : "€0", isRevenue: true },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-warm-200 bg-white p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{item.label}</p>
                {'isRevenue' in item && item.isRevenue ? (
                  <p className="mt-1 text-xl font-bold text-green-600">{item.sub}</p>
                ) : (
                  <>
                    <p className="mt-1 text-xl font-bold text-gray-900">{item.value}</p>
                    {item.sub && <p className="text-[10px] text-gray-400">{item.sub}</p>}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Funnel bar */}
          <div className="rounded-xl border border-warm-200 bg-white p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Conversion Funnel</p>
            <div className="space-y-1.5">
              {[
                { label: "Clicks", count: stats.visits, color: "bg-blue-500" },
                { label: "Signups", count: stats.signups, color: "bg-purple-500" },
                { label: "Bookings", count: stats.bookingsFromAds, color: "bg-orange-500" },
                { label: "Paid", count: stats.paidBookings, color: "bg-green-500" },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-gray-500">{step.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${step.color} transition-all`}
                      style={{ width: `${stats.visits > 0 ? Math.max((step.count / stats.visits) * 100, step.count > 0 ? 3 : 0) : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs font-medium text-gray-700 text-right">{step.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Ad Visitors - the key new section */}
          {stats.recentVisitors && stats.recentVisitors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Recent Ad Visitors</p>
              <div className="rounded-xl border border-warm-200 bg-white overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-warm-100">
                  {stats.recentVisitors.map((v, i) => (
                    <div key={i} className="px-3 py-2.5 hover:bg-warm-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${v.converted ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {v.converted ? "Converted" : "Bounced"}
                          </span>
                          <span className="text-xs font-medium text-gray-800">{v.keyword}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{timeAgo(v.time)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <span className="text-gray-500">{v.landing}</span>
                        {v.pages.length > 1 && (
                          <>
                            <span>→</span>
                            {v.pages.slice(1, 5).map((p, j) => (
                              <span key={j}>
                                {j > 0 && <span className="mx-0.5">→</span>}
                                <span className="text-gray-500">{p.replace(/^\/[a-z]{2}\//, "/")}</span>
                              </span>
                            ))}
                            {v.pages.length > 5 && <span className="text-gray-400">+{v.pages.length - 5} more</span>}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top keywords */}
          {stats.topKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Top Keywords</p>
              <div className="rounded-xl border border-warm-200 bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-warm-50 border-b border-warm-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Keyword</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Clicks</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Bookings</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100">
                    {stats.topKeywords.map((kw) => (
                      <tr key={kw.keyword}>
                        <td className="px-3 py-2 text-gray-900">{kw.keyword}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{kw.visits}</td>
                        <td className="px-3 py-2 text-right text-gray-700 font-medium">{kw.bookings || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{kw.revenue > 0 ? `€${Math.round(kw.revenue)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top pages viewed by ad visitors */}
          {stats.topAdPages && stats.topAdPages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Pages Viewed by Ad Visitors</p>
              <div className="space-y-1">
                {stats.topAdPages.map((p) => (
                  <div key={p.page} className="flex items-center justify-between rounded-lg bg-white border border-warm-100 px-3 py-1.5">
                    <span className="text-xs text-gray-700 truncate">{p.page}</span>
                    <span className="text-xs font-medium text-gray-500 shrink-0 ml-2">{p.views} views</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top landing pages */}
          {stats.topLandingPages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Top Landing Pages</p>
              <div className="space-y-1">
                {stats.topLandingPages.map((p) => (
                  <div key={p.page} className="flex items-center justify-between rounded-lg bg-white border border-warm-100 px-3 py-1.5">
                    <span className="text-xs text-gray-700 truncate">{p.page}</span>
                    <span className="text-xs font-medium text-gray-500 shrink-0 ml-2">{p.visits}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily chart (simple) */}
          {stats.dailyVisits.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Daily Ad Clicks (14d)</p>
              <div className="flex items-end gap-1 h-20 rounded-xl border border-warm-200 bg-white p-3">
                {stats.dailyVisits.map((d) => {
                  const max = Math.max(...stats.dailyVisits.map(v => v.visits), 1);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.visits} clicks`}>
                      <div
                        className="w-full rounded-sm bg-blue-500 min-h-[2px]"
                        style={{ height: `${(d.visits / max) * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-gray-400">{stats.dailyVisits[0]?.date?.slice(5)}</span>
                <span className="text-[9px] text-gray-400">{stats.dailyVisits[stats.dailyVisits.length - 1]?.date?.slice(5)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
