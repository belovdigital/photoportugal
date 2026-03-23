"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  text: string | null;
  video_url: string | null;
  created_at: string;
  client_name: string;
  photographer_name: string;
  photographer_slug: string;
  photographer_id?: string;
  is_approved: boolean;
}

export function ReviewsManager({ initialReviews, photographers }: { initialReviews: Review[]; photographers: { id: string; name: string }[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterPhotographer, setFilterPhotographer] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  // Add review form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhotographerId, setNewPhotographerId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  function handleAdminPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const combined = [...newPhotos, ...files.filter(f => f.type.startsWith("image/"))].slice(0, 5);
    setNewPhotos(combined);
    setNewPhotoPreviews(combined.map(f => URL.createObjectURL(f)));
    e.target.value = "";
  }

  async function handleAddReview() {
    if (!newPhotographerId || !newClientName.trim() || !newRating) return;
    setAdding(true);
    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photographer_id: newPhotographerId,
        client_name: newClientName.trim(),
        rating: newRating,
        title: newTitle.trim() || null,
        text: newText.trim() || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      // Upload photos
      if (newPhotos.length > 0 && data.id) {
        for (const photo of newPhotos) {
          const formData = new FormData();
          formData.append("file", photo);
          formData.append("review_id", data.id);
          await fetch("/api/reviews/photos", { method: "POST", body: formData }).catch(() => {});
        }
      }
      const photographer = photographers.find(p => p.id === newPhotographerId);
      setReviews(prev => [{
        id: data.id || crypto.randomUUID(),
        rating: newRating,
        title: newTitle.trim() || null,
        text: newText.trim() || null,
        video_url: null,
        created_at: new Date().toISOString(),
        client_name: newClientName.trim(),
        photographer_name: photographer?.name || "",
        photographer_slug: "",
        is_approved: true,
      }, ...prev]);
      setShowAddForm(false);
      setNewPhotographerId("");
      setNewClientName("");
      setNewRating(5);
      setNewTitle("");
      setNewText("");
      setNewPhotos([]);
      setNewPhotoPreviews([]);
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to add review");
    }
    setAdding(false);
  }

  // Listen for filter event from photographer table
  useEffect(() => {
    function handleFilter(e: CustomEvent) {
      setFilterPhotographer(e.detail.photographerId || "");
    }
    window.addEventListener("admin-filter-reviews", handleFilter as EventListener);
    return () => window.removeEventListener("admin-filter-reviews", handleFilter as EventListener);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this review?")) return;
    setDeleting(id);
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (res.ok) setReviews((prev) => prev.filter((r) => r.id !== id));
    setDeleting(null);
  }

  async function handleApprove(id: string, approve: boolean) {
    const res = await fetch(`/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: approve }),
    });
    if (res.ok) setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, is_approved: approve } : r)));
  }

  function startEdit(r: Review) {
    setEditingId(r.id);
    setEditRating(r.rating);
    setEditTitle(r.title || "");
    setEditText(r.text || "");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/reviews/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: editRating, title: editTitle, text: editText }),
    });
    if (res.ok) {
      setReviews((prev) => prev.map((r) => (r.id === editingId ? { ...r, rating: editRating, title: editTitle || null, text: editText || null } : r)));
      setEditingId(null);
    }
    setSaving(false);
  }

  const [showPending, setShowPending] = useState(false);
  const pendingCount = reviews.filter((r) => !r.is_approved).length;
  const photographerNames = [...new Set(reviews.map((r) => r.photographer_name))].sort();
  const filtered = reviews
    .filter((r) => !filterPhotographer || r.photographer_name === filterPhotographer || r.photographer_id === filterPhotographer)
    .filter((r) => !showPending || !r.is_approved);

  return (
    <div>
      {/* Add Review button + form */}
      <div className="mb-4">
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            + Add Review Manually
          </button>
        ) : (
          <div className="rounded-xl border border-warm-200 bg-white p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Add Review</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Photographer</label>
                <select value={newPhotographerId} onChange={e => setNewPhotographerId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none">
                  <option value="">Select photographer...</option>
                  {photographers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Client Name</label>
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="John Smith" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setNewRating(s)} className={`h-6 w-6 ${s <= newRating ? "text-yellow-400" : "text-gray-200"}`}>
                    <svg fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title (optional)</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Great experience!" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Review text (optional)</label>
              <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Write the review..." rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Photos (optional, max 5)</label>
              {newPhotoPreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {newPhotoPreviews.map((src, i) => (
                    <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border border-gray-200">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => { setNewPhotos(p => p.filter((_, j) => j !== i)); setNewPhotoPreviews(p => p.filter((_, j) => j !== i)); }} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              )}
              {newPhotos.length < 5 && (
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-primary-400">
                  + Add photos
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleAdminPhotoSelect} />
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddReview} disabled={adding || !newPhotographerId || !newClientName.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {adding ? "Adding..." : "Add Review"}
              </button>
              <button onClick={() => setShowAddForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {reviews.length === 0 && !showAddForm ? (
        <p className="text-sm text-gray-400">No reviews yet.</p>
      ) : reviews.length > 0 ? (
        <>
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={filterPhotographer}
              onChange={(e) => setFilterPhotographer(e.target.value)}
              className="rounded-lg border border-warm-200 px-3 py-1.5 text-sm outline-none focus:border-primary-400"
            >
              <option value="">All photographers ({reviews.length})</option>
              {photographerNames.map((name) => (
                <option key={name} value={name}>{name} ({reviews.filter((r) => r.photographer_name === name).length})</option>
              ))}
            </select>
            {pendingCount > 0 && (
              <button
                onClick={() => setShowPending(!showPending)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${showPending ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"}`}
              >
                Pending ({pendingCount})
              </button>
            )}
            {(filterPhotographer || showPending) && (
              <button onClick={() => { setFilterPhotographer(""); setShowPending(false); }} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
          <table className="w-full min-w-[500px] text-xs sm:text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-500">Photographer</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-500">Rating</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-500">Review</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Date</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {filtered.map((r) => (
                <tr key={r.id} className={!r.is_approved ? "bg-yellow-50/50" : ""}>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <p className="font-medium text-gray-900">{r.client_name}</p>
                    {!r.is_approved && <span className="mt-0.5 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">Pending</span>}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <Link href={`/photographers/${r.photographer_slug}`} className="text-primary-600 hover:underline" target="_blank">
                      {r.photographer_name}
                    </Link>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 max-w-xs">
                    {editingId === r.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map((s) => (
                            <button key={s} onClick={() => setEditRating(s)} className={`h-5 w-5 ${s <= editRating ? "text-yellow-400" : "text-gray-200"}`}>
                              <svg fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            </button>
                          ))}
                        </div>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" className="w-full rounded border px-2 py-1 text-xs" />
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="Review text" rows={2} className="w-full rounded border px-2 py-1 text-xs" />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={saving} className="rounded bg-primary-600 px-2 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {r.video_url && (
                          <div className="mb-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              Video
                            </span>
                            <video src={r.video_url} controls preload="metadata" className="mt-1 w-full max-w-[200px] rounded-lg border border-gray-200" />
                          </div>
                        )}
                        {r.title && <p className="font-medium text-gray-900 truncate">{r.title}</p>}
                        {r.text && <p className="text-gray-500 truncate text-xs">{r.text}</p>}
                        {!r.title && !r.text && !r.video_url && <span className="text-gray-300">No text</span>}
                      </>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex flex-col items-end gap-1">
                      {!r.is_approved ? (
                        <button onClick={() => handleApprove(r.id, true)} className="rounded bg-green-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-600">Approve</button>
                      ) : (
                        <button onClick={() => handleApprove(r.id, false)} className="text-[10px] text-gray-400 hover:text-yellow-600">Unpublish</button>
                      )}
                      <button onClick={() => startEdit(r)} className="text-xs text-primary-600 hover:text-primary-700">Edit</button>
                      <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                        {deleting === r.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : null}
    </div>
  );
}
