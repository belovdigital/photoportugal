"use client";

import { useEffect, useState } from "react";

interface Inquiry {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  headcount: string | null;
  message: string | null;
  source: string;
  photographer_slug: string | null;
  photographer_name: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  quoted: "bg-blue-100 text-blue-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-gray-100 text-gray-500",
};

const STATUSES = ["new", "in_progress", "quoted", "won", "lost"];

const TYPE_LABELS: Record<string, string> = {
  corporate_event: "🎉 Corporate event",
  conference: "🎤 Conference",
  team_headshots: "👔 Team headshots",
  brand_content: "📸 Brand content",
  real_estate: "🏢 Real estate",
  other: "💼 Other",
};

// Admin pipeline for B2B inquiries. Admins ARE the concierge here — this list
// is the deal board: status + notes per inquiry, contact links for fast reply.
export function BusinessInquiriesManager() {
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/business-inquiries")
      .then((r) => r.json())
      .then((d) => setInquiries(d.inquiries || []))
      .catch(() => setInquiries([]));
  }, []);

  const patch = async (id: string, fields: { status?: string; admin_notes?: string }) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/business-inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "update failed");
      setInquiries((prev) => prev?.map((i) => (i.id === id ? { ...i, ...data.inquiry } : i)) || null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  if (inquiries === null) return <p className="text-sm text-gray-500">Loading business inquiries…</p>;

  const shown = filter === "all" ? inquiries : inquiries.filter((i) => i.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === s ? "bg-gray-900 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
            }`}
          >
            {s === "all" ? `All (${inquiries.length})` : `${s.replace("_", " ")} (${inquiries.filter((i) => i.status === s).length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="text-sm text-gray-500">No inquiries{filter !== "all" ? ` with status "${filter}"` : " yet"}.</p>}

      {shown.map((i) => (
        <div key={i.id} className="rounded-xl border border-warm-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[i.status] || STATUS_COLORS.new}`}>
              {i.status.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400">{new Date(i.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="text-xs text-gray-400">· via {i.source}</span>
            <select
              value={i.status}
              disabled={savingId === i.id}
              onChange={(e) => patch(i.id, { status: e.target.value })}
              className="ml-auto rounded-lg border border-warm-200 px-2 py-1 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          <p className="mt-3 text-base font-bold text-gray-900">{i.company_name}</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {i.contact_name} · <a href={`mailto:${i.email}`} className="text-primary-700 underline">{i.email}</a>
            {i.phone && <> · <a href={`tel:${i.phone}`} className="text-primary-700 underline">{i.phone}</a></>}
          </p>
          <p className="mt-1.5 text-sm text-gray-500">
            {TYPE_LABELS[i.event_type || "other"] || i.event_type}
            {i.event_date && <> · 📅 {i.event_date.slice(0, 10)}</>}
            {i.location && <> · 📍 {i.location}</>}
            {i.headcount && <> · 👥 {i.headcount}</>}
          </p>
          {i.photographer_name && (
            <p className="mt-1 text-sm text-amber-700">
              📷 Asked about:{" "}
              <a href={`/photographers/${i.photographer_slug}`} target="_blank" rel="noopener noreferrer" className="underline">
                {i.photographer_name}
              </a>
            </p>
          )}
          {i.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-warm-50 p-3 text-sm text-gray-700">{i.message}</p>}

          <div className="mt-3 flex items-end gap-2">
            <textarea
              rows={2}
              placeholder="Internal notes (quote sent, follow-up date…)"
              className="flex-1 rounded-lg border border-warm-200 px-3 py-2 text-sm"
              value={notesDraft[i.id] ?? i.admin_notes ?? ""}
              onChange={(e) => setNotesDraft((d) => ({ ...d, [i.id]: e.target.value }))}
            />
            <button
              onClick={() => patch(i.id, { admin_notes: notesDraft[i.id] ?? i.admin_notes ?? "" })}
              disabled={savingId === i.id || (notesDraft[i.id] ?? i.admin_notes ?? "") === (i.admin_notes ?? "")}
              className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:opacity-40"
            >
              {savingId === i.id ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
