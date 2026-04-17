"use client";

import { useState, useMemo } from "react";
import { AdminBanToggle } from "./AdminControls";
import { Avatar } from "@/components/ui/Avatar";
import { useConfirmModal } from "@/components/ui/ConfirmModal";

function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export interface ClientBooking {
  client_id: string;
  booking_id: string;
  photographer_name: string;
  package_name: string | null;
  location_slug: string | null;
  shoot_date: string | null;
  total_price: number;
  status: string;
  payment_status: string;
  occasion: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
}

export interface AdminClient {
  id: string;
  email: string;
  name: string;
  created_at: string;
  avatar_url: string | null;
  is_banned: boolean;
  phone: string | null;
  booking_count: number;
  total_spent: number;
  last_booking_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  google_id: string | null;
  visitor_sessions: string | null;
}

interface VisitorSession {
  started_at: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_term: string | null;
  device_type: string | null;
  country: string | null;
  language: string | null;
  screen_width: number | null;
  pageviews: { path: string; ts: string; duration_ms?: number | null }[];
  pageview_count: number;
}

function detectSource(s: VisitorSession | null, c: AdminClient): { label: string; color: string } {
  const src = s?.utm_source || c.utm_source;
  const med = s?.utm_medium || c.utm_medium;
  const ref = s?.referrer || "";
  if (src === "google" && med === "cpc") return { label: "Google Ad", color: "bg-blue-50 text-blue-600" };
  if (src === "instagram") return { label: "Instagram Ad", color: "bg-pink-50 text-pink-600" };
  if (src === "facebook") return { label: "Facebook Ad", color: "bg-indigo-50 text-indigo-600" };
  if (src) return { label: `${src}${med ? ` / ${med}` : ""}`, color: "bg-gray-100 text-gray-600" };
  if (/google\./i.test(ref)) return { label: "Google", color: "bg-blue-50 text-blue-600" };
  if (/instagram/i.test(ref)) return { label: "Instagram", color: "bg-pink-50 text-pink-600" };
  if (/facebook|fb\./i.test(ref)) return { label: "Facebook", color: "bg-indigo-50 text-indigo-600" };
  if (/tiktok/i.test(ref)) return { label: "TikTok", color: "bg-gray-100 text-gray-800" };
  if (/tripadvisor/i.test(ref)) return { label: "TripAdvisor", color: "bg-green-50 text-green-600" };
  if (ref && !/photoportugal/i.test(ref)) return { label: new URL(ref).hostname.replace("www.", ""), color: "bg-gray-100 text-gray-600" };
  if (c.google_id) return { label: "Google login", color: "bg-gray-50 text-gray-400" };
  return { label: "Direct", color: "bg-gray-50 text-gray-400" };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function deviceIcon(type: string | null) {
  if (type === "mobile") return "📱";
  if (type === "tablet") return "📱";
  return "💻";
}

const PAGE_SIZE = 50;

export function AdminClientsList({ clients, bookingsByClient }: { clients: AdminClient[]; bookingsByClient: Record<string, ClientBooking[]> }) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const { modal, confirm } = useConfirmModal();

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }, [clients, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name, email, or phone..."
          className="w-full rounded-xl border border-warm-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {pageItems.map((c) => {
          const isOpen = expandedId === c.id;
          const sessions: VisitorSession[] = c.visitor_sessions ? (() => { try { return JSON.parse(c.visitor_sessions); } catch { return []; } })() : [];
          const firstSession = sessions[0] || null;
          const source = detectSource(firstSession, c);
          return (
            <div
              key={c.id}
              className={`rounded-xl border bg-white transition-shadow ${
                c.is_banned ? "border-red-200 bg-red-50/30" : "border-warm-200"
              } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : c.id)}
                className="flex w-full items-center gap-3 px-3 py-3 sm:px-4 text-left"
              >
                <Avatar src={c.avatar_url} fallback={c.name} size="xs" />
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm font-semibold text-gray-900">{c.name}</span>
                  <p className="truncate text-xs text-gray-400">{c.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  {firstSession?.country && <span className="text-sm" title={firstSession.country}>{codeToFlag(firstSession.country)}</span>}
                  {firstSession?.device_type && <span className="text-xs">{deviceIcon(firstSession.device_type)}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${source.color}`}>{source.label}</span>
                  {c.booking_count > 0 && (
                    <span className="text-xs text-gray-500">{c.booking_count} booking{c.booking_count !== 1 ? "s" : ""}</span>
                  )}
                  {c.total_spent > 0 && (
                    <span className="text-xs font-medium text-gray-700">&euro;{c.total_spent}</span>
                  )}
                </div>
                <svg
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-warm-100 px-3 py-3 sm:px-4 sm:py-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Phone</label>
                      <p className="mt-1 text-sm text-gray-700">{c.phone || <span className="text-gray-300">&mdash;</span>}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Bookings</label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{c.booking_count || 0}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Total Spent</label>
                      <p className="mt-1 text-sm text-gray-700">{c.total_spent > 0 ? `€${c.total_spent}` : <span className="text-gray-300">&mdash;</span>}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Joined</label>
                      <p className="mt-1 text-sm text-gray-700">
                        {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Last Booking</label>
                      <p className="mt-1 text-sm text-gray-700">
                        {c.last_booking_at
                          ? new Date(c.last_booking_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : <span className="text-gray-300">&mdash;</span>}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Status</label>
                      <div className="mt-1 flex items-center gap-2">
                        <AdminBanToggle id={c.id} value={c.is_banned} />
                        <button
                          onClick={async () => {
                            const ok = await confirm(
                              "Log in as " + c.name,
                              "You will be redirected to their dashboard in a new tab.",
                              { confirmLabel: "Log in" }
                            );
                            if (!ok) return;
                            const res = await fetch("/api/admin/impersonate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ user_id: c.id }),
                            });
                            if (res.ok) {
                              window.open("/dashboard", "_blank");
                            } else {
                              alert("Failed to impersonate");
                            }
                          }}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
                        >
                          Log in as
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Source</label>
                      <div className="mt-1 flex items-center gap-1.5">
                        {firstSession?.device_type && <span>{deviceIcon(firstSession.device_type)}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${source.color}`}>{source.label}</span>
                        {firstSession?.country && <span className="text-xs text-gray-400">{firstSession.country}</span>}
                      </div>
                    </div>
                  </div>

                  {/* UTM details */}
                  {(c.utm_campaign || c.utm_term || firstSession?.utm_term) && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      {c.utm_campaign && (
                        <div>
                          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Campaign</label>
                          <p className="mt-1 text-sm text-gray-700">{c.utm_campaign}</p>
                        </div>
                      )}
                      {(c.utm_term || firstSession?.utm_term) && (
                        <div>
                          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Keyword</label>
                          <p className="mt-1 text-sm text-gray-700">{c.utm_term || firstSession?.utm_term}</p>
                        </div>
                      )}
                      {firstSession?.referrer && !/photoportugal/i.test(firstSession.referrer) && (
                        <div>
                          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Referrer</label>
                          <p className="mt-1 text-xs text-gray-500 truncate">{firstSession.referrer}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visitor sessions */}
                  {sessions.length > 0 && (
                    <div className="mt-3 border-t border-warm-100 pt-3">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        Journey ({sessions.length} session{sessions.length !== 1 ? "s" : ""})
                      </label>
                      <div className="mt-2 space-y-2">
                        {sessions.map((s, si) => (
                          <div key={si} className="rounded-lg border border-warm-100 bg-warm-50/50 px-3 py-2">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{deviceIcon(s.device_type)}</span>
                              <span>{new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                              <span>·</span>
                              <span>{s.pageview_count} page{s.pageview_count !== 1 ? "s" : ""}</span>
                              {s.utm_source && <span className="rounded bg-blue-50 px-1 text-[10px] text-blue-500">{s.utm_source}</span>}
                              {s.referrer && !/photoportugal/i.test(s.referrer) && (
                                <span className="truncate text-[10px]">from {(() => { try { return new URL(s.referrer).hostname.replace("www.", ""); } catch { return s.referrer; } })()}</span>
                              )}
                            </div>
                            {s.pageviews && s.pageviews.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-gray-500">
                                {s.pageviews.map((pv, pi) => (
                                  <span key={pi} className="flex items-center gap-0.5">
                                    {pi > 0 && <span className="text-gray-300">→</span>}
                                    <span className="rounded bg-white px-1 py-0.5 border border-warm-100">{pv.path.replace(/^\/(en|pt)/, "") || "/"}</span>
                                    {pv.duration_ms && pv.duration_ms > 2000 && (
                                      <span className="text-[10px] text-gray-300">{formatDuration(pv.duration_ms)}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bookings */}
                  {bookingsByClient[c.id] && bookingsByClient[c.id].length > 0 && (
                    <div className="mt-3 border-t border-warm-100 pt-3">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Bookings</label>
                      <div className="mt-2 space-y-2">
                        {bookingsByClient[c.id].map((b) => (
                          <div key={b.booking_id} className="rounded-lg border border-warm-100 bg-warm-50/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-gray-900">{b.photographer_name}</span>
                                {b.package_name && <span className="text-xs text-gray-400"> · {b.package_name}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  b.payment_status === "paid" ? "bg-green-50 text-green-600" :
                                  b.status === "cancelled" ? "bg-red-50 text-red-500" :
                                  "bg-yellow-50 text-yellow-600"
                                }`}>
                                  {b.payment_status === "paid" ? "paid" : b.status}
                                </span>
                                <span className="text-sm font-medium text-gray-700">&euro;{Math.round(Number(b.total_price))}</span>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-gray-400">
                              {b.shoot_date && (
                                <span>{new Date(b.shoot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              )}
                              {b.location_slug && <span className="capitalize">{b.location_slug.replace(/-/g, " ")}</span>}
                              {b.occasion && <span className="capitalize">{b.occasion}</span>}
                              <span>{new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              {b.utm_source && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-500">
                                  {b.utm_source}{b.utm_medium === "cpc" ? " ad" : ""}
                                  {b.utm_term ? ` · "${b.utm_term}"` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-warm-200 bg-white px-4 py-8 text-center text-gray-400">
            {search ? "No clients match your search" : "No clients yet"}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-400">
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-warm-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-warm-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {modal}
    </div>
  );
}
