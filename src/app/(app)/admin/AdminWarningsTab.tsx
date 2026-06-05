"use client";

import { useEffect, useMemo, useState } from "react";
import { IssueWarningModal, type PhotographerOption } from "./IssueWarningModal";

const CATEGORY_LABELS: Record<string, string> = {
  "no-show": "No-show",
  "late-delivery": "Late delivery",
  "unresponsive": "Unresponsive",
  "quality": "Quality",
  "billing": "Billing",
  "conduct": "Conduct",
  "policy": "Policy",
  "safety": "Safety",
  "misrepresentation": "Misrepresentation",
  "other": "Other",
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  info: { bg: "bg-sky-100", text: "text-sky-700", label: "Info" },
  minor: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Minor" },
  major: { bg: "bg-orange-100", text: "text-orange-800", label: "Major" },
  critical: { bg: "bg-red-100", text: "text-red-700", label: "Critical" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-red-50 ring-1 ring-red-200", text: "text-red-700", label: "Active" },
  resolved: { bg: "bg-green-50 ring-1 ring-green-200", text: "text-green-700", label: "Resolved" },
  overturned: { bg: "bg-purple-50 ring-1 ring-purple-200", text: "text-purple-700", label: "Overturned" },
};

interface Warning {
  id: string;
  photographer_id: string;
  photographer_name: string;
  photographer_slug: string;
  category: string;
  severity: string;
  title: string;
  comment: string;
  incident_date: string;
  issued_at: string;
  issued_by_email: string;
  issued_by_name: string | null;
  related_booking_id: string | null;
  reporter_email: string | null;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by_email: string | null;
}

interface Counts {
  open: number;
  critical_open: number;
  last_7d: number;
  resolved_this_month: number;
}

export function AdminWarningsTab({
  photographerRoster,
  initialPhotographerId,
}: {
  photographerRoster: PhotographerOption[];
  initialPhotographerId?: string;
}) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [counts, setCounts] = useState<Counts>({ open: 0, critical_open: 0, last_7d: 0, resolved_this_month: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [photographerFilter, setPhotographerFilter] = useState<string>(initialPhotographerId || "");
  const [search, setSearch] = useState("");

  // UI state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveDraft, setResolveDraft] = useState<Record<string, { status: "resolved" | "overturned"; note: string }>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (statusFilter) sp.set("status", statusFilter);
      if (severityFilter) sp.set("severity", severityFilter);
      if (categoryFilter) sp.set("category", categoryFilter);
      if (photographerFilter) sp.set("photographer_id", photographerFilter);
      if (search.trim()) sp.set("q", search.trim());
      const res = await fetch(`/api/admin/warnings?${sp.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to load warnings");
        setLoading(false);
        return;
      }
      setWarnings(data.warnings || []);
      setCounts(data.counts || { open: 0, critical_open: 0, last_7d: 0, resolved_this_month: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, severityFilter, categoryFilter, photographerFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(refresh, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const photographerName = useMemo(() => {
    const p = photographerRoster.find((x) => x.id === photographerFilter);
    return p ? p.name : "";
  }, [photographerFilter, photographerRoster]);

  async function resolveWarning(w: Warning) {
    const draft = resolveDraft[w.id];
    if (!draft || draft.note.trim().length < 3) return;
    setSubmittingId(w.id);
    try {
      const res = await fetch(`/api/admin/warnings/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          status: draft.status,
          resolution_note: draft.note.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Resolve failed: ${data?.error || res.status}`);
      } else {
        await refresh();
        setExpandedId(null);
      }
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : e}`);
    }
    setSubmittingId(null);
  }

  async function reopenWarning(id: string) {
    if (!confirm("Reopen this warning?")) return;
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/admin/warnings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(`Reopen failed: ${data?.error || res.status}`);
      else await refresh();
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : e}`);
    }
    setSubmittingId(null);
  }

  async function deleteWarning(id: string) {
    if (!confirm("Permanently delete this warning? This cannot be undone.")) return;
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/admin/warnings/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(`Delete failed: ${data?.error || res.status}`);
      else await refresh();
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : e}`);
    }
    setSubmittingId(null);
  }

  return (
    <div className="space-y-4 px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Photographer warnings</h2>
          <p className="text-xs text-gray-500">
            Internal record of incidents (no-show, conduct, late delivery, etc). Not visible to photographers.
          </p>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
        >
          + Issue warning
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile label="Open warnings" value={counts.open} accent="text-amber-700" />
        <KpiTile label="Critical open" value={counts.critical_open} accent={counts.critical_open > 0 ? "text-red-700" : "text-gray-500"} />
        <KpiTile label="Issued (last 7d)" value={counts.last_7d} accent="text-gray-700" />
        <KpiTile label="Resolved this month" value={counts.resolved_this_month} accent="text-green-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warm-200 bg-white px-3 py-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-warm-200 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="overturned">Overturned</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border border-warm-200 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-warm-200 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([slug, label]) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>
        {photographerFilter && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
            {photographerName || "(photographer)"}
            <button
              onClick={() => setPhotographerFilter("")}
              className="text-primary-600 hover:text-primary-800"
              aria-label="Clear photographer filter"
            >
              ×
            </button>
          </span>
        )}
        <input
          type="text"
          placeholder="Search title, comment, photographer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm"
        />
        <button
          onClick={refresh}
          className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm hover:bg-warm-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Cards */}
      {loading && warnings.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-10 text-center text-sm text-gray-500">
          Loading…
        </div>
      ) : warnings.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-10 text-center text-sm text-gray-500">
          No warnings match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {warnings.map((w) => {
            const isOpen = expandedId === w.id;
            const sev = SEVERITY_STYLES[w.severity] || SEVERITY_STYLES.minor;
            const st = STATUS_STYLES[w.status] || STATUS_STYLES.active;
            const draft = resolveDraft[w.id] || { status: "resolved" as const, note: "" };

            return (
              <div
                key={w.id}
                className={`rounded-xl border bg-white transition-shadow ${
                  w.status === "active" && w.severity === "critical" ? "border-red-300" : "border-warm-200"
                } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : w.id)}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.bg} ${sev.text}`}>
                      {sev.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {CATEGORY_LABELS[w.category] || w.category}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-500">
                      {new Date(w.issued_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{w.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {w.photographer_name}{" "}
                    <span className="text-gray-400">· {w.photographer_slug}</span>
                  </p>
                  {!isOpen && <p className="mt-1 line-clamp-1 text-xs text-gray-500">{w.comment}</p>}
                </button>

                {isOpen && (
                  <div className="border-t border-warm-100 px-4 py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Incident date</p>
                        <p className="font-medium text-gray-800">{w.incident_date}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Issued by</p>
                        <p className="font-medium text-gray-800">{w.issued_by_name || w.issued_by_email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Reporter</p>
                        <p className="font-medium text-gray-800">
                          {w.reporter_email || <span className="text-gray-400">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Linked booking</p>
                        <p className="font-medium text-gray-800">
                          {w.related_booking_id ? (
                            <span className="font-mono">{w.related_booking_id.slice(0, 8)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Comment</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-800">{w.comment}</p>
                    </div>

                    {w.resolution_note && (
                      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-green-700 mb-0.5">
                          Resolved {w.resolved_at ? `on ${new Date(w.resolved_at).toLocaleDateString("en-GB")}` : ""}
                          {w.resolved_by_email ? ` by ${w.resolved_by_email}` : ""}
                        </p>
                        <p className="text-sm text-gray-800">{w.resolution_note}</p>
                      </div>
                    )}

                    {w.status === "active" && (
                      <div className="rounded-lg bg-warm-50 border border-warm-200 p-3 space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Resolve / overturn</p>
                        <div className="flex gap-2">
                          {(["resolved", "overturned"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                setResolveDraft({
                                  ...resolveDraft,
                                  [w.id]: { status: s, note: draft.note },
                                })
                              }
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                draft.status === s
                                  ? s === "resolved"
                                    ? "bg-green-600 text-white"
                                    : "bg-purple-600 text-white"
                                  : "bg-white text-gray-600 ring-1 ring-warm-200"
                              }`}
                            >
                              {s === "resolved" ? "Mark resolved" : "Overturn (was wrong)"}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={draft.note}
                          onChange={(e) =>
                            setResolveDraft({
                              ...resolveDraft,
                              [w.id]: { status: draft.status, note: e.target.value },
                            })
                          }
                          placeholder="Resolution note (required)"
                          rows={2}
                          className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => resolveWarning(w)}
                            disabled={draft.note.trim().length < 3 || submittingId === w.id}
                            className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {submittingId === w.id ? "Saving…" : "Confirm"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between text-[11px]">
                      <span className="font-mono text-gray-400">ID: {w.id.slice(0, 8)}</span>
                      <div className="flex gap-3">
                        {w.status !== "active" && (
                          <button
                            onClick={() => reopenWarning(w.id)}
                            className="text-primary-600 hover:underline"
                          >
                            Reopen
                          </button>
                        )}
                        <button
                          onClick={() => deleteWarning(w.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showIssueModal && (
        <IssueWarningModal
          photographers={photographerRoster}
          defaultPhotographerId={photographerFilter}
          onClose={() => setShowIssueModal(false)}
          onIssued={refresh}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-warm-200 bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
