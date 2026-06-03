"use client";

import { useEffect, useMemo, useState } from "react";

interface UnmatchedBooking {
  id: string;
  created_at: string;
  auto_refund_at: string | null;
  location_slug: string | null;
  shoot_date: string | null;
  occasion: string | null;
  group_size: number | null;
  total_price: number | null;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  message: string | null;
  admin_notes: string | null;
  client_id: string;
  client_email: string;
  client_name: string;
  client_phone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
}

interface AdminPhotographer {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  plan: string;
  last_seen_at: string | null;
  locations: string[];
}

function age(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.floor(ms / 60_000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function refundCountdown(iso: string | null): { label: string; color: string } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "refund pending", color: "bg-red-100 text-red-700" };
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return { label: `<1h to auto-refund`, color: "bg-red-100 text-red-700" };
  if (h < 6) return { label: `${h}h to auto-refund`, color: "bg-red-100 text-red-700" };
  return { label: `${h}h to auto-refund`, color: "bg-amber-100 text-amber-700" };
}

export function AdminUnmatchedBookingsTab() {
  const [bookings, setBookings] = useState<UnmatchedBooking[]>([]);
  const [photographers, setPhotographers] = useState<AdminPhotographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [selectedPhotographer, setSelectedPhotographer] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/unmatched-bookings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to load");
        setLoading(false);
        return;
      }
      setBookings(data.bookings || []);
      setPhotographers(data.photographers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) if (b.location_slug) set.add(b.location_slug);
    return Array.from(set).sort();
  }, [bookings]);

  const filtered = useMemo(() => {
    if (!regionFilter) return bookings;
    return bookings.filter((b) => b.location_slug === regionFilter);
  }, [bookings, regionFilter]);

  function photographersForBooking(b: UnmatchedBooking): AdminPhotographer[] {
    if (!b.location_slug) return photographers;
    const region = b.location_slug;
    return photographers.filter((p) =>
      p.locations.length === 0 ? false : p.locations.includes(region) || matchesRegion(p.locations, region)
    );
  }

  async function assign(b: UnmatchedBooking) {
    const photographerId = selectedPhotographer[b.id];
    if (!photographerId) return;
    setSubmittingId(b.id);
    try {
      const res = await fetch("/api/admin/unmatched-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: b.id,
          photographer_id: photographerId,
          admin_notes: notesDraft[b.id] || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Assign failed: ${data?.error || res.status}`);
        setSubmittingId(null);
        return;
      }
      await refresh();
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : e}`);
    }
    setSubmittingId(null);
  }

  if (loading && bookings.length === 0) {
    return <div className="px-6 py-10 text-sm text-gray-500">Loading unmatched bookings…</div>;
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Unmatched bookings</h2>
          <p className="text-xs text-gray-500">
            Blind bookings authorised via Concierge — assign a photographer to capture payment and confirm. Auto-refunds at 24h.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All regions ({bookings.length})</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r} ({bookings.filter((b) => b.location_slug === r).length})
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm hover:bg-warm-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-10 text-center text-sm text-gray-500">
          No unmatched bookings. Concierge blind offers will land here.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const refund = refundCountdown(b.auto_refund_at);
            const pgs = photographersForBooking(b);
            return (
              <div key={b.id} className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      {b.location_slug || "no-region"} · {b.occasion || "no-occasion"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      {age(b.created_at)} old
                    </span>
                    {refund && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${refund.color}`}>
                        ⏳ {refund.label}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        b.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {b.payment_status === "paid" ? "auth-held" : b.payment_status || "unpaid"}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900">
                    {b.total_price ? `€${Math.round(Number(b.total_price))}` : "—"}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Shoot date</p>
                    <p className="font-medium text-gray-800">{b.shoot_date || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Party</p>
                    <p className="font-medium text-gray-800">{b.group_size || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Client</p>
                    <p className="truncate font-medium text-gray-800">{b.client_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Phone</p>
                    <p className="font-medium text-gray-800">
                      {b.client_phone ? (
                        <a
                          className="text-primary-600 hover:underline"
                          href={`https://wa.me/${b.client_phone.replace(/\D/g, "")}`}
                        >
                          {b.client_phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                </div>

                {b.message && (
                  <p className="mt-2 text-xs text-gray-500 italic">&ldquo;{b.message}&rdquo;</p>
                )}

                <textarea
                  value={notesDraft[b.id] ?? b.admin_notes ?? ""}
                  onChange={(e) => setNotesDraft({ ...notesDraft, [b.id]: e.target.value })}
                  placeholder="Admin notes — who you've contacted on WhatsApp, what they said…"
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedPhotographer[b.id] || ""}
                    onChange={(e) => setSelectedPhotographer({ ...selectedPhotographer, [b.id]: e.target.value })}
                    className="flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">
                      Assign to… ({pgs.length} match
                      {pgs.length === 1 ? "" : "es"} in {b.location_slug || "any region"})
                    </option>
                    {pgs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.plan} {p.last_seen_at ? `· last seen ${age(p.last_seen_at)} ago` : ""}
                      </option>
                    ))}
                    <option disabled>───── all approved ─────</option>
                    {photographers
                      .filter((p) => !pgs.some((q) => q.id === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.plan}
                          {p.locations.length ? ` · ${p.locations.slice(0, 3).join(", ")}` : ""}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => assign(b)}
                    disabled={!selectedPhotographer[b.id] || submittingId === b.id}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {submittingId === b.id ? "Assigning…" : "Assign & capture"}
                  </button>
                </div>

                <p className="mt-2 text-[10px] text-gray-400">
                  ID: <span className="font-mono">{b.id.slice(0, 8)}</span> · UTM:{" "}
                  {b.utm_source ? `${b.utm_source}/${b.utm_medium || "—"}` : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Region overlap heuristic — if the booking's location_slug is a
// region-level slug (e.g. "greater-lisbon") and a photographer lists a
// city in that region (e.g. "lisbon"), they should still appear in the
// shortlist. We don't import the full mapping here to avoid bloat;
// just check common region prefixes.
function matchesRegion(photographerLocations: string[], bookingSlug: string): boolean {
  const REGION_CHILDREN: Record<string, string[]> = {
    "greater-lisbon": ["lisbon", "sintra", "cascais", "caparica", "ericeira", "almada", "setubal", "comporta", "sesimbra", "arrabida"],
    "northern-portugal": ["porto", "braga", "guimaraes", "douro-valley", "douro", "aveiro"],
    "central-portugal": ["coimbra", "nazare", "obidos", "tomar", "peniche"],
    "alentejo": ["evora", "alentejo"],
    "algarve": ["algarve", "lagos", "tavira", "portimao", "albufeira", "faro", "vilamoura"],
    "madeira": ["madeira", "funchal"],
    "azores": ["azores", "ponta-delgada", "sao-miguel"],
  };
  const children = REGION_CHILDREN[bookingSlug] || [];
  return photographerLocations.some((l) => children.includes(l));
}
