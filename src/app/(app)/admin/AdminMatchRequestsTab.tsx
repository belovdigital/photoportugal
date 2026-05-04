"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLocationDisplayName } from "@/lib/location-hierarchy";
import { useConfirmModal } from "@/components/ui/ConfirmModal";

interface MatchRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location_slug: string;
  shoot_date: string | null;
  date_flexible: boolean;
  flexible_date_from: string | null;
  flexible_date_to: string | null;
  shoot_type: string;
  group_size: number;
  budget_range: string;
  message: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  matched_at: string | null;
  photographers: {
    id: string;
    name: string;
    slug: string;
    avatar_url: string | null;
    rating: number;
    review_count: number;
    min_price: number | null;
    price: number | null;
  }[];
}

interface Photographer {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  locations: string[] | null;
  min_price: number | null;
}

function getLocationName(slug: string): string {
  return getLocationDisplayName(slug);
}

function timeAgo(dateStr: string): string {
  const hours = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 3600000
  );
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShootDate(req: MatchRequest): string {
  if (req.date_flexible) {
    const from = req.flexible_date_from ? formatDate(req.flexible_date_from) : "?";
    const to = req.flexible_date_to ? formatDate(req.flexible_date_to) : "?";
    // If same year, omit year from first date
    if (
      req.flexible_date_from &&
      req.flexible_date_to &&
      new Date(req.flexible_date_from).getFullYear() ===
        new Date(req.flexible_date_to).getFullYear()
    ) {
      const fromShort = new Date(req.flexible_date_from).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" }
      );
      return `Flexible: ${fromShort} – ${to}`;
    }
    return `Flexible: ${from} – ${to}`;
  }
  return req.shoot_date ? formatDate(req.shoot_date) : "No date";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-amber-100 text-amber-700 border border-amber-200",
    matched: "bg-blue-100 text-blue-700 border border-blue-200",
    booked: "bg-green-100 text-green-700 border border-green-200",
    expired: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-500 border border-gray-200"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-800">{value}</p>
    </div>
  );
}

function PhotographerSearchCard({
  photographer,
  selected,
  onToggle,
  disabled,
}: {
  photographer: Photographer;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled && !selected}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
        selected
          ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
          : disabled
            ? "border-warm-100 bg-warm-50 opacity-50 cursor-not-allowed"
            : "border-warm-100 bg-white hover:border-primary-200 hover:bg-warm-50"
      }`}
    >
      {/* Checkbox */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
          selected
            ? "border-primary-600 bg-primary-600"
            : "border-gray-300 bg-white"
        }`}
      >
        {selected && (
          <svg
            className="h-3 w-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>

      {/* Avatar */}
      {photographer.avatar_url ? (
        <img
          src={photographer.avatar_url}
          alt={photographer.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-200 text-sm font-bold text-gray-500">
          {photographer.name.charAt(0)}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">
          {photographer.name}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
          {Number(photographer.rating) > 0 && (
            <span>
              {"★"} {Number(photographer.rating).toFixed(1)}
            </span>
          )}
          {photographer.locations && (
            <span>{photographer.locations.length} locations</span>
          )}
          {photographer.min_price !== null && (
            <span>From €{photographer.min_price}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function PhotographerChip({
  photographer,
  onRemove,
}: {
  photographer: Photographer;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1 text-sm font-medium text-primary-700">
      {photographer.avatar_url ? (
        <img
          src={photographer.avatar_url}
          alt=""
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-200 text-[10px] font-bold text-primary-700">
          {photographer.name.charAt(0)}
        </span>
      )}
      {photographer.name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-primary-400 hover:bg-primary-100 hover:text-primary-600 transition"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function PhotographerSelector({
  requestId,
  selectedIds,
  onSelectionChange,
  photographerPrices,
  onPriceChange,
}: {
  requestId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  photographerPrices: Map<string, number>;
  onPriceChange: (id: string, price: number) => void;
}) {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fetched) return;
    setLoadingList(true);
    fetch("/api/admin/match-request/photographers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPhotographers(data);
        setFetched(true);
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [fetched]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = photographers.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      (p.locations && p.locations.some((l) => l.toLowerCase().includes(q)))
    );
  });

  const selectedPhotographers = photographers.filter((p) =>
    selectedIds.includes(p.id)
  );

  const togglePhotographer = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((sid) => sid !== id));
      } else if (selectedIds.length < 3) {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  return (
    <div ref={containerRef}>
      <p className="text-xs font-medium text-gray-500 mb-2">
        Select Photographers (max 3)
      </p>

      {/* Selected photographers with price inputs */}
      {selectedPhotographers.length > 0 && (
        <div className="space-y-2 mb-3">
          {selectedPhotographers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-2.5">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-200 text-xs font-bold text-primary-700">
                  {p.name.charAt(0)}
                </span>
              )}
              <span className="text-sm font-medium text-gray-900 min-w-0 flex-1 truncate">{p.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">€</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Price"
                  value={photographerPrices.get(p.id) || ""}
                  onChange={(e) => onPriceChange(p.id, parseInt(e.target.value) || 0)}
                  className="w-20 rounded-md border border-warm-200 px-2 py-1 text-sm text-gray-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                />
              </div>
              <button
                type="button"
                onClick={() => togglePhotographer(p.id)}
                className="rounded-full p-1 text-primary-400 hover:bg-primary-100 hover:text-primary-600 transition"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative mb-2">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder="Search photographers..."
          className="w-full rounded-lg border border-warm-200 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
        />
      </div>

      {/* Photographer list — shown on focus */}
      {dropdownOpen && (
        <>
          {loadingList ? (
            <p className="py-4 text-center text-xs text-gray-400">
              Loading photographers...
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-warm-100 p-1.5">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">
                  {search ? "No photographers match your search." : "No photographers found."}
                </p>
              ) : (
                filtered.slice(0, 20).map((p) => (
                  <PhotographerSearchCard
                    key={p.id}
                    photographer={p}
                    selected={selectedIds.includes(p.id)}
                    onToggle={() => togglePhotographer(p.id)}
                    disabled={selectedIds.length >= 3}
                  />
                ))
              )}
              {filtered.length > 20 && (
                <p className="py-2 text-center text-xs text-gray-400">
                  Showing 20 of {filtered.length} results. Refine your search.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AdminMatchRequestsTab({
  requests,
}: {
  requests: MatchRequest[];
}) {
  const router = useRouter();
  const { modal, confirm } = useConfirmModal();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "new" | "matched" | "booked" | "expired"
  >("all");
  const [selectedPhotographers, setSelectedPhotographers] = useState<
    Record<string, string[]>
  >({});
  const [photographerPrices, setPhotographerPrices] = useState<
    Record<string, Map<string, number>>
  >({});
  const [adminComments, setAdminComments] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<Record<string, boolean>>({});
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const sorted = [...filtered].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  function allPricesSet(id: string): boolean {
    const ids = selectedPhotographers[id] || [];
    const prices = photographerPrices[id];
    if (!prices || ids.length === 0) return false;
    return ids.every((pid) => (prices.get(pid) || 0) > 0);
  }

  async function sendMatches(id: string) {
    const ids = selectedPhotographers[id] || [];
    const prices = photographerPrices[id];
    if (ids.length === 0 || ids.length > 3) {
      alert("Please select 1-3 photographers.");
      return;
    }
    if (!allPricesSet(id)) {
      alert("Please set a price for each selected photographer.");
      return;
    }
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const photographer_prices = ids.map((pid) => ({
        id: pid,
        price: prices!.get(pid) || 0,
      }));
      const res = await fetch(`/api/admin/match-request/${id}/send-matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photographer_prices,
          admin_comment: adminComments[id]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to send matches");
        return;
      }
      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  function startEditing(req: MatchRequest) {
    setEditingRequestId(req.id);
    setSelectedPhotographers((prev) => ({
      ...prev,
      [req.id]: req.photographers.map((p) => p.id),
    }));
    const priceMap = new Map<string, number>();
    req.photographers.forEach((p) => {
      if (p.price !== null) priceMap.set(p.id, p.price);
    });
    setPhotographerPrices((prev) => ({ ...prev, [req.id]: priceMap }));
    setAdminComments((prev) => ({ ...prev, [req.id]: req.admin_note || "" }));
    setResendEmail((prev) => ({ ...prev, [req.id]: false }));
  }

  function cancelEditing(id: string) {
    setEditingRequestId(null);
    // Clear selections for this request
    setSelectedPhotographers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPhotographerPrices((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function updateMatches(id: string) {
    const ids = selectedPhotographers[id] || [];
    const prices = photographerPrices[id];
    if (ids.length === 0 || ids.length > 3) {
      alert("Please select 1-3 photographers.");
      return;
    }
    if (!allPricesSet(id)) {
      alert("Please set a price for each selected photographer.");
      return;
    }
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const photographer_prices = ids.map((pid) => ({
        id: pid,
        price: prices!.get(pid) || 0,
      }));
      const res = await fetch(`/api/admin/match-request/${id}/send-matches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photographer_prices,
          admin_comment: adminComments[id]?.trim() || undefined,
          resend_email: resendEmail[id] || false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update matches");
        return;
      }
      setEditingRequestId(null);
      setEditSuccess(id);
      setTimeout(() => setEditSuccess(null), 3000);
      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function updateStatus(id: string, status: "booked" | "expired") {
    const ok = await confirm(
      `Mark as ${status}`,
      `Mark this request as "${status}"?`,
      { confirmLabel: status === "booked" ? "Mark Booked" : "Mark Expired" }
    );
    if (!ok) return;
    setLoading((prev) => ({ ...prev, [`${id}-status`]: true }));
    try {
      const res = await fetch(`/api/admin/match-request/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }
      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setLoading((prev) => ({ ...prev, [`${id}-status`]: false }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "new", "matched", "booked", "expired"] as const).map((f) => {
          const count =
            f === "all"
              ? requests.length
              : requests.filter((r) => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                filter === f
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white border border-warm-200 text-gray-500 hover:text-gray-700 hover:border-warm-300"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {count > 0 && (
                <span className="ml-1.5 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">
          No match requests found.
        </p>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {sorted.map((req) => {
          const isOpen = expandedId === req.id;
          const budgetLabel = !req.budget_range
            ? "—"
            : req.budget_range === "400+"
              ? "€400+"
              : `€${req.budget_range.replace("-", "–")}`;

          return (
            <div
              key={req.id}
              className={`rounded-xl border transition-all duration-200 ${
                req.status === "new"
                  ? "border-amber-200 bg-white"
                  : "border-warm-200 bg-white"
              } ${isOpen ? "shadow-md ring-1 ring-warm-100" : "hover:shadow-sm"}`}
            >
              {/* Card header — clickable */}
              <button
                onClick={() => setExpandedId(isOpen ? null : req.id)}
                className="flex w-full items-start justify-between p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  {/* Top row: name, badge, time */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[15px] font-bold text-gray-900">
                      {req.name}
                    </span>
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-gray-400" suppressHydrationWarning>
                      {timeAgo(req.created_at)}
                    </span>
                  </div>

                  {/* Preview details */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{getLocationName(req.location_slug)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatShootDate(req)}</span>
                    <span className="text-gray-300">|</span>
                    <span>
                      {req.shoot_type
                        ? req.shoot_type.charAt(0).toUpperCase() + req.shoot_type.slice(1)
                        : "Not specified"}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>{budgetLabel}</span>
                  </div>

                  {/* Message preview when collapsed */}
                  {!isOpen && req.message && (
                    <p className="mt-1.5 text-xs italic text-gray-400 line-clamp-1">
                      &ldquo;{req.message}&rdquo;
                    </p>
                  )}
                </div>

                <svg
                  className={`ml-3 mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Expanded section */}
              {isOpen && (
                <div className="border-t border-warm-100 px-4 pb-5 pt-4 space-y-5">
                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                    <DetailItem label="Email" value={req.email} />
                    <DetailItem label="Phone" value={req.phone} />
                    <DetailItem
                      label="Location"
                      value={getLocationName(req.location_slug)}
                    />
                    <DetailItem label="Date" value={formatShootDate(req)} />
                    <DetailItem
                      label="Shoot Type"
                      value={
                        req.shoot_type
                          ? req.shoot_type.charAt(0).toUpperCase() + req.shoot_type.slice(1)
                          : "—"
                      }
                    />
                    <DetailItem
                      label="Group Size"
                      value={`${req.group_size} ${req.group_size === 1 ? "person" : "people"}`}
                    />
                    <DetailItem label="Budget" value={budgetLabel} />
                  </div>

                  {/* Message */}
                  {req.message && (
                    <div className="rounded-lg bg-warm-50 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1">
                        Message
                      </p>
                      <p className="text-sm italic text-gray-700 whitespace-pre-wrap">
                        {req.message}
                      </p>
                    </div>
                  )}

                  {/* Admin note */}
                  {req.admin_note && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-blue-400 mb-1">
                        Admin Note
                      </p>
                      <p className="text-sm text-blue-700 whitespace-pre-wrap">{req.admin_note}</p>
                    </div>
                  )}

                  {/* Photographer selection (new status) */}
                  {req.status === "new" && (
                    <div className="space-y-4">
                      <PhotographerSelector
                        requestId={req.id}
                        selectedIds={selectedPhotographers[req.id] || []}
                        onSelectionChange={(ids) =>
                          setSelectedPhotographers((prev) => ({
                            ...prev,
                            [req.id]: ids,
                          }))
                        }
                        photographerPrices={photographerPrices[req.id] || new Map()}
                        onPriceChange={(pid, price) =>
                          setPhotographerPrices((prev) => {
                            const map = new Map(prev[req.id] || []);
                            map.set(pid, price);
                            return { ...prev, [req.id]: map };
                          })
                        }
                      />

                      {/* Admin comment */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">
                          Personal note for client (optional)
                        </p>
                        <textarea
                          className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200 resize-y"
                          rows={12}
                          placeholder="e.g. We think these photographers are perfect for your sunset session..."
                          value={adminComments[req.id] || ""}
                          onChange={(e) =>
                            setAdminComments((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Send button */}
                      <button
                        onClick={() => sendMatches(req.id)}
                        disabled={
                          loading[req.id] ||
                          !(selectedPhotographers[req.id]?.length > 0) ||
                          !allPricesSet(req.id)
                        }
                        className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                      >
                        {loading[req.id]
                          ? "Sending..."
                          : `Send ${(selectedPhotographers[req.id] || []).length || ""} Match${(selectedPhotographers[req.id]?.length || 0) !== 1 ? "es" : ""}`}
                      </button>
                    </div>
                  )}

                  {/* Show matched photographers (read-only or edit mode) */}
                  {req.status !== "new" && req.photographers.length > 0 && (
                    <div>
                      {/* Success toast */}
                      {editSuccess === req.id && (
                        <div className="mb-3 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium">
                          Matches updated successfully.
                        </div>
                      )}

                      {editingRequestId === req.id ? (
                        /* Edit mode */
                        <div className="space-y-4">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">
                            Edit Matched Photographers
                          </p>
                          <PhotographerSelector
                            requestId={req.id}
                            selectedIds={selectedPhotographers[req.id] || []}
                            onSelectionChange={(ids) =>
                              setSelectedPhotographers((prev) => ({
                                ...prev,
                                [req.id]: ids,
                              }))
                            }
                            photographerPrices={photographerPrices[req.id] || new Map()}
                            onPriceChange={(pid, price) =>
                              setPhotographerPrices((prev) => {
                                const map = new Map(prev[req.id] || []);
                                map.set(pid, price);
                                return { ...prev, [req.id]: map };
                              })
                            }
                          />

                          {/* Admin comment */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">
                              Personal note for client (optional)
                            </p>
                            <textarea
                              className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200 resize-y"
                              rows={12}
                              placeholder="e.g. We think these photographers are perfect for your sunset session..."
                              value={adminComments[req.id] || ""}
                              onChange={(e) =>
                                setAdminComments((prev) => ({
                                  ...prev,
                                  [req.id]: e.target.value,
                                }))
                              }
                            />
                          </div>

                          {/* Resend email checkbox */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={resendEmail[req.id] || false}
                              onChange={(e) =>
                                setResendEmail((prev) => ({
                                  ...prev,
                                  [req.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-600">
                              Resend notification email to client
                            </span>
                          </label>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMatches(req.id)}
                              disabled={
                                loading[req.id] ||
                                !(selectedPhotographers[req.id]?.length > 0) ||
                                !allPricesSet(req.id)
                              }
                              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                              {loading[req.id] ? "Updating..." : "Update Matches"}
                            </button>
                            <button
                              onClick={() => cancelEditing(req.id)}
                              className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Read-only mode */
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              Matched Photographers
                            </p>
                            {req.status === "matched" && (
                              <button
                                onClick={() => startEditing(req)}
                                className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-primary-300 hover:text-primary-600"
                              >
                                Edit Matches
                              </button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {req.photographers.map((p) => (
                              <a
                                key={p.id}
                                href={`/photographers/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-lg border border-warm-100 bg-warm-50 p-3 transition hover:border-primary-200"
                              >
                                {p.avatar_url ? (
                                  <img
                                    src={p.avatar_url}
                                    alt={p.name}
                                    className="h-10 w-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-200 text-sm font-bold text-gray-500">
                                    {p.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {p.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {Number(p.rating) > 0
                                      ? `★ ${Number(p.rating).toFixed(1)}/5`
                                      : "No rating"}
                                    {p.review_count > 0 && ` · ${p.review_count} reviews`}
                                    {p.price !== null
                                      ? ` · €${p.price}`
                                      : p.min_price !== null
                                        ? ` · From €${p.min_price}`
                                        : ""}
                                  </p>
                                </div>
                              </a>
                            ))}
                          </div>
                          {req.matched_at && (
                            <p className="mt-2 text-xs text-gray-400" suppressHydrationWarning>
                              Matched {timeAgo(req.matched_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status actions */}
                  {req.status !== "booked" && req.status !== "expired" && (
                    <div className="flex gap-2 pt-1 border-t border-warm-100">
                      <button
                        onClick={() => updateStatus(req.id, "booked")}
                        disabled={loading[`${req.id}-status`]}
                        className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        Mark as Booked
                      </button>
                      <button
                        onClick={() => updateStatus(req.id, "expired")}
                        disabled={loading[`${req.id}-status`]}
                        className="mt-3 rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-300 disabled:opacity-50"
                      >
                        Mark as Expired
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modal}
    </div>
  );
}
