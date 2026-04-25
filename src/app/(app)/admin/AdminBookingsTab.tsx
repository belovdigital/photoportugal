"use client";

import { useState } from "react";

function codeToFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export interface AdminInquiry {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  photographer_name: string;
  photographer_slug: string;
  created_at: string;
  first_message: string | null;
  message_count: number;
  last_message_at: string | null;
  has_reply: boolean;
  client_country: string | null;
  converted_to_booking_id: string | null;
  archived: boolean;
}

export function AdminInquiriesList({ inquiries: initialInquiries }: { inquiries: AdminInquiry[] }) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unreplied" | "replied" | "converted" | "archived">("all");
  const [archiving, setArchiving] = useState<string | null>(null);

  async function handleArchive(id: string) {
    setArchiving(id);
    const res = await fetch(`/api/admin/bookings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archived: true }),
    });
    if (res.ok) {
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, archived: true } : i));
    }
    setArchiving(null);
  }

  const nonArchived = inquiries.filter(i => !i.archived);
  const filtered = filter === "all" ? nonArchived
    : filter === "unreplied" ? nonArchived.filter((i) => !i.has_reply && !i.converted_to_booking_id)
    : filter === "converted" ? nonArchived.filter((i) => !!i.converted_to_booking_id)
    : filter === "archived" ? inquiries.filter((i) => i.archived)
    : nonArchived.filter((i) => i.has_reply && !i.converted_to_booking_id);

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1">
        {(["all", "unreplied", "replied", "converted", "archived"] as const).map((f) => {
          const count = f === "all" ? nonArchived.length
            : f === "unreplied" ? nonArchived.filter((i) => !i.has_reply && !i.converted_to_booking_id).length
            : f === "converted" ? nonArchived.filter((i) => !!i.converted_to_booking_id).length
            : f === "archived" ? inquiries.filter((i) => i.archived).length
            : nonArchived.filter((i) => i.has_reply && !i.converted_to_booking_id).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${
                filter === f
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-warm-200 text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "all" ? "All" : f === "unreplied" ? "Awaiting Reply" : f === "converted" ? "Converted" : f === "archived" ? "Archived" : "Replied"}
              {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.map((inq) => {
          const isOpen = expandedId === inq.id;
          const age = Math.floor((Date.now() - new Date(inq.created_at).getTime()) / 3600000);
          const ageLabel = age < 1 ? "just now" : age < 24 ? `${age}h ago` : `${Math.floor(age / 24)}d ago`;
          const isConverted = !!inq.converted_to_booking_id;

          return (
            <div
              key={inq.id}
              className={`rounded-xl border transition-shadow relative overflow-hidden ${
                isConverted ? "border-orange-200 bg-gradient-to-r from-orange-50 via-pink-50 to-yellow-50" :
                !inq.has_reply ? "border-amber-200 bg-white" : "border-warm-200 bg-white"
              } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
            >
              {isConverted && (
                <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
                  <img src="/balloons.png" alt="" className="absolute -top-2 left-[5%] h-20 opacity-20 -rotate-12" />
                  <img src="/balloons.png" alt="" className="absolute -top-4 left-[35%] h-24 opacity-15 rotate-6" />
                  <img src="/balloons.png" alt="" className="absolute -top-1 right-[20%] h-20 opacity-20 -rotate-3" />
                  <img src="/balloons.png" alt="" className="absolute -top-6 right-[2%] h-28 opacity-15 rotate-12" />
                </div>
              )}
              <button
                onClick={() => setExpandedId(isOpen ? null : inq.id)}
                className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-left"
              >
                {/* Row 1: status + time */}
                <div className="flex items-center justify-between mb-1">
                  {isConverted ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-orange-400 to-pink-500 text-white">
                      🎉 converted to booking
                    </span>
                  ) : !inq.has_reply ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">
                      awaiting reply
                    </span>
                  ) : (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700">
                      replied
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{ageLabel}</span>
                    <span className="text-[10px] text-gray-300">{inq.message_count} msg{inq.message_count !== 1 ? "s" : ""}</span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Row 2: names */}
                <div className="flex items-center">
                  {inq.client_country && <span className="mr-1" title={inq.client_country}>{codeToFlag(inq.client_country)}</span>}
                  <a
                    href={`/admin#client-${inq.client_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-gray-900 hover:text-primary-600 hover:underline"
                  >
                    {inq.client_name}
                  </a>
                  <span className="mx-1.5 text-gray-300">&rarr;</span>
                  <a
                    href={`/photographers/${inq.photographer_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-gray-600 hover:text-primary-600 hover:underline"
                  >
                    {inq.photographer_name}
                  </a>
                </div>

                {/* Message preview (collapsed) */}
                {!isOpen && inq.first_message && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-1 italic truncate">
                    &ldquo;{inq.first_message.slice(0, 100)}&rdquo;
                  </p>
                )}
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="border-t border-warm-100 px-3 py-3 sm:px-4 sm:py-4">
                  {/* Full message */}
                  {inq.first_message && (
                    <div className="rounded-lg bg-warm-50 p-3 mb-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">Client Message</p>
                      <p className="text-sm text-gray-700 italic leading-relaxed whitespace-pre-wrap">&ldquo;{inq.first_message}&rdquo;</p>
                    </div>
                  )}

                  {/* Converted banner */}
                  {isConverted && (
                    <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-3 flex items-center gap-2">
                      <span className="text-orange-600 text-sm">&#8594;</span>
                      <button
                        onClick={() => {
                          window.history.replaceState(null, "", "#bookings");
                          try { sessionStorage.setItem("admin-tab", "bookings"); } catch {}
                          window.dispatchEvent(new HashChangeEvent("hashchange"));
                        }}
                        className="text-sm font-semibold text-orange-600 hover:text-orange-800 underline decoration-orange-300 hover:decoration-orange-500 transition"
                      >🎉 View booking →</button>
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Client</label>
                      <p className="mt-1 text-sm text-gray-700">{inq.client_email}</p>
                      {inq.client_country && (
                        <p className="text-xs text-gray-500 mt-0.5">{codeToFlag(inq.client_country)} {new Intl.DisplayNames(["en"], { type: "region" }).of(inq.client_country)}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Received</label>
                      <p className="mt-1 text-sm text-gray-700">
                        {new Date(inq.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" "}
                        <span className="text-gray-400">
                          {new Date(inq.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                    </div>
                    {inq.last_message_at && inq.message_count > 1 && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Last Activity</label>
                        <p className="mt-1 text-sm text-gray-700">
                          {new Date(inq.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" "}
                          <span className="text-gray-400">
                            {new Date(inq.last_message_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center border-t border-warm-100 pt-3">
                    {!inq.archived && (
                      <button
                        onClick={() => handleArchive(inq.id)}
                        disabled={archiving === inq.id}
                        className="text-xs text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
                      >
                        {archiving === inq.id ? "Archiving..." : "Archive"}
                      </button>
                    )}
                    {inq.archived && (
                      <span className="text-xs text-gray-400">Archived</span>
                    )}
                    <span className="text-[10px] text-gray-300 ml-auto">ID: {inq.id.slice(0, 8)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-warm-200 bg-white px-4 py-8 text-center text-gray-400">
            {filter !== "all" ? "No inquiries match this filter" : "No inquiries yet"}
          </div>
        )}
      </div>
    </div>
  );
}
