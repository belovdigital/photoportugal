"use client";

import { useState } from "react";

function codeToFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export interface AdminInquiry {
  id: string;
  client_name: string;
  client_email: string;
  photographer_name: string;
  created_at: string;
  first_message: string | null;
  message_count: number;
  last_message_at: string | null;
  has_reply: boolean;
  client_country: string | null;
  converted_to_booking_id: string | null;
}

export function AdminInquiriesList({ inquiries }: { inquiries: AdminInquiry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unreplied" | "replied" | "converted">("all");

  const filtered = filter === "all" ? inquiries
    : filter === "unreplied" ? inquiries.filter((i) => !i.has_reply && !i.converted_to_booking_id)
    : filter === "converted" ? inquiries.filter((i) => !!i.converted_to_booking_id)
    : inquiries.filter((i) => i.has_reply && !i.converted_to_booking_id);

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1">
        {(["all", "unreplied", "replied", "converted"] as const).map((f) => {
          const count = f === "all" ? inquiries.length
            : f === "unreplied" ? inquiries.filter((i) => !i.has_reply && !i.converted_to_booking_id).length
            : f === "converted" ? inquiries.filter((i) => !!i.converted_to_booking_id).length
            : inquiries.filter((i) => i.has_reply && !i.converted_to_booking_id).length;
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
              {f === "all" ? "All" : f === "unreplied" ? "Awaiting Reply" : f === "converted" ? "Converted" : "Replied"}
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
              className={`rounded-xl border bg-white transition-shadow ${
                isConverted ? "border-blue-200 opacity-70" :
                !inq.has_reply ? "border-amber-200" : "border-warm-200"
              } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : inq.id)}
                className="w-full px-3 py-3 sm:px-4 text-left"
              >
                {/* Row 1: status + time */}
                <div className="flex items-center justify-between mb-1">
                  {isConverted ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">
                      converted to booking
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
                  <span className="text-sm font-semibold text-gray-900">{inq.client_name}</span>
                  <span className="mx-1.5 text-gray-300">&rarr;</span>
                  <span className="text-sm text-gray-600">{inq.photographer_name}</span>
                </div>

                {/* Message preview (collapsed) */}
                {!isOpen && inq.first_message && (
                  <p className="mt-1.5 text-xs text-gray-400 line-clamp-1 italic">
                    &ldquo;{inq.first_message}&rdquo;
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
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-3 flex items-center gap-2">
                      <span className="text-blue-600 text-sm">&#8594;</span>
                      <span className="text-sm text-blue-700">Converted to booking <span className="font-mono text-xs">{inq.converted_to_booking_id!.slice(0, 8)}</span></span>
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
