"use client";

import { useState, useMemo } from "react";
import { AdminBanToggle } from "./AdminControls";
import { Avatar } from "@/components/ui/Avatar";

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
}

const PAGE_SIZE = 20;

export function AdminClientsList({ clients }: { clients: AdminClient[] }) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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
                <div className="hidden sm:flex items-center gap-3 shrink-0">
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
                      <div className="mt-1">
                        <AdminBanToggle id={c.id} value={c.is_banned} />
                      </div>
                    </div>
                  </div>
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
    </div>
  );
}
