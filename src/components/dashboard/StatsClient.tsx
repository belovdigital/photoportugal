"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localizeShootType } from "@/lib/shoot-type-labels";

/**
 * Photographer analytics dashboard (/dashboard/stats).
 *
 * Design intent: every number should point at an action — impressions
 * vs clicks (fix the card), views vs inquiries (fix packages/pricing),
 * visitor intent vs platform demand (fix the offer). Rates hide behind
 * minimum sample sizes so nobody redesigns their profile over 3 clicks.
 *
 * Charts are hand-rolled SVG (no chart lib in the bundle): series
 * colors #c94536 (site terracotta) + #0284c7 — CVD-validated pair.
 */

const SERIES = {
  views: "#c94536",
  impressions: "#0284c7",
} as const;

// Below these denominators a percentage is noise, not signal.
const MIN_IMPRESSIONS_FOR_RATE = 100;
const MIN_VIEWS_FOR_RATE = 20;

interface Totals {
  profileViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  cardImpressions: number;
  cardClicks: number;
  photoOpens: number;
  conciergeImpressions: number;
  conciergeClicks: number;
  gscImpressions: number;
  gscClicks: number;
  inquiries: number;
  paidBookings: number;
  bookOpens: number;
}

interface StatsResponse {
  range: { from: string; to: string; days: number };
  totals: { current: Totals; previous: Totals };
  timeline: {
    date: string;
    views: number;
    uniques: number;
    impressions: number;
    clicks: number;
    conciergeImpressions: number;
    gscImpressions: number;
    inquiries: number;
    paid: number;
    bookOpens: number;
  }[];
  breakdowns: {
    countries: Record<string, number>;
    devices: Record<string, number>;
    sources: Record<string, number>;
    intents: Record<string, number>;
    surfaces: Record<string, number>;
  };
  platformIntents: Record<string, number>;
  photos: { id: string; thumb: string; caption: string | null; position: number | null; opens: number }[];
  responseStats: {
    inquiries: number;
    offered: number;
    medianReplyMinutes: number | null;
    lifetimeAvgReplyMinutes: number | null;
    platform: { medianReplyMinutes: number | null; p25ReplyMinutes: number | null; inquiries: number; offered: number };
    offerImpact: { fast: { n: number; paid: number }; slow: { n: number; paid: number }; never: { n: number; paid: number } };
  };
  benchmarks: { pool: "peers" | "platform"; n: number; medViews: number | null; medConvPct: number | null; medReplyMinutes: number | null } | null;
  score: { total: number; max: number; checks: { key: string; ok: boolean; weight: number; href: string }[]; actions: { key: string; href: string }[] };
  annotations: { date: string; field: string }[];
  missedMatches: Record<string, number>;
  meta: {
    today: string;
    dataSince: string | null;
    cardDataSince: string | null;
    gscDataSince: string | null;
    profileCreatedAt: string;
  };
}

function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  const base = 0x1f1e6;
  const up = code.toUpperCase();
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65);
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function shareMap(m: Record<string, number>): Record<string, number> {
  const total = Object.values(m).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / total]));
}

// ─── Timeline chart (SVG, crosshair + tooltip) ───────────────────────

function TimelineChart({
  timeline,
  showImpressions,
  labels,
  locale,
  annotations = [],
}: {
  timeline: StatsResponse["timeline"];
  showImpressions: boolean;
  labels: { views: string; impressions: string };
  locale: string;
  /** Profile-change markers: date → joined field names for the tooltip. */
  annotations?: { date: string; label: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 720;
  const H = 220;
  const PAD = { top: 12, right: 12, bottom: 24, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const n = timeline.length;
  const maxY = Math.max(
    1,
    ...timeline.map((d) => Math.max(d.views, showImpressions ? d.impressions : 0)),
  );
  // Round the axis top to a friendly number
  const yTop = maxY <= 5 ? 5 : Math.ceil(maxY / 5) * 5;

  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yTop) * innerH;

  const linePath = (get: (d: StatsResponse["timeline"][number]) => number) =>
    timeline.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join("");

  const areaPath = `${linePath((d) => d.views)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);
  const tickEvery = Math.max(1, Math.ceil(n / 6));

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    if (clientX === undefined) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const h = hover !== null ? timeline[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        onMouseMove={onMove}
        onTouchStart={onMove}
        onTouchMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
      >
        {/* recessive grid */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(yTop * f)} y2={y(yTop * f)} stroke="#e6ddd0" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(yTop * f) + 3} textAnchor="end" fontSize={10} fill="#9ca3af">
              {Math.round(yTop * f)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#d5c5b0" strokeWidth={1} />

        {/* x ticks */}
        {timeline.map((d, i) =>
          i % tickEvery === 0 ? (
            <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {dateFmt.format(new Date(`${d.date}T12:00:00Z`))}
            </text>
          ) : null,
        )}

        {/* series */}
        <path d={areaPath} fill={SERIES.views} opacity={0.08} />
        {showImpressions && (
          <path d={linePath((d) => d.impressions)} fill="none" stroke={SERIES.impressions} strokeWidth={2} strokeLinejoin="round" />
        )}
        <path d={linePath((d) => d.views)} fill="none" stroke={SERIES.views} strokeWidth={2} strokeLinejoin="round" />

        {/* profile-change annotation markers */}
        {annotations.map((a) => {
          const i = timeline.findIndex((d) => d.date === a.date);
          if (i < 0) return null;
          return (
            <g key={a.date}>
              <line x1={x(i)} x2={x(i)} y1={PAD.top + 4} y2={y(0)} stroke="#b59475" strokeWidth={1} strokeDasharray="2 3" />
              <circle cx={x(i)} cy={PAD.top + 4} r={3.5} fill="#b59475" />
            </g>
          );
        })}

        {/* crosshair */}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.views)} r={4} fill={SERIES.views} stroke="#fff" strokeWidth={2} />
            {showImpressions && (
              <circle cx={x(hover)} cy={y(h.impressions)} r={4} fill={SERIES.impressions} stroke="#fff" strokeWidth={2} />
            )}
          </g>
        )}
      </svg>

      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="font-semibold text-gray-900">{dateFmt.format(new Date(`${h.date}T12:00:00Z`))}</p>
          <p className="mt-1 flex items-center gap-1.5 text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES.views }} />
            {labels.views}: <span className="font-semibold text-gray-900">{h.views}</span>
          </p>
          {showImpressions && (
            <p className="flex items-center gap-1.5 text-gray-600">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES.impressions }} />
              {labels.impressions}: <span className="font-semibold text-gray-900">{h.impressions}</span>
            </p>
          )}
          {annotations.filter((a) => a.date === h.date).map((a) => (
            <p key={a.label} className="mt-1 flex items-center gap-1.5 text-warm-700">
              <span className="h-2 w-2 rounded-full bg-warm-400" /> {a.label}
            </p>
          ))}
        </div>
      )}

      {/* legend (2 series) */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: SERIES.views }} /> {labels.views}
        </span>
        {showImpressions && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES.impressions }} /> {labels.impressions}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Horizontal bar list ─────────────────────────────────────────────

function BarList({
  entries,
  labelFor,
  emptyText,
}: {
  entries: [string, number][];
  labelFor: (key: string) => React.ReactNode;
  emptyText: string;
}) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <p className="py-6 text-center text-sm text-gray-400">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-3 text-sm">
          <div className="w-32 shrink-0 truncate text-gray-600 sm:w-40">{labelFor(key)}</div>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-warm-100">
            <div
              className="h-full rounded-r-[4px] bg-primary-500"
              style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
            />
          </div>
          <div className="w-10 shrink-0 text-right font-semibold tabular-nums text-gray-900">{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Intent comparison (yours vs platform) ───────────────────────────

function IntentCompare({
  mine,
  platform,
  locale,
  labels,
  emptyText,
}: {
  mine: Record<string, number>;
  platform: Record<string, number>;
  locale: string;
  labels: { you: string; platform: string; unknown: string };
  emptyText: string;
}) {
  const mineShare = shareMap(Object.fromEntries(Object.entries(mine).filter(([k]) => k !== "unknown")));
  const platShare = shareMap(platform);
  const keys = [...new Set([...Object.keys(mineShare), ...Object.keys(platShare)])]
    .sort((a, b) => (platShare[b] || 0) + (mineShare[b] || 0) - (platShare[a] || 0) - (mineShare[a] || 0))
    .slice(0, 8);

  if (keys.length === 0) return <p className="py-6 text-center text-sm text-gray-400">{emptyText}</p>;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: SERIES.views }} /> {labels.you}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warm-400" /> {labels.platform}
        </span>
      </div>
      <div className="space-y-3">
        {keys.map((k) => (
          <div key={k} className="text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="truncate text-gray-600">{k === "unknown" ? labels.unknown : localizeShootType(k, locale)}</span>
              <span className="shrink-0 text-xs tabular-nums text-gray-400">
                {((mineShare[k] || 0) * 100).toFixed(0)}% / {((platShare[k] || 0) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2.5 overflow-hidden rounded-sm bg-warm-100">
                <div className="h-full rounded-r-[4px]" style={{ width: `${(mineShare[k] || 0) * 100}%`, background: SERIES.views }} />
              </div>
              <div className="h-2.5 overflow-hidden rounded-sm bg-warm-100">
                <div className="h-full rounded-r-[4px] bg-warm-400" style={{ width: `${(platShare[k] || 0) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────

export function StatsClient() {
  const t = useTranslations("photographerStats");
  const locale = useLocale();
  const [days, setDays] = useState<30 | 90 | 180>(90);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard/stats?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: StatsResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, refreshNonce]);

  const numFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);

  const cur = data?.totals.current;
  const prev = data?.totals.previous;

  function delta(currentValue: number, previousValue: number): React.ReactNode {
    if (!data || previousValue === 0) return null;
    const change = ((currentValue - previousValue) / previousValue) * 100;
    if (!isFinite(change) || Math.abs(change) < 0.5) return null;
    const up = change > 0;
    return (
      <span className={`text-xs font-semibold ${up ? "text-accent-600" : "text-primary-600"}`}>
        {up ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
      </span>
    );
  }

  const sourceLabel = (key: string): string => {
    const known: Record<string, string> = {
      google_ads: t("sourceGoogleAds"),
      google: t("sourceGoogle"),
      direct: t("sourceDirect"),
      internal: t("sourceInternal"),
      referral: t("sourceReferral"),
      search_other: t("sourceSearchOther"),
      unknown: t("sourceUnknown"),
      other: t("sourceOther"),
    };
    return known[key] || key;
  };

  const surfaceLabel = (key: string): string => {
    const known: Record<string, string> = {
      catalog: t("surfaceCatalog"),
      location: t("surfaceLocation"),
      shoot_type: t("surfaceShootType"),
      home: t("surfaceHome"),
      blog: t("surfaceBlog"),
      spot: t("surfaceSpot"),
      concierge: t("surfaceConcierge"),
      profile: t("surfaceProfile"),
      other: t("sourceOther"),
    };
    return known[key] || key;
  };

  const newVisitors = cur ? Math.max(0, cur.uniqueVisitors - cur.returningVisitors) : 0;

  const fmtMinutes = (min: number | null): string => {
    if (min === null || !isFinite(min)) return "—";
    if (min < 60) return t("minutesShort", { n: Math.max(1, Math.round(min)) });
    if (min < 48 * 60) return t("hoursShort", { n: Math.round(min / 60) });
    return t("daysShort", { n: Math.round(min / 1440) });
  };

  const annotationLabel = (field: string): string => {
    const known: Record<string, string> = {
      profile: t("annProfile"),
      cover: t("annCover"),
      avatar: t("annAvatar"),
      packages: t("annPackages"),
      portfolio: t("annPortfolio"),
    };
    return known[field] || field;
  };

  const missedReasonLabel = (reason: string): string => {
    const known: Record<string, string> = {
      language: t("missedLanguage"),
      location: t("missedLocation"),
      outranked: t("missedOutranked"),
      other: t("sourceOther"),
    };
    return known[reason] || reason;
  };

  const chartAnnotations = (data?.annotations || []).reduce<{ date: string; label: string }[]>((accum, a) => {
    const existing = accum.find((x) => x.date === a.date);
    const label = annotationLabel(a.field);
    if (existing) {
      if (!existing.label.includes(label)) existing.label += `, ${label}`;
    } else {
      accum.push({ date: a.date, label });
    }
    return accum;
  }, []);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex rounded-lg border border-warm-200 bg-white p-0.5 text-sm">
          {([30, 90, 180] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                days === d ? "bg-primary-600 text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t("rangeDays", { days: d })}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mt-10 space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-warm-100" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-warm-100" />
        </div>
      )}

      {error && !loading && (
        <div className="mt-10 rounded-2xl border border-primary-200 bg-primary-50 p-6 text-center">
          <p className="font-medium text-primary-800">{t("loadError")}</p>
          <button
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {data && cur && prev && !loading && !error && (
        <>
          {/* KPI tiles */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(
              [
                { label: t("kpiUniqueVisitors"), value: cur.uniqueVisitors, prevValue: prev.uniqueVisitors, hint: t("kpiUniqueVisitorsHint") },
                { label: t("kpiProfileViews"), value: cur.profileViews, prevValue: prev.profileViews, hint: t("kpiProfileViewsHint") },
                { label: t("kpiInquiries"), value: cur.inquiries, prevValue: prev.inquiries, hint: t("kpiInquiriesHint") },
                { label: t("kpiPaidBookings"), value: cur.paidBookings, prevValue: prev.paidBookings, hint: t("kpiPaidBookingsHint") },
              ] as const
            ).map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-warm-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-gray-900">{numFmt.format(kpi.value)}</span>
                  {delta(kpi.value, kpi.prevValue)}
                </div>
                <p className="mt-1 text-[11px] leading-tight text-gray-400">{kpi.hint}</p>
              </div>
            ))}
          </div>

          {/* Profile score + this week's actions */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">{t("scoreTitle")}</h2>
                <p className="mt-1 text-xs text-gray-400">{t("scoreHint")}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14">
                  <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3efe8" strokeWidth="4" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke={data.score.total >= 80 ? "#287651" : data.score.total >= 50 ? "#b59475" : "#c94536"}
                      strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${(data.score.total / data.score.max) * 97.4} 97.4`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">
                    {data.score.total}
                  </span>
                </div>
              </div>
            </div>
            {data.score.actions.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {data.score.actions.map((a, i) => (
                  <a
                    key={a.key}
                    href={a.href}
                    className="group flex items-start gap-2.5 rounded-xl border border-warm-200 bg-warm-50 p-3 transition hover:border-primary-400 hover:bg-primary-50"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm">
                      <span className="font-semibold text-gray-900">{t(`action_${a.key}`)}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{t(`action_${a.key}_why`)}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
            {data.score.actions.length === 0 && (
              <p className="mt-3 text-sm text-accent-600">{t("scoreAllDone")}</p>
            )}
          </div>

          {/* Timeline */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{t("timelineTitle")}</h2>
            {data.meta.cardDataSince === null && (
              <p className="mt-1 text-xs text-gray-400">{t("impressionsCollecting")}</p>
            )}
            <div className="mt-4">
              <TimelineChart
                timeline={data.timeline}
                showImpressions={cur.cardImpressions > 0}
                labels={{ views: t("seriesViews"), impressions: t("seriesImpressions") }}
                locale={locale}
                annotations={chartAnnotations}
              />
              {chartAnnotations.length > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="h-2 w-2 rounded-full bg-warm-400" /> {t("annLegend")}
                </p>
              )}
            </div>
          </div>

          {/* Funnel */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{t("funnelTitle")}</h2>
            <p className="mt-1 text-xs text-gray-400">{t("funnelHint")}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  { label: t("funnelImpressions"), value: cur.cardImpressions + cur.conciergeImpressions + cur.gscImpressions, rate: null as string | null },
                  {
                    label: t("funnelViews"),
                    value: cur.profileViews,
                    rate:
                      cur.cardImpressions + cur.conciergeImpressions + cur.gscImpressions >= MIN_IMPRESSIONS_FOR_RATE
                        ? pct(cur.cardClicks + cur.conciergeClicks + cur.gscClicks, cur.cardImpressions + cur.conciergeImpressions + cur.gscImpressions)
                        : null,
                  },
                  { label: t("funnelBookOpens"), value: cur.bookOpens, rate: cur.uniqueVisitors >= MIN_VIEWS_FOR_RATE && cur.bookOpens > 0 ? pct(cur.bookOpens, cur.uniqueVisitors) : null },
                  { label: t("funnelInquiries"), value: cur.inquiries, rate: cur.uniqueVisitors >= MIN_VIEWS_FOR_RATE ? pct(cur.inquiries, cur.uniqueVisitors) : null },
                  { label: t("funnelPaid"), value: cur.paidBookings, rate: cur.inquiries > 0 ? pct(cur.paidBookings, cur.inquiries) : null },
                ] as const
              ).map((step, i) => (
                <div key={step.label} className="relative rounded-xl bg-warm-50 p-4">
                  <p className="text-xs font-medium text-gray-500">{step.label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{numFmt.format(step.value)}</p>
                  {i > 0 && (
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {step.rate !== null ? t("funnelRate", { rate: step.rate }) : t("funnelLowData")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Response speed & offers */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{t("replyTitle")}</h2>
            <p className="mt-1 text-xs text-gray-400">{t("replyHint")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-warm-50 p-4">
                <p className="text-xs font-medium text-gray-500">{t("replyYours")}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {data.responseStats.inquiries >= 2 && data.responseStats.medianReplyMinutes !== null
                    ? fmtMinutes(data.responseStats.medianReplyMinutes)
                    : fmtMinutes(data.responseStats.lifetimeAvgReplyMinutes)}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {t("replyPlatform", {
                    median: fmtMinutes(data.responseStats.platform.medianReplyMinutes),
                    top: fmtMinutes(data.responseStats.platform.p25ReplyMinutes),
                  })}
                </p>
              </div>
              <div className="rounded-xl bg-warm-50 p-4">
                <p className="text-xs font-medium text-gray-500">{t("offerRate")}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {data.responseStats.inquiries >= 3
                    ? pct(data.responseStats.offered, data.responseStats.inquiries)
                    : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {data.responseStats.inquiries >= 3
                    ? t("offerRateDetail", { offered: data.responseStats.offered, total: data.responseStats.inquiries })
                    : t("funnelLowData")}
                  {" · "}
                  {t("offerRatePlatform", {
                    rate: pct(data.responseStats.platform.offered, data.responseStats.platform.inquiries),
                  })}
                </p>
              </div>
              <div className="rounded-xl bg-primary-50 p-4">
                <p className="text-xs font-medium text-primary-800">{t("offerImpactTitle")}</p>
                {data.responseStats.offerImpact.fast.n >= 10 && data.responseStats.offerImpact.never.n >= 10 ? (
                  <>
                    <p className="mt-1 text-xl font-bold text-primary-800">
                      {t("offerImpactX", {
                        x: (() => {
                          const fastRate = data.responseStats.offerImpact.fast.paid / data.responseStats.offerImpact.fast.n;
                          const neverRate = data.responseStats.offerImpact.never.paid / Math.max(1, data.responseStats.offerImpact.never.n);
                          if (neverRate === 0) return fastRate > 0 ? "∞" : "—";
                          return (fastRate / neverRate).toFixed(1);
                        })(),
                      })}
                    </p>
                    <p className="mt-0.5 text-[11px] text-primary-700">{t("offerImpactDetail")}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-primary-700">{t("offerImpactCollecting")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Channels: where you were shown */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{t("channelsTitle")}</h2>
            <p className="mt-1 text-xs text-gray-400">{t("channelsHint")}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-warm-100 text-left text-xs text-gray-400">
                    <th className="py-2 pr-4 font-medium">{t("channelCol")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("shownCol")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("clickedCol")}</th>
                    <th className="py-2 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { name: t("channelCatalog"), shown: cur.cardImpressions, clicked: cur.cardClicks, since: data.meta.cardDataSince },
                      { name: t("channelConcierge"), shown: cur.conciergeImpressions, clicked: cur.conciergeClicks, since: null },
                      { name: t("channelGoogle"), shown: cur.gscImpressions, clicked: cur.gscClicks, since: data.meta.gscDataSince === null ? data.meta.today : null },
                    ] as const
                  ).map((row) => (
                    <tr key={row.name} className="border-b border-warm-50">
                      <td className="py-2.5 pr-4 text-gray-700">
                        {row.name}
                        {row.shown === 0 && <span className="ml-2 text-[11px] text-gray-400">{t("collectingBadge")}</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-gray-900">{numFmt.format(row.shown)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-gray-900">{numFmt.format(row.clicked)}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">
                        {row.shown >= MIN_IMPRESSIONS_FOR_RATE ? pct(row.clicked, row.shown) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cur.cardImpressions > 0 && Object.keys(data.breakdowns.surfaces).length > 1 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-gray-500">{t("surfacesTitle")}</p>
                <BarList
                  entries={Object.entries(data.breakdowns.surfaces).slice(0, 6)}
                  labelFor={surfaceLabel}
                  emptyText={t("noData")}
                />
              </div>
            )}
          </div>

          {/* Visitors: sources + countries */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{t("sourcesTitle")}</h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">{t("sourcesHint")}</p>
              <BarList
                entries={Object.entries(data.breakdowns.sources).slice(0, 8)}
                labelFor={sourceLabel}
                emptyText={t("noData")}
              />
            </div>
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{t("countriesTitle")}</h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">{t("countriesHint")}</p>
              <BarList
                entries={Object.entries(data.breakdowns.countries).slice(0, 8)}
                labelFor={(code) => (
                  <span>
                    {flagEmoji(code)}{" "}
                    {code === "unknown" ? t("sourceUnknown") : regionNames?.of(code.toUpperCase()) || code}
                  </span>
                )}
                emptyText={t("noData")}
              />
            </div>
          </div>

          {/* New vs returning + devices */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{t("returningTitle")}</h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">{t("returningHint")}</p>
              {cur.uniqueVisitors > 0 ? (
                <>
                  <div className="flex h-5 gap-0.5 overflow-hidden rounded-md">
                    <div className="bg-primary-500" style={{ width: `${(newVisitors / cur.uniqueVisitors) * 100}%` }} />
                    <div className="bg-warm-400" style={{ width: `${(cur.returningVisitors / cur.uniqueVisitors) * 100}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <span className="h-2 w-2 rounded-full bg-primary-500" />
                      {t("newVisitors")}: <b className="tabular-nums">{numFmt.format(newVisitors)}</b>
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <span className="h-2 w-2 rounded-full bg-warm-400" />
                      {t("returningVisitors")}: <b className="tabular-nums">{numFmt.format(cur.returningVisitors)}</b>
                    </span>
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-sm text-gray-400">{t("noData")}</p>
              )}
            </div>
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{t("devicesTitle")}</h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">{t("devicesHint")}</p>
              <BarList
                entries={Object.entries(data.breakdowns.devices).slice(0, 4)}
                labelFor={(k) =>
                  k === "mobile" ? t("deviceMobile") : k === "desktop" ? t("deviceDesktop") : k === "tablet" ? t("deviceTablet") : k
                }
                emptyText={t("noData")}
              />
            </div>
          </div>

          {/* Intent mismatch */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{t("intentTitle")}</h2>
            <p className="mb-4 mt-1 text-xs text-gray-400">{t("intentHint")}</p>
            <IntentCompare
              mine={data.breakdowns.intents}
              platform={data.platformIntents}
              locale={locale}
              labels={{ you: t("intentYou"), platform: t("intentPlatform"), unknown: t("intentUnknown") }}
              emptyText={t("noData")}
            />
          </div>

          {/* Missed concierge matches */}
          {Object.keys(data.missedMatches).length > 0 && (
            <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{t("missedTitle")}</h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">{t("missedHint")}</p>
              <BarList
                entries={Object.entries(data.missedMatches).slice(0, 6)}
                labelFor={missedReasonLabel}
                emptyText={t("noData")}
              />
              {(data.missedMatches.language || 0) > 0 && (
                <a href="/dashboard/profile" className="mt-3 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700">
                  {t("missedLanguageCta")} →
                </a>
              )}
            </div>
          )}

          {/* Benchmarks */}
          {data.benchmarks && data.benchmarks.n >= 5 && (
            <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{t("benchTitle")}</h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">
                {data.benchmarks.pool === "peers" ? t("benchHintPeers", { n: data.benchmarks.n }) : t("benchHintPlatform", { n: data.benchmarks.n })}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { label: t("benchViews"), mine: numFmt.format(cur.profileViews), med: data.benchmarks.medViews !== null ? numFmt.format(data.benchmarks.medViews) : "—" },
                    {
                      label: t("benchConv"),
                      mine: cur.uniqueVisitors >= MIN_VIEWS_FOR_RATE ? pct(cur.inquiries, cur.uniqueVisitors) : "—",
                      med: data.benchmarks.medConvPct !== null ? `${data.benchmarks.medConvPct}%` : "—",
                    },
                    {
                      label: t("benchReply"),
                      mine: fmtMinutes(data.responseStats.lifetimeAvgReplyMinutes),
                      med: fmtMinutes(data.benchmarks.medReplyMinutes),
                    },
                  ] as const
                ).map((row) => (
                  <div key={row.label} className="rounded-xl bg-warm-50 p-4">
                    <p className="text-xs font-medium text-gray-500">{row.label}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{row.mine}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{t("benchMedian", { value: row.med })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top photos */}
          <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{t("photosTitle")}</h2>
            <p className="mb-4 mt-1 text-xs text-gray-400">{t("photosHint")}</p>
            {data.photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {data.photos.map((photo) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-xl bg-warm-100">
                    <img src={photo.thumb} alt={photo.caption || ""} loading="lazy" className="aspect-square w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-semibold text-white">
                      <span>👁 {numFmt.format(photo.opens)}</span>
                      {photo.position !== null && <span className="opacity-75">#{photo.position + 1}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">{t("photosEmpty")}</p>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            {data.meta.dataSince ? t("dataSince", { date: data.meta.dataSince }) : t("noDataYet")}
          </p>
        </>
      )}
    </div>
  );
}
