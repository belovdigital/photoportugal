"use client";

import { useState, useMemo } from "react";
import { AdminBookingActions } from "./AdminControls";

export interface AdminBooking {
  id: string;
  client_name: string;
  photographer_name: string;
  status: string;
  shoot_date: string | null;
  total_price: number | null;
  created_at: string;
  payment_status: string | null;
  message: string | null;
  location_slug: string | null;
  occasion: string | null;
  group_size: number | null;
  shoot_time: string | null;
  package_name: string | null;
  service_fee: number | null;
  payout_amount: number | null;
  flexible_date_from: string | null;
  flexible_date_to: string | null;
  date_note: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  delivered: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  refunded: "bg-red-100 text-red-600",
  pending: "bg-yellow-100 text-yellow-700",
};

const PAGE_SIZE = 20;

export function AdminBookingsList({ bookings }: { bookings: AdminBooking[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = bookings;
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.client_name.toLowerCase().includes(q) || b.photographer_name.toLowerCase().includes(q) || b.id.includes(q)
      );
    }
    return result;
  }, [bookings, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statuses = ["all", ...Array.from(new Set(bookings.map((b) => b.status)))];

  return (
    <div className="space-y-3">
      {/* Search + Filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by client, photographer, or booking ID..."
            className="w-full rounded-xl border border-warm-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-warm-200 text-gray-500 hover:text-gray-700"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {pageItems.map((b) => {
          const isOpen = expandedId === b.id;
          const daysPending = b.status === "pending"
            ? Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000)
            : 0;

          return (
            <div
              key={b.id}
              className={`rounded-xl border bg-white transition-shadow ${
                b.status === "cancelled" ? "border-gray-200 opacity-60" : "border-warm-200"
              } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : b.id)}
                className="flex w-full items-center gap-3 px-3 py-3 sm:px-4 text-left"
              >
                {/* Status badge */}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-500"}`}>
                  {b.status}
                </span>

                {/* Names */}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-gray-900">{b.client_name}</span>
                  <span className="mx-1.5 text-gray-300">&rarr;</span>
                  <span className="text-sm text-gray-600">{b.photographer_name}</span>
                  {daysPending > 1 && (
                    <span className="ml-2 text-[10px] font-medium text-orange-500">{daysPending}d pending</span>
                  )}
                </div>

                {/* Price + date */}
                <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs">
                  {b.total_price && <span className="font-medium text-gray-700">&euro;{Math.round(Number(b.total_price))}</span>}
                  {b.shoot_date && (
                    <span className="text-gray-400">
                      {new Date(b.shoot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
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
                  {/* Client message */}
                  {b.message && (
                    <div className="mb-4 rounded-lg bg-warm-50 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">Client message</p>
                      <p className="text-sm text-gray-700">{b.message}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Payment</label>
                      <div className="mt-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PAYMENT_COLORS[b.payment_status || ""] || "bg-gray-100 text-gray-500"}`}>
                          {b.payment_status || "—"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Shoot Date</label>
                      <p className="mt-1 text-sm text-gray-700">
                        {b.shoot_date
                          ? new Date(b.shoot_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                          : b.flexible_date_from && b.flexible_date_to
                            ? <>
                                <span className="text-xs text-purple-600 font-medium">Flexible: </span>
                                {new Date(b.flexible_date_from).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                {" — "}
                                {new Date(b.flexible_date_to).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </>
                            : <span className="text-gray-300">&mdash;</span>}
                        {b.shoot_time && <span className="ml-1 text-gray-400">at {b.shoot_time}</span>}
                      </p>
                      {b.date_note && <p className="text-[10px] text-gray-400 mt-0.5">{b.date_note}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Price</label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{b.total_price ? `€${Math.round(Number(b.total_price))}` : "—"}</p>
                      {Number(b.service_fee) > 0 || Number(b.payout_amount) > 0 ? (
                        <p className="text-[10px] text-gray-400">Fee: €{Math.round(Number(b.service_fee))} · Payout: €{Math.round(Number(b.payout_amount))}</p>
                      ) : null}
                    </div>
                    {b.package_name && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Package</label>
                        <p className="mt-1 text-sm text-gray-700">{b.package_name}</p>
                      </div>
                    )}
                    {b.location_slug && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Location</label>
                        <p className="mt-1 text-sm text-gray-700">{b.location_slug.replace(/-/g, " ")}</p>
                      </div>
                    )}
                    {b.occasion && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Occasion</label>
                        <p className="mt-1 text-sm text-gray-700">{b.occasion}</p>
                      </div>
                    )}
                    {b.group_size && b.group_size > 0 && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Group Size</label>
                        <p className="mt-1 text-sm text-gray-700">{b.group_size}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Created</label>
                      <p className="mt-1 text-sm text-gray-700">
                        {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 border-t border-warm-100 pt-3">
                    <AdminBookingActions id={b.id} status={b.status} paymentStatus={b.payment_status} />
                    <span className="text-[10px] text-gray-300 ml-auto">ID: {b.id.slice(0, 8)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-warm-200 bg-white px-4 py-8 text-center text-gray-400">
            {search || statusFilter !== "all" ? "No bookings match your filters" : "No bookings yet"}
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
    </div>
  );
}
