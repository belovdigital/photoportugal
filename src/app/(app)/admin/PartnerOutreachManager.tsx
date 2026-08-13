"use client";

import { useCallback, useEffect, useState } from "react";

interface Partner {
  id: string;
  company_name: string;
  website: string | null;
  email: string | null;
  contact_name: string | null;
  segment: string;
  region: string | null;
  status: string;
  notes: string | null;
  last_contacted_at: string | null;
  contact_count: number;
  their_link_url: string | null;
  our_link_url: string | null;
  created_at: string;
}

const STATUSES = ["new", "queued", "contacted", "replied", "partner", "declined", "failed"];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  queued: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  replied: "bg-purple-100 text-purple-700",
  partner: "bg-green-100 text-green-700",
  declined: "bg-gray-100 text-gray-400",
  failed: "bg-red-100 text-red-700",
};

const SEGMENTS = ["villa_aggregator", "property_manager", "concierge", "hotel", "other"];

const SEGMENT_LABELS: Record<string, string> = {
  villa_aggregator: "🏝️ Villa aggregator",
  property_manager: "🔑 Property manager",
  concierge: "🛎️ Concierge",
  hotel: "🏨 Hotel / guest house",
  other: "· Other",
};

const PAGE_SIZE = 50;

const EMPTY_FORM = {
  company_name: "",
  website: "",
  email: "",
  contact_name: "",
  segment: "property_manager",
  region: "",
  notes: "",
};

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// Outreach board for accommodation-side link/referral partners.
//
// The daily cron (api/cron/partner-outreach) mails whatever sits in 'queued',
// 50 a day, and writes back last_contacted_at + contact_count. So queueing is
// the only lever here: this board decides who is next, never how fast.
export function PartnerOutreachManager() {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mailableNew, setMailableNew] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [queueCount, setQueueCount] = useState("50");
  const [queueing, setQueueing] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (filter) params.set("status", filter);
    if (appliedSearch) params.set("q", appliedSearch);
    fetch(`/api/admin/partner-outreach?${params}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
        setPartners(d.partners || []);
        setTotal(d.total || 0);
        setCounts(d.counts || {});
        setMailableNew(d.mailable_new || 0);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load partners"));
  }, [page, filter, appliedSearch]);

  useEffect(load, [load]);

  const patch = async (id: string, fields: Partial<Partner>) => {
    setSavingId(id);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/partner-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Update failed (${res.status})`);
      setPartners((prev) => prev?.map((p) => (p.id === id ? { ...p, ...data.partner } : p)) || null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const add = async () => {
    setAdding(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/partner-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not add (${res.status})`);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setAdding(false);
    }
  };

  const queueNext = async () => {
    const n = parseInt(queueCount, 10);
    if (!n || n < 1) {
      setActionError("Enter how many to queue");
      return;
    }
    setQueueing(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/partner-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", count: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not queue (${res.status})`);
      setNotice(
        data.queued === 0
          ? "Nothing left to queue — every 'new' row either has no email or is already queued."
          : `${data.queued} queued. The cron sends 50 a day, oldest first.`
      );
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not queue");
    } finally {
      setQueueing(false);
    }
  };

  const remove = async (p: Partner) => {
    if (!confirm(`Remove ${p.company_name} from the list?`)) return;
    setSavingId(p.id);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/partner-outreach", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSavingId(null);
    }
  };

  if (loadError) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load the partner list: {loadError}
      </p>
    );
  }
  if (partners === null) return <p className="text-sm text-gray-500">Loading partners…</p>;

  const grandTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-warm-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-2xl font-bold text-gray-900">{grandTotal}</span>
          <span className="text-sm text-gray-500">on the list</span>
          <span className="text-sm text-gray-700"><b>{counts.queued || 0}</b> queued to send</span>
          <span className="text-sm text-gray-700"><b>{counts.contacted || 0}</b> mailed</span>
          <span className="text-sm text-gray-700"><b>{counts.replied || 0}</b> replied</span>
          <span className="text-sm text-gray-700"><b>{counts.partner || 0}</b> linking to us</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-warm-200 pt-3">
          <span className="text-sm text-gray-600">
            {mailableNew} untouched with an address — at 50/day that&apos;s {Math.ceil(mailableNew / 50)} days of sending
          </span>
          <input
            type="number"
            min={1}
            value={queueCount}
            onChange={(e) => setQueueCount(e.target.value)}
            className="ml-auto w-20 rounded-lg border border-warm-200 px-2 py-1.5 text-sm"
          />
          <button
            onClick={queueNext}
            disabled={queueing || mailableNew === 0}
            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-700 disabled:opacity-40"
          >
            {queueing ? "Queueing…" : "Queue oldest"}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800"
          >
            {showForm ? "Cancel" : "+ Add company"}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 grid gap-2 border-t border-warm-200 pt-4 sm:grid-cols-2">
            <input
              placeholder="Company name *"
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            />
            <input
              placeholder="Website (https://…)"
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
            <input
              placeholder="Email"
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              placeholder="Contact name"
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
            <select
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={form.segment}
              onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
            >
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
              ))}
            </select>
            <input
              placeholder="Region (Algarve, Comporta, Lisbon…)"
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            />
            <textarea
              rows={2}
              placeholder="Notes — what they run, why they're worth writing to"
              className="rounded-lg border border-warm-200 px-3 py-2 text-sm sm:col-span-2"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <button
              onClick={add}
              disabled={adding || !form.company_name.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-40 sm:col-span-2"
            >
              {adding ? "Adding…" : "Add to list"}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {["", ...STATUSES].map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setFilter(s); setPage(0); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === s ? "bg-gray-900 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
            }`}
          >
            {s === "" ? `All (${grandTotal})` : `${s} (${counts[s] || 0})`}
          </button>
        ))}
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setAppliedSearch(search.trim()); setPage(0); }}
        >
          <input
            placeholder="Search company, email, region…"
            className="w-64 rounded-lg border border-warm-200 px-3 py-1.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="rounded-lg bg-warm-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-warm-200">
            Search
          </button>
        </form>
      </div>

      {shownEmpty(partners, total) && (
        <p className="text-sm text-gray-500">
          {grandTotal === 0 ? "Nobody on the list yet." : "Nothing matches this filter."}
        </p>
      )}

      {partners.map((p) => (
        <div key={p.id} className="rounded-xl border border-warm-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[p.status] || STATUS_COLORS.new}`}>
              {p.status}
            </span>
            <span className="text-xs text-gray-500">{SEGMENT_LABELS[p.segment] || p.segment}</span>
            {p.region && <span className="text-xs text-gray-400">· 📍 {p.region}</span>}
            {p.last_contacted_at ? (
              <span className="text-xs font-semibold text-blue-700">
                ✉ mailed {daysAgo(p.last_contacted_at)}
                {p.contact_count > 1 ? ` · ${p.contact_count}×` : ""}
              </span>
            ) : (
              <span className="text-xs text-gray-400">✉ never mailed</span>
            )}
            <select
              value={p.status}
              disabled={savingId === p.id}
              onChange={(e) => patch(p.id, { status: e.target.value })}
              className="ml-auto rounded-lg border border-warm-200 px-2 py-1 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => remove(p)}
              disabled={savingId === p.id}
              className="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              Delete
            </button>
          </div>

          <p className="mt-3 text-base font-bold text-gray-900">{p.company_name}</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">
                {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {p.email ? (
              <>
                {p.website && " · "}
                <a href={`mailto:${p.email}`} className="text-primary-700 underline">{p.email}</a>
                {p.contact_name && <span className="text-gray-500"> ({p.contact_name})</span>}
              </>
            ) : (
              <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                no email yet — can&apos;t be mailed
              </span>
            )}
          </p>

          {p.their_link_url && (
            <p className="mt-2 text-sm text-green-700">
              🔗 links to us from{" "}
              <a href={p.their_link_url} target="_blank" rel="noopener noreferrer" className="underline">
                {p.their_link_url.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}

          <div className="mt-3 flex items-end gap-2">
            <input
              placeholder="Their page linking to us (fill in when the link goes live)"
              className="flex-1 rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={linkDraft[p.id] ?? p.their_link_url ?? ""}
              onChange={(e) => setLinkDraft((d) => ({ ...d, [p.id]: e.target.value }))}
            />
            <button
              onClick={() => patch(p.id, { their_link_url: linkDraft[p.id] ?? "" })}
              disabled={savingId === p.id || (linkDraft[p.id] ?? p.their_link_url ?? "") === (p.their_link_url ?? "")}
              className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:opacity-40"
            >
              Save link
            </button>
          </div>

          <div className="mt-2 flex items-end gap-2">
            <textarea
              rows={2}
              placeholder="Notes — who answered, what they asked for, when to follow up"
              className="flex-1 rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={notesDraft[p.id] ?? p.notes ?? ""}
              onChange={(e) => setNotesDraft((d) => ({ ...d, [p.id]: e.target.value }))}
            />
            <button
              onClick={() => patch(p.id, { notes: notesDraft[p.id] ?? "" })}
              disabled={savingId === p.id || (notesDraft[p.id] ?? p.notes ?? "") === (p.notes ?? "")}
              className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:opacity-40"
            >
              {savingId === p.id ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      ))}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((n) => Math.max(0, n - 1))}
            disabled={page === 0}
            className="rounded-lg bg-warm-100 px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} of {pages} · {total} rows</span>
          <button
            onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}
            disabled={page >= pages - 1}
            className="rounded-lg bg-warm-100 px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function shownEmpty(partners: Partner[], total: number): boolean {
  return partners.length === 0 && total === 0;
}
