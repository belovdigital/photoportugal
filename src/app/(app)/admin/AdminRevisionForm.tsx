"use client";

import { useState, useEffect, useCallback } from "react";

interface RevisionItem {
  id: string;
  text: string;
  admin_media_url: string | null;
  resolved: boolean;
  photographer_media_url: string | null;
  resolved_at: string | null;
}

interface Revision {
  id: string;
  status: string;
  items: RevisionItem[];
  round: number;
  admin_note: string | null;
  created_at: string;
}

export function AdminRevisionForm({ photographerId, photographerName }: { photographerId: string; photographerName: string }) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [items, setItems] = useState<Array<{ text: string; admin_media_url: string | null; uploading: boolean }>>([
    { text: "", admin_media_url: null, uploading: false },
  ]);

  const fetchRevisions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/revisions?photographer_id=${photographerId}`, { credentials: "include" });
      if (res.ok) setRevisions(await res.json());
    } catch {}
    setLoading(false);
  }, [photographerId]);

  useEffect(() => { fetchRevisions(); }, [fetchRevisions]);

  const addItem = () => setItems(prev => [...prev, { text: "", admin_media_url: null, uploading: false }]);

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemText = (idx: number, text: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, text } : item));
  };

  const uploadMedia = async (idx: number, file: File) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, uploading: true } : item));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/revisions/upload", { method: "POST", body: fd, credentials: "include" });
      if (res.ok) {
        const { url } = await res.json();
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, admin_media_url: url, uploading: false } : item));
      } else {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, uploading: false } : item));
      }
    } catch {
      setItems(prev => prev.map((item, i) => i === idx ? { ...item, uploading: false } : item));
    }
  };

  const submit = async () => {
    const validItems = items.filter(i => i.text.trim());
    if (!validItems.length) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          photographer_id: photographerId,
          items: validItems.map(i => ({
            id: crypto.randomUUID(),
            text: i.text.trim(),
            admin_media_url: i.admin_media_url,
            resolved: false,
            photographer_media_url: null,
            resolved_at: null,
          })),
          admin_note: adminNote.trim() || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setItems([{ text: "", admin_media_url: null, uploading: false }]);
        setAdminNote("");
        fetchRevisions();
      }
    } catch {}
    setSubmitting(false);
  };

  const approve = async (revisionId: string) => {
    if (!confirm(`Approve ${photographerName}? Their profile will go live.`)) return;
    try {
      const res = await fetch("/api/admin/revisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ revision_id: revisionId, action: "approve" }),
      });
      if (res.ok) fetchRevisions();
    } catch {}
  };

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading revisions...</div>;

  const activeRevision = revisions.find(r => r.status === "pending" || r.status === "submitted");

  return (
    <div className="mt-3 border-t border-warm-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Revisions</h4>
        {!showForm && !activeRevision && (
          <button onClick={() => setShowForm(true)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            + Request Revisions
          </button>
        )}
      </div>

      {/* Active revision display */}
      {activeRevision && !showForm && (
        <div className={`rounded-lg border p-3 text-sm ${
          activeRevision.status === "submitted" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase ${
              activeRevision.status === "submitted" ? "text-blue-600" : "text-amber-600"
            }`}>
              {activeRevision.status === "submitted" ? "Fixes Submitted — Review" : `Round ${activeRevision.round} — Pending`}
            </span>
            <span className="text-[10px] text-gray-400">
              {activeRevision.items.filter(i => i.resolved).length}/{activeRevision.items.length} resolved
            </span>
          </div>

          {activeRevision.admin_note && (
            <p className="text-xs text-gray-500 italic mb-2">"{activeRevision.admin_note}"</p>
          )}

          <div className="space-y-2">
            {activeRevision.items.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] shrink-0 ${
                  item.resolved ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {item.resolved ? "✓" : idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${item.resolved ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {item.text}
                  </p>
                  {item.admin_media_url && (
                    <img src={item.admin_media_url} alt="" className="mt-1 h-16 w-auto rounded border object-cover cursor-pointer" onClick={() => window.open(item.admin_media_url!, "_blank")} />
                  )}
                  {item.photographer_media_url && (
                    <div className="mt-1">
                      <span className="text-[10px] text-blue-500 font-medium">Proof:</span>
                      <img src={item.photographer_media_url} alt="" className="mt-0.5 h-16 w-auto rounded border object-cover cursor-pointer" onClick={() => window.open(item.photographer_media_url!, "_blank")} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {activeRevision.status === "submitted" && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-blue-200">
              <button onClick={() => approve(activeRevision.id)} className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
                Approve
              </button>
              <button onClick={() => setShowForm(true)} className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600">
                Add More Revisions
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create revision form */}
      {showForm && (
        <div className="rounded-lg border border-warm-200 bg-white p-3">
          <div className="space-y-2 mb-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.text}
                    onChange={e => updateItemText(idx, e.target.value)}
                    placeholder={`Revision item ${idx + 1}...`}
                    className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                  />
                  {item.admin_media_url && (
                    <img src={item.admin_media_url} alt="" className="mt-1 h-12 w-auto rounded border object-cover" />
                  )}
                </div>
                <label className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border cursor-pointer transition ${
                  item.uploading ? "bg-gray-100 border-gray-300" : item.admin_media_url ? "bg-primary-50 border-primary-200" : "bg-white border-warm-200 hover:border-primary-300"
                }`}>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadMedia(idx, e.target.files[0])} disabled={item.uploading} />
                  {item.uploading ? (
                    <span className="text-xs text-gray-400">...</span>
                  ) : (
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </label>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button onClick={addItem} className="text-xs text-primary-600 font-medium hover:text-primary-700 mb-3">
            + Add another item
          </button>

          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            placeholder="Optional note for the photographer..."
            rows={2}
            className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm outline-none focus:border-primary-400 mb-3"
          />

          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting || !items.some(i => i.text.trim())} className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {submitting ? "Sending..." : "Send Revisions"}
            </button>
            <button onClick={() => { setShowForm(false); setItems([{ text: "", admin_media_url: null, uploading: false }]); setAdminNote(""); }} className="rounded-lg border border-warm-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-warm-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {revisions.filter(r => r.status === "approved").length > 0 && (
        <details className="mt-2">
          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-500">
            Past revisions ({revisions.filter(r => r.status === "approved").length})
          </summary>
          <div className="mt-1 space-y-1">
            {revisions.filter(r => r.status === "approved").map(r => (
              <div key={r.id} className="text-[10px] text-gray-400">
                Round {r.round} — {r.items.length} items — approved {new Date(r.created_at).toLocaleDateString()}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
