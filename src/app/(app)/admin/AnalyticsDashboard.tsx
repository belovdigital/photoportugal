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
    top3: { count: number; prev?: number | null; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    top10: { count: number; prev?: number | null; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    top20: { count: number; prev?: number | null; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    top100: { count: number; prev?: number | null; queries: { query: string; clicks: number; impressions: number; position: number; positionChange?: number | null }[] };
    total: number;
    prevTotal?: number | null;
    movements?: {
      [key: string]: {
        entered: { query: string; position: number; prevPosition: number | null }[];
        exited: { query: string; position: number | null; prevPosition: number }[];
      };
    };
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
            {b.prev !== undefined && b.prev !== null && (() => {
              const diff = b.count - b.prev;
              return diff !== 0 ? (
                <p className={`mt-1 text-sm font-bold ${diff > 0 ? "text-green-500" : "text-red-500"}`}>
                  {diff > 0 ? `▲ +${diff}` : `▼ ${diff}`}
                </p>
              ) : null;
            })()}
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

      {/* Daily movements per bucket */}
      {dist.movements && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buckets.map(b => {
            const m = dist.movements?.[b.key];
            if (!m || (m.entered.length === 0 && m.exited.length === 0)) return null;
            return (
              <div key={b.key} className="rounded-xl border border-warm-200 bg-white p-3">
                <p className="text-xs font-bold text-gray-700 mb-2">{b.label} changes vs yesterday</p>
                {m.entered.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-green-600 mb-1">▲ Entered ({m.entered.length})</p>
                    {m.entered.map(q => (
                      <div key={q.query} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-gray-800 truncate mr-2">{q.query}</span>
                        <span className="shrink-0 text-[10px] text-green-600 font-medium">
                          {q.prevPosition ? `${q.prevPosition} → ${q.position}` : `new @ ${q.position}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {m.exited.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-red-600 mb-1">▼ Exited ({m.exited.length})</p>
                    {m.exited.map(q => (
                      <div key={q.query} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-gray-800 truncate mr-2">{q.query}</span>
                        <span className="shrink-0 text-[10px] text-red-600 font-medium">
                          was {q.prevPosition}{q.position ? ` → ${q.position}` : " → gone"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
  { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "behavior", label: "Behavior", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { key: "clarity", label: "Clarity", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
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
    visit_number: number; total_visits: number;
  }[];
  dailySessions: { day: string; sessions: string; visitors: string }[];
  seriesBucket?: "hour" | "day" | "week" | "month";
  period?: string;
}

type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "year" | "custom";
const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "year", label: "Last year" },
  { key: "custom", label: "Custom…" },
];

// Minimal SVG line chart — one series, responsive width, hover dot + tooltip.
function LineChart({
  data,
  color,
  bucket,
  height = 200,
}: {
  data: { day: string; value: number }[];
  color: string;
  bucket: "hour" | "day" | "week" | "month";
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 800; // viewBox width; scales responsively
  const padL = 40, padR = 12, padT = 10, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...data.map(d => d.value));
  const yTicks = 4;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
    const y = padT + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const fmtLabel = (dayStr: string) => {
    const d = new Date(dayStr);
    if (bucket === "hour") return `${d.getHours().toString().padStart(2, "0")}:00`;
    if (bucket === "week") return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    if (bucket === "month") return d.toLocaleString("en", { month: "short" });
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  // Reduce x-axis labels for readability
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  const pathD = points.length > 0
    ? "M " + points.map(p => `${p.x},${p.y}`).join(" L ")
    : "";

  const areaD = points.length > 0
    ? `M ${points[0].x},${padT + innerH} L ` + points.map(p => `${p.x},${p.y}`).join(" L ") + ` L ${points[points.length - 1].x},${padT + innerH} Z`
    : "";

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-auto" style={{ maxHeight: height }}>
        {/* Y-axis grid + labels */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const pct = i / yTicks;
          const y = padT + innerH * pct;
          const val = Math.round(max * (1 - pct));
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E8E0D8" strokeWidth={1} strokeDasharray={i === yTicks ? "" : "2 3"} />
              <text x={padL - 6} y={y + 3} fontSize="10" fill="#9CA3AF" textAnchor="end">{val}</text>
            </g>
          );
        })}
        {/* Area fill under line */}
        {points.length > 1 && <path d={areaD} fill={color} opacity={0.1} />}
        {/* Line */}
        {points.length > 1 && <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Hit area (invisible) */}
            <rect
              x={p.x - (innerW / Math.max(data.length - 1, 1) / 2)}
              y={padT}
              width={innerW / Math.max(data.length - 1, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: "pointer" }}
            />
            <circle cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 3} fill={color} stroke="white" strokeWidth={2} style={{ transition: "r 0.15s" }} />
          </g>
        ))}
        {/* X-axis labels */}
        {points.map((p, i) => (
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={p.x} y={height - 10} fontSize="10" fill="#9CA3AF" textAnchor="middle">{fmtLabel(p.day)}</text>
          ) : null
        ))}
      </svg>
      {/* Tooltip */}
      {hoverIdx !== null && points[hoverIdx] && (() => {
        const p = points[hoverIdx];
        const leftPct = (p.x / width) * 100;
        const topPct = (p.y / height) * 100;
        return (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${leftPct}%`, top: `${topPct}%`, marginTop: "-8px" }}
          >
            <div className="font-semibold">{p.value}</div>
            <div className="text-[10px] text-gray-300">{fmtLabel(p.day)}</div>
          </div>
        );
      })()}
    </div>
  );
}

// Minimal sparkline — just a small line, no axes, for KPI cards.
function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return <div style={{ height }} className="w-full" />;
  const width = 100;
  const max = Math.max(1, ...data);
  const min = 0;
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaPoints = data.length > 1 ? `0,${height} ${points} ${width},${height}` : "";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.length > 1 && <polygon points={areaPoints} fill={color} opacity={0.12} />}
      {data.length > 1 && <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

// Pretty format for revenue
function fmtEur(n: number): string {
  if (n >= 10000) return `€${Math.round(n / 1000)}k`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

// Classify UTM source into a readable channel with color
function sourceLabel(source: string, medium: string | null): { name: string; color: string } {
  const s = source.toLowerCase();
  if (medium === "cpc" || s.includes("ads")) return { name: `${source} (ads)`, color: "bg-amber-100 text-amber-700" };
  if (s === "direct") return { name: "Direct", color: "bg-gray-100 text-gray-700" };
  if (s === "google") return { name: "Google (organic)", color: "bg-blue-100 text-blue-700" };
  if (s.includes("instagram") || s.includes("facebook") || s.includes("tiktok")) return { name: source, color: "bg-pink-100 text-pink-700" };
  return { name: source, color: "bg-warm-100 text-gray-700" };
}

interface OverviewData {
  period: string;
  bucket: "hour" | "day" | "week" | "month";
  summary: {
    visitors: number; visitorsPrev: number;
    sessions: number; sessionsPrev: number;
    bookings: number; bookingsPrev: number;
    revenue: number; revenuePrev: number;
    conversionRate: number; conversionRatePrev: number;
    inquiries: number; pending: number; cancelled: number;
  };
  live: { count: number };
  sessionSeries: { day: string; sessions: string; visitors: string }[];
  bookingSeries: { day: string; bookings: string; revenue: string }[];
  revenueBySource: { source: string; medium: string | null; users: string; paid_bookings: string; revenue: string }[];
  revenueByLocation: { location_slug: string; bookings: string; revenue: string }[];
  funnel: { visitors: number; viewed: number; inquiry: number; created: number; paid: number };
  heatmap: { dow: number; hour: number; count: number }[];
}

// Sessions heatmap: weekday × hour. Darker = more sessions.
// Use the 90th percentile as the color scale max so rare spikes don't wash out the rest of the grid.
function HeatmapChart({ data }: { data: { dow: number; hour: number; count: number }[] }) {
  const matrix: Record<string, number> = {};
  for (const d of data) matrix[`${d.dow}-${d.hour}`] = d.count;
  const counts = data.map(d => d.count).filter(c => c > 0).sort((a, b) => a - b);
  if (counts.length === 0) return <p className="text-xs text-gray-400">No data</p>;
  const p90Index = Math.floor(counts.length * 0.9);
  const colorMax = Math.max(1, counts[p90Index] || counts[counts.length - 1]);
  // Display Monday first (ISO week order). dow values come from JS getDay(): 0=Sun..6=Sat.
  const days: Array<{ label: string; dow: number }> = [
    { label: "Mon", dow: 1 },
    { label: "Tue", dow: 2 },
    { label: "Wed", dow: 3 },
    { label: "Thu", dow: 4 },
    { label: "Fri", dow: 5 },
    { label: "Sat", dow: 6 },
    { label: "Sun", dow: 0 },
  ];
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour header */}
        <div className="flex">
          <div className="w-10 shrink-0" />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="flex-1 min-w-[14px] text-center text-[9px] text-gray-400">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {/* Rows */}
        {days.map(({ label: day, dow }) => (
          <div key={dow} className="flex items-center">
            <div className="w-10 shrink-0 text-[10px] font-medium text-gray-500 pr-2 text-right">{day}</div>
            {Array.from({ length: 24 }).map((_, h) => {
              const count = matrix[`${dow}-${h}`] || 0;
              // Cap intensity at 1 — anything above p90 stays at max opacity instead of spiking.
              const intensity = Math.min(1, count / colorMax);
              const bg = count === 0 ? "#F3EDE6" : `rgba(201, 69, 54, ${0.15 + intensity * 0.75})`;
              return (
                <div
                  key={h}
                  className="flex-1 min-w-[14px] aspect-square rounded-sm m-[1px]"
                  style={{ backgroundColor: bg }}
                  title={`${day} ${h.toString().padStart(2, "0")}:00 — ${count} sessions`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ period, customFrom, customTo }: { period: string; customFrom: string; customTo: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ period });
    if (period === "custom" && customFrom && customTo) { qs.set("from", customFrom); qs.set("to", customTo); }
    fetch(`/api/admin/overview?${qs.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <p className="text-sm text-gray-400">Loading overview…</p>;
  if (!data) return <p className="text-sm text-gray-400">No data</p>;

  const { summary: s, funnel: f } = data;
  const sessionSpark = data.sessionSeries.map(d => parseInt(d.visitors));
  const bookingSpark = data.bookingSeries.map(d => parseInt(d.bookings));
  const revenueSpark = data.bookingSeries.map(d => parseFloat(d.revenue));

  const kpis = [
    { label: "Unique Visitors", value: s.visitors.toLocaleString(), prev: s.visitorsPrev, current: s.visitors, spark: sessionSpark, color: "#6366F1" },
    { label: "Sessions", value: s.sessions.toLocaleString(), prev: s.sessionsPrev, current: s.sessions, spark: data.sessionSeries.map(d => parseInt(d.sessions)), color: "#C94536" },
    { label: "Paid Bookings", value: s.bookings.toLocaleString(), prev: s.bookingsPrev, current: s.bookings, spark: bookingSpark, color: "#10B981" },
    { label: "Revenue", value: fmtEur(s.revenue), prev: s.revenuePrev, current: s.revenue, spark: revenueSpark, color: "#10B981" },
    { label: "Conversion Rate", value: `${s.conversionRate}%`, prev: s.conversionRatePrev, current: s.conversionRate, spark: [], color: "#A855F7" },
  ];

  const funnelSteps = [
    { key: "visitors", label: "Visitors", count: f.visitors },
    { key: "viewed", label: "Viewed a photographer", count: f.viewed },
    { key: "inquiry", label: "Sent inquiry", count: f.inquiry },
    { key: "created", label: "Created booking", count: f.created },
    { key: "paid", label: "Paid", count: f.paid },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards with sparklines */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-warm-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{k.value}</p>
            {k.prev > 0 && typeof k.current === "number" && (
              <Change current={k.current} previous={k.prev} />
            )}
            {k.spark.length > 0 && (
              <div className="mt-2">
                <Sparkline data={k.spark} color={k.color} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Conversion Funnel</h3>
        <div className="space-y-2">
          {funnelSteps.map((step, i) => {
            const first = funnelSteps[0].count || 1;
            const prev = i > 0 ? funnelSteps[i - 1].count || 1 : step.count;
            const pctTotal = Math.round((step.count / first) * 100);
            const pctStep = i === 0 ? 100 : Math.round((step.count / prev) * 100);
            return (
              <div key={step.key}>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-700">{step.label}</span>
                  <span>
                    <strong className="text-gray-900">{step.count.toLocaleString()}</strong>
                    <span className="ml-2 text-gray-400">· {pctTotal}% of visitors {i > 0 && `· ${pctStep}% from prev`}</span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-warm-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pctTotal}%`, minWidth: step.count > 0 ? "4px" : "0" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue by Source + Location */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-warm-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue by Source</h3>
          {data.revenueBySource.length === 0 ? (
            <p className="text-xs text-gray-400">No data for this period</p>
          ) : (
            <div className="space-y-2">
              {data.revenueBySource.map((r, i) => {
                const lbl = sourceLabel(r.source, r.medium);
                const rev = parseFloat(r.revenue);
                const bookings = parseInt(r.paid_bookings);
                const users = parseInt(r.users);
                return (
                  <div key={`${r.source}-${r.medium}-${i}`} className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${lbl.color}`}>{lbl.name}</span>
                      <div className="mt-0.5 text-[11px] text-gray-500">{users} users · {bookings} paid</div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className="text-sm font-bold text-gray-900">{fmtEur(rev)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-warm-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue by Location</h3>
          {data.revenueByLocation.length === 0 ? (
            <p className="text-xs text-gray-400">No paid bookings for this period</p>
          ) : (
            <div className="space-y-2">
              {data.revenueByLocation.map(r => {
                const rev = parseFloat(r.revenue);
                const bookings = parseInt(r.bookings);
                return (
                  <div key={r.location_slug} className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 capitalize">{r.location_slug}</span>
                      <div className="text-[11px] text-gray-500">{bookings} bookings</div>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{fmtEur(rev)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Secondary info: inquiries, pending, cancelled */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Inquiries (not booking)", value: s.inquiries, color: "text-blue-600" },
          { label: "Pending bookings", value: s.pending, color: "text-amber-600" },
          { label: "Cancelled", value: s.cancelled, color: "text-gray-500" },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-warm-200 bg-white p-3 text-center">
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Heatmap: when visitors come (weekday × hour) */}
      {data.heatmap && data.heatmap.length > 0 && (
        <div className="rounded-xl border border-warm-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">When do visitors come? <span className="font-normal text-gray-400">(sessions by weekday × hour)</span></h3>
          <HeatmapChart data={data.heatmap} />
        </div>
      )}
    </div>
  );
}

// Real-time plate — polls "live count" every 15 seconds
function LiveCounter() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      fetch("/api/admin/overview?period=today")
        .then(r => r.json())
        .then(d => setCount(d.live?.count ?? 0))
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {count === null ? "—" : count} visitor{count === 1 ? "" : "s"} on site now
    </div>
  );
}

interface ClarityData {
  numOfDays: number;
  period: string;
  note: string;
  dashboardUrl: string;
  metrics: Record<string, Array<Record<string, string | number | null>>>;
}

function ClarityTab({ period }: { period: string }) {
  const [data, setData] = useState<ClarityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/clarity?period=${period}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); })
      .then(d => { setData(d); setError(""); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <p className="text-sm text-gray-400">Loading Clarity data…</p>;
  if (error) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">Clarity API error</p>
      <p className="mt-1 text-xs">{error}</p>
    </div>
  );
  if (!data) return null;

  const m = data.metrics;
  const traffic = m.Traffic?.[0];
  const engagement = m.EngagementTime?.[0];
  const scroll = m.ScrollDepth?.[0];
  const dead = m.DeadClickCount?.[0];
  const rage = m.RageClickCount?.[0];
  const quickback = m.QuickbackClick?.[0];
  const scriptErr = m.ScriptErrorCount?.[0];
  const scrollAvg = scroll?.averageScrollDepth;
  const engActive = engagement?.activeTime ? Number(engagement.activeTime) : 0;
  const engTotal = engagement?.totalTime ? Number(engagement.totalTime) : 0;

  const headerMetrics = [
    { label: "Sessions", value: traffic?.totalSessionCount ?? "0", color: "text-gray-900" },
    { label: "Bot sessions", value: traffic?.totalBotSessionCount ?? "0", color: "text-gray-400" },
    { label: "Unique Users", value: traffic?.distinctUserCount ?? "0", color: "text-gray-900" },
    { label: "Pages / Session", value: traffic?.pagesPerSessionPercentage != null ? Number(traffic.pagesPerSessionPercentage).toFixed(2) : "—", color: "text-gray-900" },
    { label: "Avg Scroll Depth", value: scrollAvg != null ? `${Number(scrollAvg).toFixed(0)}%` : "—", color: "text-gray-900" },
    { label: "Active Time (avg)", value: `${engActive}s`, color: "text-gray-900", sub: `of ${engTotal}s total` },
  ];

  const issues = [
    { label: "Dead Clicks", data: dead, color: "text-amber-700", desc: "Clicks that didn't do anything (users expected action)." },
    { label: "Rage Clicks", data: rage, color: "text-red-600", desc: "Rapid repeated clicks → frustration." },
    { label: "Quick Back", data: quickback, color: "text-orange-600", desc: "User landed on page and immediately hit back." },
    { label: "Script Errors", data: scriptErr, color: "text-rose-600", desc: "JS errors during the session." },
  ];

  const renderTopList = (items: Array<Record<string, string | number | null>>, nameKey: string, countKey = "sessionsCount", limit = 10) => (
    <div className="space-y-1.5">
      {(items || []).slice(0, limit).map((it, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
          <span className="text-xs text-gray-700 truncate">{it[nameKey] || "(none)"}</span>
          <span className="text-xs font-semibold text-gray-900">{it[countKey]}</span>
        </div>
      ))}
      {(!items || items.length === 0) && <p className="text-xs text-gray-400">No data</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Clarity-specific note + Dashboard link */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div>
          <p className="text-sm font-semibold text-blue-800">Microsoft Clarity — behavior analytics</p>
          <p className="mt-0.5 text-xs text-blue-700">
            Data from Clarity Data Export API (last {data.numOfDays} day{data.numOfDays === 1 ? "" : "s"}).
            Session recordings & visual heatmaps are in the Clarity dashboard.
          </p>
        </div>
        <a
          href={data.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Open Clarity Dashboard →
        </a>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {headerMetrics.map(h => (
          <div key={h.label} className="rounded-xl border border-warm-200 bg-white p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{h.label}</p>
            <p className={`mt-1 text-lg font-bold ${h.color}`}>{h.value}</p>
            {h.sub && <p className="text-[10px] text-gray-400">{h.sub}</p>}
          </div>
        ))}
      </div>

      {/* User frustration signals */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">User frustration signals</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {issues.map(item => {
            const pct = item.data?.sessionsWithMetricPercentage != null ? Number(item.data.sessionsWithMetricPercentage) : 0;
            const subTotal = item.data?.subTotal != null ? String(item.data.subTotal) : "0";
            return (
              <div key={item.label} className="rounded-xl border border-warm-200 bg-white p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{item.label}</p>
                <p className={`mt-1 text-lg font-bold ${item.color}`}>{pct.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-400">{subTotal} events · of sessions</p>
                <p className="mt-1 text-[10px] text-gray-500 leading-tight">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdowns in two columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Popular Pages</h3>
          {renderTopList(m.PopularPages || [], "url", "visitsCount")}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Referrers</h3>
          {renderTopList(m.ReferrerUrl || [], "name", "sessionsCount")}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">By Device</h3>
          {renderTopList(m.Device || [], "name")}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">By Browser</h3>
          {renderTopList(m.Browser || [], "name", "sessionsCount", 8)}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">By Country</h3>
          {renderTopList(m.Country || [], "name", "sessionsCount", 10)}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">By OS</h3>
          {renderTopList(m.OS || [], "name")}
        </div>
      </div>
    </div>
  );
}

interface BehaviorData {
  flows: { sequence: string; count: number }[];
  landingPages: { page: string; sessions: number; bounced: number; bounceRate: number }[];
  dropOff: { fromPage: string; toPage: string; count: number }[];
}

function BehaviorTab({ period, customFrom, customTo }: { period: string; customFrom: string; customTo: string }) {
  const [data, setData] = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ period });
    if (period === "custom" && customFrom && customTo) { qs.set("from", customFrom); qs.set("to", customTo); }
    fetch(`/api/admin/behavior?${qs.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <p className="text-sm text-gray-400">Loading behavior…</p>;
  if (!data) return <p className="text-sm text-gray-400">No data</p>;

  return (
    <div className="space-y-5">
      {/* Top user flows */}
      <div className="rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top User Flows <span className="font-normal text-gray-400">(most common page sequences)</span></h3>
        {data.flows.length === 0 ? (
          <p className="text-xs text-gray-400">Not enough data</p>
        ) : (
          <div className="space-y-2">
            {data.flows.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-warm-50 px-3 py-2">
                <span className="text-[10px] font-bold text-gray-400">#{i + 1}</span>
                <div className="flex-1 min-w-0 text-xs text-gray-700 truncate" title={f.sequence}>
                  {f.sequence.split(" → ").map((page, idx, arr) => (
                    <span key={idx}>
                      <span className="font-mono">{page}</span>
                      {idx < arr.length - 1 && <span className="mx-1 text-gray-400">→</span>}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-xs font-semibold text-gray-900">{f.count} sessions</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Landing pages with bounce rate */}
      <div className="rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Landing Pages & Bounce Rate</h3>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-warm-50 border-b border-warm-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Page</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Sessions</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Bounced</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Bounce Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {data.landingPages.map(p => (
                <tr key={p.page}>
                  <td className="px-3 py-2 font-mono text-gray-900 truncate max-w-md">{p.page}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{p.sessions}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{p.bounced}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${p.bounceRate >= 70 ? "text-red-600" : p.bounceRate >= 50 ? "text-amber-600" : "text-green-600"}`}>
                    {p.bounceRate}%
                  </td>
                </tr>
              ))}
              {data.landingPages.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top drop-off transitions */}
      <div className="rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Drop-off Points <span className="font-normal text-gray-400">(pages where users leave the site after)</span></h3>
        {data.dropOff.length === 0 ? (
          <p className="text-xs text-gray-400">Not enough data</p>
        ) : (
          <div className="space-y-2">
            {data.dropOff.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-warm-50 px-3 py-2">
                <span className="text-xs font-mono text-gray-700 truncate flex-1" title={d.fromPage}>{d.fromPage}</span>
                <span className="shrink-0 text-xs text-gray-400">→ exit</span>
                <span className="shrink-0 text-xs font-semibold text-red-600">{d.count} sessions</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Convert any ISO 3166-1 alpha-2 code to emoji flag
function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

const getCountry = (code: string) => ({
  flag: codeToFlag(code),
  name: (() => { try { return countryNames.of(code) || code; } catch { return code; } })(),
});

export function VisitorsTab({ recentOnly = false, hideRecent = false }: { recentOnly?: boolean; hideRecent?: boolean } = {}) {
  const [vd, setVd] = useState<VisitorData | null>(null);
  const [vLoading, setVLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionLimit, setSessionLimit] = useState(30);
  // Default to the "ads" tab: paid traffic is the highest-value cohort
  // to inspect first when checking who's actually landing from Google
  // Ads sitelinks. "All" stays one tap away.
  const [roleFilter, setRoleFilter] = useState("ads");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Initial load + auto-refresh every 15s
  const fetchVisitors = useCallback(() => {
    const qs = new URLSearchParams({
      limit: String(sessionLimit),
      role: roleFilter,
      country: countryFilter,
      period,
    });
    if (period === "custom" && customFrom && customTo) {
      qs.set("from", customFrom);
      qs.set("to", customTo);
    }
    fetch(`/api/admin/visitors?${qs.toString()}`)
      .then(r => r.json())
      .then(d => { setVd(d); setVLoading(false); })
      .catch(() => setVLoading(false));
  }, [sessionLimit, roleFilter, countryFilter, period, customFrom, customTo]);

  useEffect(() => {
    fetchVisitors();
    const interval = setInterval(fetchVisitors, 15000);
    return () => clearInterval(interval);
  }, [fetchVisitors]);

  // sessionsLoading is set when filters change — reset after fetchVisitors runs
  useEffect(() => {
    if (vd) setSessionsLoading(false);
  }, [vd]);

  if (vLoading) return <p className="text-sm text-gray-400">Loading visitor data...</p>;
  if (!vd) return <p className="text-sm text-gray-400">No visitor data yet</p>;

  const { summary: s, today: t } = vd;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {!recentOnly && <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
      </div>}

      {!recentOnly && <>
      {/* Period selector + 2 line charts (sessions, unique visitors) */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                period === opt.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white border border-warm-200 text-gray-600 hover:border-primary-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs" />
            </div>
          )}
        </div>

        {vd.dailySessions.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-warm-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary-500 mr-2 align-middle" />
                Sessions
              </h3>
              <LineChart
                data={vd.dailySessions.map(d => ({ day: d.day, value: parseInt(d.sessions) }))}
                color="#C94536"
                bucket={vd.seriesBucket || "day"}
                height={260}
              />
            </div>
            <div className="rounded-xl border border-warm-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500 mr-2 align-middle" />
                Unique visitors
              </h3>
              <LineChart
                data={vd.dailySessions.map(d => ({ day: d.day, value: parseInt(d.visitors) }))}
                color="#6366F1"
                bucket={vd.seriesBucket || "day"}
                height={260}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-warm-200 bg-white p-6 text-center text-sm text-gray-400">
            No data for this period
          </div>
        )}
      </div>

      </>}

      {/* Recent Sessions */}
      {!hideRecent && <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Visitors</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "ads", label: "Ads", icon: "💸" },
              { key: "all", label: "All", icon: "👥" },
              { key: "client", label: "Clients", icon: "🧳" },
              { key: "photographer", label: "Photographers", icon: "📸" },
              { key: "guest", label: "Guests", icon: "👻" },
            // "ads" + "all" are always shown (top-level tabs); the trimming
            // applies only to role-specific tabs that need actual rows.
            ].filter(f => f.key === "ads" || f.key === "all" || vd.recentSessions.some(s => f.key === "guest" ? !s.user_role : s.user_role === f.key)).map(f => (
              <button
                key={f.key}
                onClick={() => { setRoleFilter(f.key); setSessionLimit(30); setSessionsLoading(true); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  roleFilter === f.key
                    ? "bg-primary-500 text-white shadow-sm"
                    : "bg-warm-100 text-gray-500 hover:bg-warm-200"
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
            <select
              value={countryFilter}
              onChange={e => { setCountryFilter(e.target.value); setSessionLimit(30); setSessionsLoading(true); }}
              className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 cursor-pointer transition appearance-none ${
                countryFilter !== "all"
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-warm-100 text-gray-500"
              }`}
            >
              <option value="all">🌍 All countries</option>
              {vd.countries.map(c => (
                <option key={c.country} value={c.country}>
                  {getCountry(c.country).flag} {getCountry(c.country).name} ({c.count})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={`space-y-2 transition-opacity ${sessionsLoading ? "opacity-50" : ""}`}>
          {vd.recentSessions.map(session => {
            const visitNum = session.user_role !== "photographer" && session.user_role !== "admin" && session.total_visits > 1
              ? session.visit_number : null;
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
                className={`w-full text-left rounded-xl border p-3 hover:shadow-sm transition ${isExpanded ? "border-primary-300 shadow-sm" : "border-warm-200"} ${
                  session.user_role === "client" ? "bg-gradient-to-r from-emerald-50 to-white border-emerald-200" :
                  "bg-white"
                }`}
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
                          <span className={`text-sm font-semibold truncate ${session.user_role === "photographer" ? "text-blue-600" : session.user_role === "client" ? "text-emerald-600" : "text-gray-900"}`}>{session.user_name}</span>
                        ) : (
                          <span className="text-sm text-gray-500 truncate font-mono">{session.visitor_id.slice(0, 8)}</span>
                        )}
                        {session.user_role && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            session.user_role === "photographer" ? "bg-blue-50 text-blue-600" : session.user_role === "admin" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                          }`}>{session.user_role}</span>
                        )}
                        {visitNum && <span className="text-[10px] text-gray-400 font-medium">visit #{visitNum}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-medium">{session.country ? `${getCountry(session.country).flag} ${getCountry(session.country).name}` : "🏳️ Unknown"}</span>
                        {session.utm_source ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${session.utm_medium === "cpc" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {session.utm_source}{session.utm_medium === "cpc" ? " ads" : ""}{session.utm_term ? ` — "${session.utm_term}"` : ""}
                          </span>
                        ) : session.referrer ? (
                          <span className="rounded-full bg-warm-100 text-gray-700 px-2 py-0.5 text-xs font-medium">{session.referrer.replace(/^https?:\/\//, "").split("/")[0]}</span>
                        ) : null}
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

                            {/* Page info — path links to the live URL in a new
                                tab. stopPropagation so the link click doesn't
                                also toggle the session card. */}
                            <div className={`flex-1 ${!isLast ? "pb-2" : ""}`}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{getIcon(pv.path)}</span>
                                <a
                                  href={pv.path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-medium text-gray-900 hover:text-primary-600 hover:underline"
                                >
                                  {shortPath(pv.path)}
                                </a>
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
      }
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("overview");
  // Global period — applies to Overview + Visitors charts. Other tabs (GSC, Ads) run on their own windows for now.
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const queriesSort = useSortable<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>("clicks", "desc");
  const pagesSort = useSortable<{ path: string; views: number; users: number }>("views", "desc");

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ period });
    if (period === "custom" && customFrom && customTo) { qs.set("from", customFrom); qs.set("to", customTo); }
    fetch(`/api/admin/analytics?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [period, customFrom, customTo]);

  if (loading) return <p className="text-sm text-gray-400">Loading analytics...</p>;
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>;
  if (!data) return null;

  const ga4 = data.ga4;
  const gsc = data.gsc;

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Header: global period selector + real-time counter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                period === opt.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white border border-warm-200 text-gray-600 hover:border-primary-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs" />
            </div>
          )}
        </div>
        <LiveCounter />
      </div>

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

      {/* === OVERVIEW TAB === */}
      {activeTab === "overview" && (
        <>
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
          <OverviewTab period={period} customFrom={customFrom} customTo={customTo} />
        </>
      )}

      {/* === BEHAVIOR TAB === */}
      {activeTab === "behavior" && <BehaviorTab period={period} customFrom={customFrom} customTo={customTo} />}

      {/* === CLARITY TAB === */}
      {activeTab === "clarity" && <ClarityTab period={period} />}

      {/* Smart Insights — at top of Visitors tab */}
      {activeTab === "visitors" && data.insights && data.insights.length > 0 && (
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

      {/* === VISITORS TAB === */}
      {activeTab === "visitors" && <VisitorsTab hideRecent />}

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
    signups: number;
    bookingsFromAds: number;
    paidBookings: number;
    revenueFromAds: number;
    visitToBookingRate: string;
    bookingToPayRate: string;
    recentVisitors: { keyword: string; campaign: string; landing: string; time: string; pages: string[] }[];
    googleAds: {
      totalImpressions: number;
      totalClicks: number;
      totalCost: number;
      totalConversions: number;
      avgCpc: string;
      ctr: string;
      adGroups: { name: string; impressions: number; clicks: number; cost: number; conversions: number; ctr: string; avgCpc: string }[];
      keywords: { keyword: string; adGroup: string; impressions: number; clicks: number; cost: number; conversions: number; ctr: string; avgCpc: string }[];
      searchTerms: { term: string; impressions: number; clicks: number; cost: number; conversions: number }[];
      daily: { date: string; clicks: number; cost: number; impressions: number; conversions: number }[];
    } | null;
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

  const ga = stats?.googleAds;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
        Google Ads <span className="text-xs font-normal text-gray-400">Last 30 days</span>
      </h3>

      {loading ? (
        <p className="text-sm text-gray-400">Loading ads data...</p>
      ) : !stats ? (
        <p className="text-sm text-gray-500">Failed to load ads data.</p>
      ) : (
        <div className="space-y-4">
          {/* Google Ads API metrics */}
          {ga && (() => {
            const roas = ga.totalCost > 0 ? stats.revenueFromAds / ga.totalCost : 0;
            const costPerPaid = stats.paidBookings > 0 ? ga.totalCost / stats.paidBookings : 0;
            const roasColor = roas >= 1 ? "text-green-600" : roas >= 0.5 ? "text-amber-600" : "text-red-600";
            const roasBgColor = roas >= 1 ? "bg-green-50 border-green-200" : roas >= 0.5 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
            return (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {[
                  { label: "Spend", value: `€${ga.totalCost.toFixed(0)}`, color: "text-gray-900" },
                  { label: "Revenue from Ads", value: `€${Math.round(stats.revenueFromAds)}`, color: "text-green-600" },
                  { label: "ROAS", value: `${roas.toFixed(2)}x`, color: roasColor, bg: roasBgColor, hint: roas >= 1 ? "Profitable" : roas >= 0.5 ? "Break-even zone" : "Losing money" },
                  { label: "Cost / Paid Booking", value: stats.paidBookings > 0 ? `€${costPerPaid.toFixed(0)}` : "—", color: "text-gray-900" },
                  { label: "Impressions", value: ga.totalImpressions.toLocaleString(), color: "text-gray-900" },
                  { label: "Clicks", value: ga.totalClicks.toString(), color: "text-blue-600" },
                  { label: "CTR", value: `${ga.ctr}%`, color: "text-gray-900" },
                  { label: "Avg CPC", value: `€${ga.avgCpc}`, color: "text-gray-900" },
                ].map((item, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${item.bg || "border-warm-200 bg-white"}`}>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{item.label}</p>
                    <p className={`mt-1 text-lg font-bold ${item.color}`}>{item.value}</p>
                    {item.hint && <p className={`text-[10px] font-medium mt-0.5 ${item.color}`}>{item.hint}</p>}
                  </div>
                ))}
              </div>

              {/* On-site funnel */}
              <div className="rounded-xl border border-warm-200 bg-white p-4">
                <p className="text-xs font-semibold text-gray-500 mb-3">On-Site Funnel (UTM tracked)</p>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "Site Visits", value: stats.visits, sub: `${stats.visitsToday} today` },
                    { label: "Signups", value: stats.signups, sub: stats.visits > 0 ? `${((stats.signups / stats.visits) * 100).toFixed(0)}%` : "—" },
                    { label: "Bookings", value: stats.bookingsFromAds, sub: `${stats.visitToBookingRate}%` },
                    { label: "Paid", value: stats.paidBookings, sub: `${stats.bookingToPayRate}%` },
                    { label: "Revenue", value: null, sub: `€${Math.round(stats.revenueFromAds)}`, isRevenue: true },
                  ].map((item, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-gray-400">{item.label}</p>
                      {'isRevenue' in item && item.isRevenue ? (
                        <p className="text-lg font-bold text-green-600">{item.sub}</p>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-gray-900">{item.value}</p>
                          <p className="text-[10px] text-gray-400">{item.sub}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {ga.totalCost > 0 && stats.revenueFromAds > 0 && (
                  <div className="mt-3 pt-3 border-t border-warm-100 flex items-center justify-center gap-4">
                    <span className="text-xs text-gray-500">ROAS: <span className="font-bold text-green-600">{(stats.revenueFromAds / ga.totalCost).toFixed(1)}x</span></span>
                    <span className="text-xs text-gray-500">Cost/Booking: <span className="font-bold text-gray-900">€{stats.bookingsFromAds > 0 ? (ga.totalCost / stats.bookingsFromAds).toFixed(0) : "—"}</span></span>
                    <span className="text-xs text-gray-500">Cost/Paid: <span className="font-bold text-gray-900">€{stats.paidBookings > 0 ? (ga.totalCost / stats.paidBookings).toFixed(0) : "—"}</span></span>
                  </div>
                )}
              </div>

              {/* Daily charts — Clicks and Spend separately */}
              {ga.daily.length > 1 && (() => {
                const maxClicks = Math.max(...ga.daily.map(v => v.clicks), 1);
                const maxCost = Math.max(...ga.daily.map(v => v.cost), 1);
                return (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Clicks chart */}
                    <div className="rounded-xl border border-warm-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Daily Clicks (14d)</p>
                      {/* Value labels */}
                      <div className="flex gap-1">
                        {ga.daily.map((d) => (
                          <div key={d.date} className="flex-1 text-center">
                            <span className="text-[11px] font-bold text-gray-800">{d.clicks}</span>
                          </div>
                        ))}
                      </div>
                      {/* Bars */}
                      <div className="flex items-end gap-1 mt-1" style={{ height: 120 }}>
                        {ga.daily.map((d) => (
                          <div key={d.date} className="flex-1" title={`${d.date}: ${d.clicks} clicks`}>
                            <div className="w-full rounded-t bg-blue-500 transition-all" style={{ height: Math.max((d.clicks / maxClicks) * 120, 6) }} />
                          </div>
                        ))}
                      </div>
                      {/* Date labels */}
                      <div className="flex gap-1 mt-2 border-t border-warm-100 pt-1.5">
                        {ga.daily.map((d) => (
                          <span key={d.date} className="flex-1 text-center text-[9px] text-gray-400">
                            {d.date.slice(8)}/{d.date.slice(5, 7)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Spend chart */}
                    <div className="rounded-xl border border-warm-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Daily Spend (14d)</p>
                      {/* Value labels */}
                      <div className="flex gap-1">
                        {ga.daily.map((d) => (
                          <div key={d.date} className="flex-1 text-center">
                            <span className="text-[11px] font-bold text-gray-800">€{d.cost.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                      {/* Bars */}
                      <div className="flex items-end gap-1 mt-1" style={{ height: 120 }}>
                        {ga.daily.map((d) => (
                          <div key={d.date} className="flex-1" title={`${d.date}: €${d.cost.toFixed(2)}`}>
                            <div className="w-full rounded-t bg-emerald-500 transition-all" style={{ height: Math.max((d.cost / maxCost) * 120, 6) }} />
                          </div>
                        ))}
                      </div>
                      {/* Date labels */}
                      <div className="flex gap-1 mt-2 border-t border-warm-100 pt-1.5">
                        {ga.daily.map((d) => (
                          <span key={d.date} className="flex-1 text-center text-[9px] text-gray-400">
                            {d.date.slice(8)}/{d.date.slice(5, 7)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Ad Groups */}
              {ga.adGroups.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Ad Groups</p>
                  <div className="rounded-xl border border-warm-200 bg-white overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-warm-50 border-b border-warm-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Group</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Impr</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Clicks</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">CTR</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">CPC</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Cost</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Conv</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-warm-100">
                        {ga.adGroups.map((ag) => (
                          <tr key={ag.name}>
                            <td className="px-3 py-2 text-gray-900 font-medium">{ag.name}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{ag.impressions}</td>
                            <td className="px-3 py-2 text-right text-blue-600 font-medium">{ag.clicks}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{ag.ctr}%</td>
                            <td className="px-3 py-2 text-right text-gray-500">€{ag.avgCpc}</td>
                            <td className="px-3 py-2 text-right text-gray-700">€{ag.cost.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-medium">{ag.conversions > 0 ? <span className="text-green-600">{ag.conversions}</span> : <span className="text-gray-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Keywords */}
              {ga.keywords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Top Keywords (by clicks)</p>
                  <div className="rounded-xl border border-warm-200 bg-white overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-warm-50 border-b border-warm-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Keyword</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Clicks</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">CTR</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">CPC</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Cost</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Conv</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-warm-100">
                        {ga.keywords.map((kw, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-gray-900">{kw.keyword}</td>
                            <td className="px-3 py-2 text-right text-blue-600 font-medium">{kw.clicks}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{kw.ctr}%</td>
                            <td className="px-3 py-2 text-right text-gray-500">€{kw.avgCpc}</td>
                            <td className="px-3 py-2 text-right text-gray-700">€{kw.cost.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-medium">{kw.conversions > 0 ? <span className="text-green-600">{kw.conversions}</span> : <span className="text-gray-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Search Terms */}
              {ga.searchTerms.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Search Terms (what people typed)</p>
                  <div className="rounded-xl border border-warm-200 bg-white overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-warm-50 border-b border-warm-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Search Term</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Impr</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Clicks</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-warm-100">
                        {ga.searchTerms.map((st, i) => (
                          <tr key={i} className={st.clicks === 0 ? "opacity-50" : ""}>
                            <td className="px-3 py-2 text-gray-900">{st.term}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{st.impressions}</td>
                            <td className="px-3 py-2 text-right text-blue-600 font-medium">{st.clicks}</td>
                            <td className="px-3 py-2 text-right text-gray-700">€{st.cost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
            );
          })()}

        </div>
      )}
    </div>
  );
}
