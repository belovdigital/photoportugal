"use client";

import { useState, useRef } from "react";

interface Photo {
  id: string;
  url: string;
  filename: string;
  file_size: number;
}

export function DeliveryUploadClient({
  bookingId,
  initialPhotos,
  isDelivered: initialDelivered,
  deliveryToken: initialToken,
}: {
  bookingId: string;
  initialPhotos: Photo[];
  isDelivered: boolean;
  deliveryToken: string | null;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [delivered, setDelivered] = useState(initialDelivered);
  const [deliveryToken, setDeliveryToken] = useState(initialToken);
  const [deliveryUrl, setDeliveryUrl] = useState(
    initialToken ? `${window.location.origin}/delivery/${initialToken}` : ""
  );
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} photo${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    for (const id of selectedIds) {
      await fetch(`/api/bookings/${bookingId}/delivery?photoId=${id}`, { method: "DELETE" });
    }
    setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  async function handleUpload(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    imageFiles.forEach(f => formData.append("files", f));

    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.uploaded) {
        setPhotos(prev => [...prev, ...data.uploaded]);
      }
    } catch {}
    setUploading(false);
  }

  async function handleDelete(photoId: string) {
    if (!confirm("Remove this photo?")) return;

    const res = await fetch(`/api/bookings/${bookingId}/delivery?photoId=${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  }

  async function handleShare() {
    if (photos.length === 0) {
      alert("Upload at least one photo before sharing.");
      return;
    }
    if (!galleryPassword.trim() || galleryPassword.trim().length < 4) {
      alert("Please set a gallery password (at least 4 characters).");
      return;
    }
    if (!confirm(`Share ${photos.length} photos with the client? The password and gallery link will be sent to the client in the chat automatically.`)) return;

    setSharing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share", password: galleryPassword.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setDelivered(true);
        setDeliveryToken(data.token);
        setDeliveryUrl(data.deliveryUrl);
      }
    } catch {}
    setSharing(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(deliveryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalSize = photos.reduce((sum, p) => sum + (p.file_size || 0), 0);

  return (
    <div className="mt-6">
      {/* Upload area */}
      {!delivered && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver ? "border-primary-400 bg-primary-50" : "border-warm-300 hover:border-primary-300 hover:bg-warm-50"
          }`}
        >
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-3 text-sm font-semibold text-gray-700">
            {uploading ? "Uploading..." : "Drop photos here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-gray-400">JPEG, PNG, WebP — up to 25MB per photo</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-warm-200">
            <div className="h-full animate-pulse rounded-full bg-primary-500" style={{ width: "60%" }} />
          </div>
          <span className="text-sm text-gray-500">Uploading...</span>
        </div>
      )}

      {/* Photo count & stats */}
      {photos.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <strong>{photos.length}</strong> photo{photos.length !== 1 ? "s" : ""} &middot;{" "}
            {totalSize > 1024 * 1024
              ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
              : `${(totalSize / 1024).toFixed(0)} KB`}
            {selectMode && selectedIds.size > 0 && ` \u00B7 ${selectedIds.size} selected`}
          </p>
          {!delivered && photos.length > 0 && (
            <div className="flex items-center gap-2">
              {selectMode ? (
                <>
                  <button onClick={() => setSelectedIds(new Set(photos.map((p) => p.id)))} className="text-xs font-medium text-gray-600 hover:text-gray-800">Select All</button>
                  <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40">Delete ({selectedIds.size})</button>
                  <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => setSelectMode(true)} className="text-sm font-medium text-gray-500 hover:text-gray-700">Select</button>
                  <button onClick={() => fileRef.current?.click()} className="text-sm font-medium text-primary-600 hover:text-primary-700">+ Add more</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`group relative aspect-square overflow-hidden rounded-lg bg-warm-100 ${selectMode ? "cursor-pointer" : ""} ${selectedIds.has(photo.id) ? "ring-2 ring-primary-500" : ""}`}
              onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
            >
              <img
                src={photo.url}
                alt={photo.filename}
                className="h-full w-full object-cover"
              />
              {selectMode ? (
                <div className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedIds.has(photo.id) ? "border-primary-500 bg-primary-500" : "border-white bg-white/70"}`}>
                  {selectedIds.has(photo.id) && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ) : !delivered ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition group-hover:opacity-100">
                <p className="truncate text-xs text-white">{photo.filename}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share / Deliver section */}
      <div className="mt-8">
        {delivered ? (
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100">
                <svg className="h-5 w-5 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-accent-700">Photos delivered!</p>
                <p className="text-sm text-accent-600">Your client has been notified by email.</p>
              </div>
            </div>

            {deliveryUrl && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600">Delivery link (share with client)</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={deliveryUrl}
                    className="flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm text-gray-700"
                  />
                  <button
                    onClick={copyLink}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="gallery-password" className="block text-sm font-medium text-gray-700">
                Gallery password
              </label>
              <p className="text-xs text-gray-400">Set a password to protect the gallery. It will be sent to the client in the chat.</p>
              <input
                id="gallery-password"
                type="text"
                value={galleryPassword}
                onChange={(e) => setGalleryPassword(e.target.value)}
                placeholder="e.g. lisbon2026"
                className="mt-2 w-full rounded-lg border border-warm-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:w-64"
              />
            </div>
            <button
              onClick={handleShare}
              disabled={sharing || photos.length === 0 || galleryPassword.trim().length < 4}
              className="w-full rounded-xl bg-accent-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-accent-700 disabled:opacity-50 sm:w-auto"
            >
              {sharing ? "Sharing..." : `Share ${photos.length} Photo${photos.length !== 1 ? "s" : ""} with Client`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
