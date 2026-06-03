"use client";

import { useEffect, useState } from "react";

interface ConciergeMessage {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; data: Record<string, unknown> } | null;
}

interface ConciergeChat {
  id: string;
  visitor_id: string | null;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  outcome: string | null;
  language: string | null;
  source: string | null;
  page_context: string | null;
  utm_source: string | null;
  utm_term: string | null;
  gclid: string | null;
  country: string | null;
  total_tokens: number;
  total_cost_usd: string;
  matched_photographer_ids: string[] | null;
  matched_photographers?: { id: string; slug: string; name: string }[];
  inquiry_booking_ids?: string[] | null;
  archived: boolean;
  messages: ConciergeMessage[];
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  lead_score?: number;
  lead_heat?: "hot" | "warm" | "cold";
}

interface ConciergeStats {
  total_chats: number;
  today_chats: number;
  week_chats: number;
  emails_captured: number;
  handoffs: number;
  matched: number;
  total_cost_usd: string;
  total_tokens: number;
  hot_leads?: number;
  archived_count?: number;
  by_language: { language: string; count: number }[];
  by_source: { source: string; count: number }[];
  top_locations: { slug: string; count: number }[];
  top_photographers: { name: string; slug: string; count: number }[];
  top_spots?: { city: string; slug: string; count: number }[];
  top_chips?: { chip: string; used: number; matched: number }[];
}

type Filter = "all" | "with_email" | "handoff" | "matched" | "hot" | "archived";

// Bucket a chat by created_at into a Finder-style date group. Computed in
// the browser's local timezone so headers match the admin's expectations.
function dateBucket(iso: string): { key: string; label: string; sort: number } {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;
  const t = d.getTime();
  if (t >= startOfToday) return { key: "today", label: "Today", sort: 0 };
  if (t >= startOfYesterday) return { key: "yesterday", label: "Yesterday", sort: 1 };
  if (t >= startOfWeek) return { key: "this_week", label: "Earlier this week", sort: 2 };
  // Older than 7 days — group by month for legibility.
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  // Sort = 100 - age in months so newer months come first within "Earlier".
  const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return { key: `month_${monthKey}`, label: monthLabel, sort: 10 + monthsAgo };
}

const langFlag = (l: string | null) => l === "ru" ? "🇷🇺" : l === "pt" ? "🇵🇹" : l === "de" ? "🇩🇪" : l === "es" ? "🇪🇸" : l === "fr" ? "🇫🇷" : l === "en" ? "🇬🇧" : "🌐";

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function AdminConciergeTab() {
  const [chats, setChats] = useState<ConciergeChat[]>([]);
  const [stats, setStats] = useState<ConciergeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/concierge?filter=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setChats(data.chats || []);
        setStats(data.stats || null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filter]);

  // Optimistically remove (or re-add) the row, then PATCH the server. On
  // failure we refetch to recover the truth — cheap because the list is small.
  async function setArchived(id: string, archived: boolean) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setStats((prev) => prev ? { ...prev, archived_count: (prev.archived_count ?? 0) + (archived ? 1 : -1) } : prev);
    try {
      const res = await fetch(`/api/admin/concierge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error("PATCH failed");
    } catch {
      const r = await fetch(`/api/admin/concierge?filter=${filter}`);
      const data = await r.json();
      setChats(data.chats || []);
      setStats(data.stats || null);
    }
  }

  // Auto-expand if URL hash points to a specific chat
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.location.hash.match(/#concierge-([0-9a-f-]+)/);
    if (m) setExpandedId(m[1]);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Concierge AI</h2>
          <p className="mt-0.5 text-sm text-gray-500">Live chat history, conversion stats, and full transcripts.</p>
        </div>
      </div>

      {/* Recommendation analytics — per-strategy + per-photographer */}
      <RecommendationAnalyticsPanel />

      {/* Stats grid */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Today" value={stats.today_chats} />
          <StatCard label="This week" value={stats.week_chats} />
          <StatCard label="All time" value={stats.total_chats} />
          <StatCard label="Email captured" value={stats.emails_captured} suffix={stats.total_chats > 0 ? `${Math.round(100 * stats.emails_captured / stats.total_chats)}%` : ""} />
          <StatCard label="Handoffs" value={stats.handoffs} accent="amber" />
          <StatCard label="Total cost" value={`$${parseFloat(stats.total_cost_usd || "0").toFixed(2)}`} subline={`${stats.total_tokens.toLocaleString()} tokens`} />
        </div>
      )}

      {/* Top locations / spots / photographers */}
      {stats && (stats.top_locations.length > 0 || stats.top_photographers.length > 0 || (stats.top_spots && stats.top_spots.length > 0)) && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stats.top_locations.length > 0 && (
            <div className="rounded-xl border border-warm-200 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Top suggested locations</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.top_locations.slice(0, 8).map((l) => (
                  <span key={l.slug} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                    {l.slug.replace(/-/g, " ")} <span className="text-primary-400">×{l.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {stats.top_spots && stats.top_spots.length > 0 && (
            <div className="rounded-xl border border-warm-200 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Top suggested spots</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.top_spots.slice(0, 10).map((sp) => (
                  <a
                    key={`${sp.city}/${sp.slug}`}
                    href={`/spots/${sp.city}/${sp.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    {sp.slug.replace(/-/g, " ")} <span className="text-rose-400">·</span> {sp.city} <span className="text-rose-400">×{sp.count}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {stats.top_photographers.length > 0 && (
            <div className="rounded-xl border border-warm-200 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Most matched photographers</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.top_photographers.slice(0, 8).map((p) => (
                  <a key={p.slug} href={`/photographers/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                    {p.name} <span className="text-amber-400">×{p.count}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lens chip conversion — which pre-prompt chips on the homepage /
          location pages actually start chats AND lead to matches. Used
          and matched columns shown side-by-side so dead chips show up
          as low conversion to prune later. */}
      {stats?.top_chips && stats.top_chips.length > 0 && (
        <div className="mb-6 rounded-xl border border-warm-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Top Lens chips (last 90d)</h3>
          <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-warm-200">
            <table className="w-full text-xs">
              <thead className="bg-warm-50">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Chip</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Used</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Matched</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_chips.slice(0, 8).map((c) => {
                  const conv = c.used > 0 ? Math.round((100 * c.matched) / c.used) : 0;
                  return (
                    <tr key={c.chip} className="border-t border-warm-100">
                      <td className="px-3 py-1.5 text-gray-900">{c.chip}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700">{c.used}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700">{c.matched}</td>
                      <td className={`px-3 py-1.5 text-right font-semibold ${conv >= 50 ? "text-emerald-700" : conv >= 25 ? "text-amber-700" : "text-gray-500"}`}>{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {[
          { v: "all", label: "All" },
          { v: "hot", label: stats?.hot_leads ? `🔥 Hot leads (${stats.hot_leads})` : "🔥 Hot leads" },
          { v: "with_email", label: "Captured (email/phone)" },
          { v: "matched", label: "Matched" },
          { v: "handoff", label: "Handoffs" },
          { v: "archived", label: stats?.archived_count ? `🗄️ Archived (${stats.archived_count})` : "🗄️ Archived" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as Filter)}
            className={`rounded-full px-3 py-1.5 font-medium transition ${filter === f.v ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-700 hover:bg-warm-200"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Chat list — grouped Finder-style by date bucket */}
      {loading ? (
        <div className="rounded-xl border border-warm-200 bg-white p-8 text-center text-sm text-gray-500">Loading…</div>
      ) : chats.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-white p-8 text-center text-sm text-gray-500">No chats match this filter.</div>
      ) : (
        <ChatListGrouped
          chats={chats}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
          onArchive={(id, archived) => setArchived(id, archived)}
          isArchivedTab={filter === "archived"}
        />
      )}
    </div>
  );
}

function ChatListGrouped({ chats, expandedId, onToggle, onArchive, isArchivedTab }: {
  chats: ConciergeChat[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  isArchivedTab: boolean;
}) {
  // Server already sorts DESC by created_at, so within each bucket the
  // list stays newest-first naturally.
  const groups = new Map<string, { label: string; sort: number; items: ConciergeChat[] }>();
  for (const c of chats) {
    const b = dateBucket(c.created_at);
    const g = groups.get(b.key);
    if (g) g.items.push(c);
    else groups.set(b.key, { label: b.label, sort: b.sort, items: [c] });
  }
  const ordered = Array.from(groups.values()).sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-5">
      {ordered.map((g) => (
        <div key={g.label}>
          <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            {g.label} <span className="font-normal text-gray-400">· {g.items.length}</span>
          </h3>
          <div className="space-y-2">
            {g.items.map((c) => (
              <ConciergeRow
                key={c.id}
                chat={c}
                expanded={expandedId === c.id}
                onToggle={() => onToggle(c.id)}
                onArchive={() => onArchive(c.id, !isArchivedTab)}
                isArchivedTab={isArchivedTab}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, suffix, subline, accent }: { label: string; value: string | number; suffix?: string; subline?: string; accent?: "amber" | "emerald" }) {
  const accentBg = accent === "amber" ? "from-amber-50 to-white" : accent === "emerald" ? "from-emerald-50 to-white" : "from-primary-50 to-white";
  return (
    <div className={`rounded-xl border border-warm-200 bg-gradient-to-br ${accentBg} p-3`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-gray-900">
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-gray-400">{suffix}</span>}
      </p>
      {subline && <p className="text-[10px] text-gray-400">{subline}</p>}
    </div>
  );
}

function stripSlugHint(s: string): string {
  return (s || "").replace(/\s*\(slug:[a-z0-9-]+\)\s*$/i, "");
}

// The GPT concierge emits `**bold**` and `*italic*` in its replies. The
// public chat widget already parses these; the admin view was rendering
// the raw markdown, so reviewers saw `**Pinhel**` instead of bold. Same
// micro-parser as ConciergeChat — no dependency on a markdown library.
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const re = /(\*\*([^*]+?)\*\*|\*([^*\n]+?)\*)/g;
    let last = 0;
    let key = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      if (m[2] !== undefined) {
        nodes.push(<strong key={`${li}-b${key++}`}>{m[2]}</strong>);
      } else if (m[3] !== undefined) {
        nodes.push(<em key={`${li}-i${key++}`}>{m[3]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) nodes.push(line.slice(last));
    if (li < lines.length - 1) nodes.push(<br key={`br-${li}`} />);
  });
  return nodes;
}

function ConciergeRow({ chat, expanded, onToggle, onArchive, isArchivedTab }: { chat: ConciergeChat; expanded: boolean; onToggle: () => void; onArchive: () => void; isArchivedTab: boolean }) {
  const firstUser = stripSlugHint(chat.messages.find((m) => m.role === "user")?.content || "");
  const preview = firstUser.length > 120 ? firstUser.slice(0, 120) + "…" : firstUser;
  const userMsgCount = chat.messages.filter((m) => m.role === "user").length;
  const matchedCount = (chat.matched_photographer_ids || []).length;
  // Lead score breakdown — built from the same heuristic as the
  // ConciergePhotographer score: email/phone captured, ad source, depth,
  // a real date/timeframe mentioned, recency. Tooltip on the badge so
  // the admin knows what "Hot 80" actually means without diving into code.
  const heatTooltip = `Lead score ${chat.lead_score ?? "?"}/100 — 80+ = hot, 45+ = warm. Built from contact captured, conversation depth, paid traffic, date mentioned, and recency.`;
  const heatBadge = chat.lead_heat === "hot" ? { cls: "bg-red-100 text-red-700", label: `🔥 Hot${chat.lead_score != null ? " · " + chat.lead_score : ""}` }
                    : chat.lead_heat === "warm" ? { cls: "bg-amber-100 text-amber-700", label: `Warm${chat.lead_score != null ? " · " + chat.lead_score : ""}` }
                    : null;

  return (
    <div id={`concierge-${chat.id}`} className={`rounded-xl border ${expanded ? "border-primary-300 shadow-sm" : "border-warm-200"} bg-white transition`}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className="flex w-full cursor-pointer items-start gap-3 p-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm-100 text-base">
          {langFlag(chat.language)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {chat.email ? (
              <span className="truncate text-sm font-semibold text-gray-900">{chat.email}</span>
            ) : chat.phone ? (
              <span className="text-sm font-semibold text-gray-900">📱 {chat.phone}</span>
            ) : chat.user_email ? (
              <span className="truncate text-sm font-semibold text-gray-900">{chat.user_email}</span>
            ) : (
              <span className="font-mono text-xs text-gray-400">{(chat.visitor_id || "").slice(0, 8)}</span>
            )}
            {chat.email && chat.phone && <span className="text-xs text-gray-500">📱 {chat.phone}</span>}
            {chat.first_name && <span className="text-xs text-gray-500">({chat.first_name})</span>}
            {heatBadge && <span title={heatTooltip} className={`cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${heatBadge.cls}`}>{heatBadge.label}</span>}
            {(chat.outcome === "human_handoff") && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Handoff</span>}
            {(chat.outcome === "matched" || chat.outcome === "show_matches") && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Matched</span>}
            {chat.outcome === "exploring_locations" && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">Locations</span>}
            {chat.source && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600">{chat.source}</span>}
            {chat.gclid && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-700">Ads</span>}
            {chat.country && <span className="text-[10px] text-gray-400">{chat.country}</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{preview}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
            <span>{userMsgCount} msgs</span>
            {chat.matched_photographers && chat.matched_photographers.length > 0 ? (
              <span className="flex items-center gap-1">
                <span>·</span>
                {chat.matched_photographers.slice(0, 4).map((p, i) => (
                  <span key={p.id} className="flex items-center">
                    {i > 0 && <span className="mr-1 text-gray-300">,</span>}
                    <a
                      href={`/photographers/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-emerald-700 hover:underline"
                      title={`Open ${p.name}'s profile in a new tab`}
                    >
                      {p.name.split(" ")[0]}
                    </a>
                  </span>
                ))}
              </span>
            ) : matchedCount > 0 ? (
              <span>· {matchedCount} matches</span>
            ) : null}
            {chat.utm_term && <span>· kw: &ldquo;{chat.utm_term}&rdquo;</span>}
            <span>· ${parseFloat(chat.total_cost_usd || "0").toFixed(3)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">{formatRelativeTime(chat.created_at)}</p>
            <p className="mt-0.5 text-[10px] text-gray-300">{new Date(chat.created_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            title={isArchivedTab ? "Restore chat" : "Archive chat"}
            aria-label={isArchivedTab ? "Restore chat" : "Archive chat"}
            className="-mr-1 -mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-gray-300 transition hover:bg-warm-100 hover:text-gray-600"
          >
            {isArchivedTab ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-warm-100 bg-warm-50/40 p-4">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 sm:grid-cols-4">
            {chat.email && <div><span className="font-semibold text-gray-500">Email:</span> {chat.email}</div>}
            {chat.phone && <div><span className="font-semibold text-gray-500">Phone:</span> {chat.phone}</div>}
            {chat.first_name && <div><span className="font-semibold text-gray-500">Name:</span> {chat.first_name}</div>}
            {chat.country && <div><span className="font-semibold text-gray-500">Country:</span> {chat.country}</div>}
            {chat.language && <div><span className="font-semibold text-gray-500">Lang:</span> {chat.language}</div>}
            {chat.source && <div><span className="font-semibold text-gray-500">Source:</span> {chat.source}</div>}
            {chat.utm_source && <div><span className="font-semibold text-gray-500">UTM source:</span> {chat.utm_source}</div>}
            {chat.utm_term && <div><span className="font-semibold text-gray-500">Keyword:</span> &ldquo;{chat.utm_term}&rdquo;</div>}
            {chat.gclid && <div className="font-mono text-[10px]"><span className="font-semibold text-gray-500">gclid:</span> {chat.gclid.slice(0, 16)}…</div>}
            {chat.lead_score != null && <div><span className="font-semibold text-gray-500">Lead score:</span> {chat.lead_score} ({chat.lead_heat})</div>}
          </div>
          {chat.page_context && (
            <p className="rounded-md bg-white px-2 py-1 text-[11px] text-gray-600 ring-1 ring-warm-200"><span className="font-semibold text-gray-500">Page context:</span> {chat.page_context}</p>
          )}

          {chat.matched_photographers && chat.matched_photographers.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Photographers shown</p>
              <div className="flex flex-wrap gap-1.5">
                {chat.matched_photographers.map((p) => (
                  <a key={p.id} href={`/photographers/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                    {p.name} <span className="text-emerald-400">·</span> {p.slug}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[600px] space-y-2 overflow-y-auto rounded-lg border border-warm-200 bg-white p-3">
            {chat.messages.map((m, i) => {
              const matchesData = (m.action?.data as { matches?: { slug: string; reasoning?: string; style_label?: string }[] } | undefined)?.matches;
              const locationsData = (m.action?.data as { locations?: { slug: string }[] } | undefined)?.locations;
              const spotsData = (m.action?.data as { spots?: { city: string; slug: string; name?: string }[] } | undefined)?.spots;
              return (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-900"}`}>
                    <span className="whitespace-pre-wrap">{renderMarkdown(stripSlugHint(m.content))}</span>
                    {matchesData && matchesData.length > 0 && (
                      <div className="mt-1.5 space-y-1 border-t border-white/20 pt-1.5">
                        <p className="text-[10px] font-bold uppercase opacity-70">📸 {matchesData.length} {matchesData.length === 1 ? "match" : "matches"}</p>
                        {matchesData.map((mm, j) => (
                          <div key={j} className="text-[11px] opacity-90">
                            <span className="font-semibold">{mm.slug}</span>
                            {mm.style_label && <span className="opacity-75"> · {mm.style_label}</span>}
                            {mm.reasoning && <p className="opacity-70 italic">&ldquo;{mm.reasoning.slice(0, 220)}&rdquo;</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {locationsData && locationsData.length > 0 && (
                      <p className="mt-1 text-[10px] opacity-80">📍 Suggested locations: {locationsData.map((l) => l.slug).join(", ")}</p>
                    )}
                    {spotsData && spotsData.length > 0 && (
                      <p className="mt-1 text-[10px] opacity-80">📌 Suggested spots: {spotsData.map((sp) => `${sp.city}/${sp.slug}`).join(", ")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible analytics panel above the chats list. Shows three slices:
//   - strategy × traffic_segment funnel
//   - per-photographer impressions/clicks/bookings (top 30 shown)
//   - photographers NEVER shown in last 30d (discovery gap)
// Collapsed by default so it doesn't crowd the Concierge tab on first
// load; expanded on click pulls /api/admin/concierge/recommendation-stats.
function RecommendationAnalyticsPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    byStrategy: { strategy: string; traffic_segment: string | null; shown: number; clicked: number; booked: number; paid: number }[];
    byPhotographer: { photographer_id: string; name: string; slug: string; session_count: number; shown: number; clicked: number; booked: number; last_shown_at: string }[];
    neverShown: { slug: string; name: string; session_count: number; review_count: number }[];
    disagreement: { total_chats: string; disagreed_chats: string; disagreement_pct: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    fetch("/api/admin/concierge/recommendation-stats")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, data]);

  const pct = (num: number, denom: number) => (denom > 0 ? `${Math.round((num / denom) * 100)}%` : "—");

  return (
    <div className="mb-5 rounded-xl border border-warm-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📊</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Recommendation analytics</p>
            <p className="text-xs text-gray-500">Strategy funnel + per-photographer impressions over 30 days</p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-warm-100 p-5 space-y-6">
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {!loading && data && (
            <>
              {data.disagreement && Number(data.disagreement.total_chats) > 0 && (
                <section className="rounded-lg bg-warm-50 px-4 py-3 ring-1 ring-warm-200">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">LLM vs Ranker disagreement (30d)</p>
                  <p className="mt-1 text-sm text-gray-700">
                    LLM picked a different #1 than the ranker in{" "}
                    <strong className="text-gray-900">{data.disagreement.disagreement_pct}%</strong>{" "}
                    of {data.disagreement.total_chats} chats ({data.disagreement.disagreed_chats} cases).
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Some disagreement is expected — the LLM does style/persona matching the ranker can't.
                    A spike (&gt;40%) means the ranker may be missing a signal.
                  </p>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">By strategy × segment (30d)</h3>
                <div className="overflow-x-auto rounded-lg border border-warm-200">
                  <table className="w-full text-sm">
                    <thead className="bg-warm-50">
                      <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                        <th className="px-3 py-2 text-left font-semibold">Strategy</th>
                        <th className="px-3 py-2 text-left font-semibold">Segment</th>
                        <th className="px-3 py-2 text-right font-semibold">Shown</th>
                        <th className="px-3 py-2 text-right font-semibold">CTR</th>
                        <th className="px-3 py-2 text-right font-semibold">Booking%</th>
                        <th className="px-3 py-2 text-right font-semibold">Paid%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100">
                      {data.byStrategy.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.strategy}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{row.traffic_segment || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.shown}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{pct(row.clicked, row.shown)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{pct(row.booked, row.shown)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{pct(row.paid, row.shown)}</td>
                        </tr>
                      ))}
                      {data.byStrategy.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No recommendations logged yet. New events table — fills up as chats happen.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Top photographers by impressions (30d)</h3>
                <div className="overflow-x-auto rounded-lg border border-warm-200">
                  <table className="w-full text-sm">
                    <thead className="bg-warm-50">
                      <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                        <th className="px-3 py-2 text-left font-semibold">Photographer</th>
                        <th className="px-3 py-2 text-right font-semibold">Sessions</th>
                        <th className="px-3 py-2 text-right font-semibold">Shown</th>
                        <th className="px-3 py-2 text-right font-semibold">Clicked</th>
                        <th className="px-3 py-2 text-right font-semibold">Booked</th>
                        <th className="px-3 py-2 text-right font-semibold">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100">
                      {data.byPhotographer.map((row) => (
                        <tr key={row.photographer_id}>
                          <td className="px-3 py-2">
                            <a href={`/photographers/${row.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-primary-600">{row.name}</a>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">{row.session_count}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.shown}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.clicked}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.booked}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{pct(row.clicked, row.shown)}</td>
                        </tr>
                      ))}
                      {data.byPhotographer.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No data yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Never shown in 30d ({data.neverShown.length} photographers)</h3>
                <div className="flex flex-wrap gap-2">
                  {data.neverShown.length === 0 && <p className="text-xs text-gray-400">All approved photographers got at least one impression — discovery debt cleared 🎉</p>}
                  {data.neverShown.map((p) => (
                    <a key={p.slug} href={`/photographers/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100">
                      {p.name} <span className="text-amber-500">·{p.session_count}s</span>
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
