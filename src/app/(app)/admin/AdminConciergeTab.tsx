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
  first_name: string | null;
  outcome: string | null;
  language: string | null;
  source: string | null;
  page_context: string | null;
  utm_source: string | null;
  utm_term: string | null;
  country: string | null;
  total_tokens: number;
  total_cost_usd: string;
  matched_photographer_ids: string[] | null;
  archived: boolean;
  messages: ConciergeMessage[];
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
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
  by_language: { language: string; count: number }[];
  by_source: { source: string; count: number }[];
  top_locations: { slug: string; count: number }[];
  top_photographers: { name: string; slug: string; count: number }[];
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
  const [filter, setFilter] = useState<"all" | "with_email" | "handoff" | "matched">("all");
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

      {/* Top locations & photographers */}
      {stats && (stats.top_locations.length > 0 || stats.top_photographers.length > 0) && (
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

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {[
          { v: "all", label: "All" },
          { v: "with_email", label: "Email captured" },
          { v: "matched", label: "Matched" },
          { v: "handoff", label: "Handoffs" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as typeof filter)}
            className={`rounded-full px-3 py-1.5 font-medium transition ${filter === f.v ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-700 hover:bg-warm-200"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Chat list */}
      {loading ? (
        <div className="rounded-xl border border-warm-200 bg-white p-8 text-center text-sm text-gray-500">Loading…</div>
      ) : chats.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-white p-8 text-center text-sm text-gray-500">No chats match this filter.</div>
      ) : (
        <div className="space-y-2">
          {chats.map((c) => (
            <ConciergeRow key={c.id} chat={c} expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)} />
          ))}
        </div>
      )}
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

function ConciergeRow({ chat, expanded, onToggle }: { chat: ConciergeChat; expanded: boolean; onToggle: () => void }) {
  const firstUser = chat.messages.find((m) => m.role === "user")?.content || "";
  const preview = firstUser.length > 120 ? firstUser.slice(0, 120) + "…" : firstUser;
  const userMsgCount = chat.messages.filter((m) => m.role === "user").length;
  const matchedCount = (chat.matched_photographer_ids || []).length;

  return (
    <div id={`concierge-${chat.id}`} className={`rounded-xl border ${expanded ? "border-primary-300 shadow-sm" : "border-warm-200"} bg-white transition`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm-100 text-base">
          {langFlag(chat.language)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {chat.email ? (
              <span className="text-sm font-semibold text-gray-900 truncate">{chat.email}</span>
            ) : chat.user_email ? (
              <span className="text-sm font-semibold text-gray-900 truncate">{chat.user_email}</span>
            ) : (
              <span className="font-mono text-xs text-gray-400">{(chat.visitor_id || "").slice(0, 8)}</span>
            )}
            {chat.first_name && <span className="text-xs text-gray-500">({chat.first_name})</span>}
            {chat.outcome === "human_handoff" && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Handoff</span>}
            {chat.outcome === "show_matches" && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Matched</span>}
            {chat.source && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600">{chat.source}</span>}
            {chat.country && <span className="text-[10px] text-gray-400">{chat.country}</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{preview}</p>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
            <span>{userMsgCount} msgs</span>
            {matchedCount > 0 && <span>· {matchedCount} matches</span>}
            {chat.utm_term && <span>· kw: &ldquo;{chat.utm_term}&rdquo;</span>}
            <span>· ${parseFloat(chat.total_cost_usd || "0").toFixed(3)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-400">{formatRelativeTime(chat.created_at)}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-warm-100 bg-warm-50/40 p-4 space-y-3">
          {chat.page_context && (
            <p className="text-[11px] text-gray-500"><span className="font-semibold">Page:</span> {chat.page_context}</p>
          )}
          {chat.utm_source && (
            <p className="text-[11px] text-gray-500"><span className="font-semibold">UTM:</span> {chat.utm_source}{chat.utm_term ? ` · "${chat.utm_term}"` : ""}</p>
          )}
          <div className="space-y-2 max-h-[600px] overflow-y-auto rounded-lg border border-warm-200 bg-white p-3">
            {chat.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-900"}`}>
                  {m.content}
                  {m.action?.type === "show_matches" && (
                    <p className="mt-1 text-[10px] opacity-80">
                      📸 Showed {((m.action.data as { matches?: unknown[] }).matches || []).length} matches
                    </p>
                  )}
                  {m.action?.type === "show_locations" && (
                    <p className="mt-1 text-[10px] opacity-80">
                      📍 Suggested {((m.action.data as { locations?: unknown[] }).locations || []).length} locations
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
