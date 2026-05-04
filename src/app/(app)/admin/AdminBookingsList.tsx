"use client";

import React, { useState, useMemo } from "react";
import { AdminBookingActions } from "./AdminControls";
import { AdminPaymentCountdown } from "./AdminPaymentCountdown";

export interface AdminBooking {
  id: string;
  client_id: string;
  client_name: string;
  photographer_name: string;
  photographer_slug: string;
  status: string;
  shoot_date: string | null;
  total_price: number | null;
  created_at: string;
  payment_status: string | null;
  message: string | null;
  location_slug: string | null;
  occasion: string | null;
  group_size: number | null;
  group_size_is_estimate: boolean;
  shoot_time: string | null;
  package_name: string | null;
  package_duration: number | null;
  service_fee: number | null;
  payout_amount: number | null;
  stripe_amount_subtotal_cents: number | null;
  stripe_amount_paid_cents: number | null;
  stripe_amount_discount_cents: number | null;
  stripe_currency: string | null;
  stripe_promo_code: string | null;
  stripe_coupon_name: string | null;
  stripe_coupon_percent_off: number | null;
  flexible_date_from: string | null;
  flexible_date_to: string | null;
  date_note: string | null;
  delivery_accepted: boolean | null;
  delivery_accepted_at: string | null;
  location_detail: string | null;
  client_country: string | null;
  client_phone: string | null;
  client_email: string | null;
  photographer_phone: string | null;
  photographer_email: string | null;
  confirmed_at: string | null;
}

const TIME_LABELS: Record<string, string> = {
  sunrise: "Sunrise",
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  golden_hour: "Golden Hour",
  sunset: "Sunset",
  flexible: "Flexible",
};

function formatStripeAmount(cents: number | null, currency: string | null) {
  if (typeof cents !== "number") return null;
  const symbol = (currency || "eur").toLowerCase() === "eur" ? "€" : `${(currency || "").toUpperCase()} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function codeToFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function formatGroupSize(count: number | null, isEstimate: boolean) {
  if (!count || count <= 1) return null;
  return `${count}${isEstimate ? "+" : ""} people`;
}

const PAGE_SIZE = 50;

export function AdminBookingsList({ bookings }: { bookings: AdminBooking[] }) {
  const [search, setSearch] = useState("");
  // "active" = everything except cancelled and delivery-accepted (the two
  // terminal states). Default so the list isn't cluttered with finalized
  // rows when you're looking at what needs attention. "all" stays
  // available for completeness.
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = bookings;
    if (statusFilter === "active") {
      result = result.filter((b) => b.status !== "cancelled" && !b.delivery_accepted);
    } else if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.client_name.toLowerCase().includes(q) || b.photographer_name.toLowerCase().includes(q) || b.id.includes(q)
      );
    }
    // For the Delivered tab, sort by acceptance date (newest first) so admin
    // can scan recently completed deliveries at the top. Server returns
    // bookings ordered by created_at DESC, which is irrelevant for delivered.
    if (statusFilter === "delivered") {
      result = [...result].sort((a, b) => {
        const aT = a.delivery_accepted_at ? new Date(a.delivery_accepted_at).getTime() : new Date(a.created_at).getTime();
        const bT = b.delivery_accepted_at ? new Date(b.delivery_accepted_at).getTime() : new Date(b.created_at).getTime();
        return bT - aT;
      });
    }
    return result;
  }, [bookings, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusOrder = ["active", "all", "inquiry", "pending", "confirmed", "completed", "delivered", "cancelled"];
  const existingStatuses = new Set(bookings.map((b) => b.status));
  // Always show "active" and "all"; show concrete statuses only when at
  // least one booking has them.
  const statuses = statusOrder.filter((s) => s === "active" || s === "all" || existingStatuses.has(s));
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;

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
          {statuses.map((s) => {
            const label = s === "active"
              ? "Active"
              : s === "all"
                ? `All${cancelledCount > 0 ? ` (incl. cancelled)` : ""}`
                : s === "cancelled"
                  ? `Cancelled${cancelledCount > 0 ? ` (${cancelledCount})` : ""}`
                  : s.charAt(0).toUpperCase() + s.slice(1);
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-primary-600 text-white"
                    : "bg-white border border-warm-200 text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            );
          })}
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
              <div
                onClick={() => setExpandedId(isOpen ? null : b.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(isOpen ? null : b.id); } }}
                className="w-full cursor-pointer px-3 py-3 sm:px-4 text-left"
              >
                {/* Row 1: status left, price right */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    b.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                    b.delivery_accepted ? "bg-green-100 text-green-700" :
                    b.status === "delivered" ? "bg-purple-100 text-purple-700" :
                    b.status === "completed" ? "bg-blue-100 text-blue-700" :
                    b.payment_status === "paid" && b.status === "confirmed" ? "bg-green-100 text-green-700" :
                    b.status === "confirmed" ? "bg-yellow-100 text-yellow-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {b.status === "cancelled" ? "cancelled" :
                     b.delivery_accepted ? "✓ accepted" :
                     b.status === "delivered" ? "awaiting review" :
                     b.status === "completed" ? "awaiting photos" :
                     b.payment_status === "paid" && b.status === "confirmed" ? "paid · awaiting session" :
                     b.status === "confirmed" ? "awaiting payment" :
                     b.status === "pending" ? "awaiting confirmation" :
                     b.status}
                  </span>
                  {b.status === "confirmed" && b.payment_status !== "paid" && (b.confirmed_at || b.created_at) && (
                    <AdminPaymentCountdown confirmedAt={b.confirmed_at || b.created_at} inline />
                  )}
                  <div className="flex items-center gap-2">
                    {b.total_price && <span className="text-base font-bold text-gray-900">&euro;{Math.round(Number(b.total_price))}</span>}
                    <svg
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Row 2: names left, date right */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    {b.client_country && <span className="mr-1" title={b.client_country}>{codeToFlag(b.client_country)}</span>}
                    <a
                      href={`/admin#client-${b.client_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-semibold text-gray-900 hover:text-primary-600 hover:underline"
                    >
                      {b.client_name}
                    </a>
                    <span className="mx-1.5 text-gray-300">&rarr;</span>
                    <a
                      href={`/photographers/${b.photographer_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-gray-600 hover:text-primary-600 hover:underline"
                    >
                      {b.photographer_name}
                    </a>
                    {daysPending > 1 && (
                      <span className="ml-2 text-[10px] font-medium text-orange-500">{daysPending}d pending</span>
                    )}
                  </div>
                  {b.shoot_date && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(b.shoot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-warm-100 px-3 py-3 sm:px-4 sm:py-4">
                  {/* Journey stepper */}
                  {b.status !== "cancelled" && (
                    <AdminBookingJourney status={b.status} paymentStatus={b.payment_status} deliveryAccepted={!!b.delivery_accepted} />
                  )}
                  {b.status === "confirmed" && b.payment_status !== "paid" && (b.confirmed_at || b.created_at) && (
                    <AdminPaymentCountdown confirmedAt={b.confirmed_at || b.created_at} />
                  )}
                  {/* Client message */}
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
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
                      </p>
                      {b.shoot_time && <p className="text-xs text-gray-400">{TIME_LABELS[b.shoot_time] || b.shoot_time}</p>}
                      {b.date_note && <p className="text-[10px] text-gray-400 mt-0.5">{b.date_note}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Price</label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{b.total_price ? `€${Math.round(Number(b.total_price))}` : "—"}</p>
                      {b.stripe_amount_paid_cents !== null && (
                        <p className="text-[10px] font-medium text-green-700">
                          Paid: {formatStripeAmount(b.stripe_amount_paid_cents, b.stripe_currency)}
                        </p>
                      )}
                      {Number(b.stripe_amount_discount_cents) > 0 && (
                        <p className="text-[10px] font-medium text-primary-600">
                          Discount: -{formatStripeAmount(b.stripe_amount_discount_cents, b.stripe_currency)}
                          {b.stripe_promo_code ? ` · ${b.stripe_promo_code}` : ""}
                        </p>
                      )}
                      {Number(b.service_fee) > 0 || Number(b.payout_amount) > 0 ? (
                        <p className="text-[10px] text-gray-400">Fee: €{Math.round(Number(b.service_fee))} · Payout: €{Math.round(Number(b.payout_amount))}</p>
                      ) : null}
                    </div>
                    {b.package_name && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Package</label>
                        <p className="mt-1 text-sm text-gray-700">{b.package_name}</p>
                        {b.package_duration && <p className="text-[10px] text-gray-400">{b.package_duration} min</p>}
                      </div>
                    )}
                    {(b.location_slug || b.location_detail) && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Location</label>
                        {b.location_slug && <p className="mt-1 text-sm text-gray-700 capitalize">{b.location_slug.replace(/-/g, " ")}</p>}
                        {b.location_detail && <p className="text-xs text-gray-500 mt-0.5">{b.location_detail}</p>}
                      </div>
                    )}
                    {b.occasion && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Occasion</label>
                        <p className="mt-1 text-sm text-gray-700 capitalize">{b.occasion}</p>
                      </div>
                    )}
                    {b.group_size && b.group_size > 1 && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Group</label>
                        <p className="mt-1 text-sm text-gray-700">{formatGroupSize(b.group_size, b.group_size_is_estimate)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Created</label>
                      <p className="mt-1 text-sm text-gray-700">
                        {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {b.client_country && (
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Client Country</label>
                        <p className="mt-1 text-sm text-gray-700">{codeToFlag(b.client_country)} {new Intl.DisplayNames(["en"], { type: "region" }).of(b.client_country)}</p>
                      </div>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Client Phone</label>
                      <p className="mt-0.5 text-sm text-gray-700">{b.client_phone ? <a href={`tel:${b.client_phone}`} className="text-primary-600 hover:underline">{b.client_phone}</a> : <span className="text-gray-300">&mdash;</span>}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Client Email</label>
                      <p className="mt-0.5 text-sm text-gray-700 truncate">{b.client_email ? <a href={`mailto:${b.client_email}`} className="text-primary-600 hover:underline">{b.client_email}</a> : <span className="text-gray-300">&mdash;</span>}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Photographer Phone</label>
                      <p className="mt-0.5 text-sm text-gray-700">{b.photographer_phone ? <a href={`tel:${b.photographer_phone}`} className="text-primary-600 hover:underline">{b.photographer_phone}</a> : <span className="text-gray-300">&mdash;</span>}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Photographer Email</label>
                      <p className="mt-0.5 text-sm text-gray-700 truncate">{b.photographer_email ? <a href={`mailto:${b.photographer_email}`} className="text-primary-600 hover:underline">{b.photographer_email}</a> : <span className="text-gray-300">&mdash;</span>}</p>
                    </div>
                  </div>

                  {/* Client message */}
                  {b.message && (
                    <div className="mt-3 rounded-lg bg-warm-50 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">Client Message</p>
                      <p className="text-sm text-gray-700 italic">&ldquo;{b.message}&rdquo;</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex items-center border-t border-warm-100 pt-3">
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
            {search || (statusFilter !== "all" && statusFilter !== "active") ? "No bookings match your filters" : "No bookings yet"}
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

const JOURNEY_STEPS = ["Booked", "Confirmed", "Paid", "Session", "Photos", "Accepted"];
const STATUS_MAP: Record<string, number> = { inquiry: 0, pending: 0, confirmed: 1, completed: 3, delivered: 4 };

function AdminBookingJourney({ status, paymentStatus, deliveryAccepted }: { status: string; paymentStatus: string | null; deliveryAccepted: boolean }) {
  const si = STATUS_MAP[status] ?? -1;
  const done = [
    true, // Booked
    si >= 1, // Confirmed
    paymentStatus === "paid", // Paid
    si >= 3, // Session
    si >= 4 || deliveryAccepted, // Photos
    deliveryAccepted, // Accepted
  ];
  const currentIdx = done.indexOf(false);

  return (
    <div className="flex items-center gap-1 mb-4">
      {JOURNEY_STEPS.map((label, i) => {
        const completed = done[i];
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center" style={{ flex: "0 0 auto" }}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                completed ? "bg-green-500 text-white" : isCurrent ? "bg-accent-500 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {completed ? (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (i + 1)}
              </div>
              <span className={`text-[9px] mt-0.5 ${completed ? "text-green-700" : isCurrent ? "text-accent-700 font-semibold" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < JOURNEY_STEPS.length - 1 && (
              <div className={`flex-1 h-px ${completed ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
