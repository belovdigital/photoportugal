"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

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
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [sharing, setSharing] = useState(false);
  const [delivered, setDelivered] = useState(initialDelivered);
  const [deliveryToken, setDeliveryToken] = useState(initialToken);
  const [deliveryUrl, setDeliveryUrl] = useState(
    initialToken ? `${window.location.origin}/delivery/${initialToken}` : ""
  );
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const t = useTranslations("delivery");

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(t("deletePhotos", { count: selectedIds.size }))) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    setDeleteProgress({ current: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      await fetch(`/api/bookings/${bookingId}/delivery?photoId=${ids[i]}`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== ids[i]));
      setDeleteProgress({ current: i + 1, total: ids.length });
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    setDeleting(false);
  }

  async function uploadOneFile(file: File): Promise<boolean> {
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.uploaded) {
        setPhotos(prev => [...prev, ...data.uploaded]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function handleUpload(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setUploading(true);
    setFailedFiles([]);
    setUploadProgress({ current: 0, total: imageFiles.length, failed: 0 });
    let completed = 0;
    const failedAfterRetry: File[] = [];

    // Upload in batches of 2 (reduced from 3 to avoid server overload with large files)
    const BATCH_SIZE = 2;
    const toUpload = [...imageFiles];

    for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
      const batch = toUpload.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (file) => ({ file, ok: await uploadOneFile(file) })));

      // Auto-retry failed ones immediately (one at a time)
      for (const r of results) {
        if (!r.ok) {
          const retryOk = await uploadOneFile(r.file);
          if (!retryOk) failedAfterRetry.push(r.file);
        }
      }

      completed += batch.length;
      setUploadProgress({ current: Math.min(completed, toUpload.length), total: toUpload.length, failed: failedAfterRetry.length });
    }

    setUploading(false);
    setFailedFiles(failedAfterRetry);
  }

  async function handleDelete(photoId: string) {
    if (!confirm(t("removePhoto"))) return;

    const res = await fetch(`/api/bookings/${bookingId}/delivery?photoId=${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  }

  async function handleShare() {
    if (photos.length === 0) {
      alert(t("uploadFirst"));
      return;
    }
    if (!galleryPassword.trim() || galleryPassword.trim().length < 4) {
      alert(t("setPassword"));
      return;
    }
    if (!confirm(t("confirmShare", { count: photos.length }))) return;

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
            {uploading ? t("uploading") : t("dropPhotos")}
          </p>
          <p className="mt-1 text-xs text-gray-400">{t("photoFormats")}</p>
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
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-warm-200">
            <div className="h-full rounded-full bg-primary-500 transition-all duration-300" style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }} />
          </div>
          <span className="text-sm font-medium text-gray-600 shrink-0">{uploadProgress.current}/{uploadProgress.total}</span>
        </div>
      )}

      {/* Delete progress */}
      {deleting && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-red-100">
            <div className="h-full rounded-full bg-red-500 transition-all duration-200" style={{ width: `${deleteProgress.total > 0 ? (deleteProgress.current / deleteProgress.total) * 100 : 0}%` }} />
          </div>
          <span className="text-sm font-medium text-red-600 shrink-0">Deleting {deleteProgress.current}/{deleteProgress.total}</span>
        </div>
      )}

      {/* Failed uploads - retry */}
      {!uploading && failedFiles.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">
              {failedFiles.length} photo{failedFiles.length !== 1 ? "s" : ""} failed to upload (likely too large)
            </p>
            <button
              onClick={() => handleUpload(failedFiles)}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition"
            >
              Retry
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-500">
            {failedFiles.map(f => f.name).join(", ")}
          </p>
        </div>
      )}

      {/* Photo count & stats */}
      {photos.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <strong>{photos.length}</strong> Photos &middot;{" "}
            {totalSize > 1024 * 1024
              ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
              : `${(totalSize / 1024).toFixed(0)} KB`}
            {selectMode && selectedIds.size > 0 && ` \u00B7 ${t("selected", { count: selectedIds.size })}`}
          </p>
          {!delivered && photos.length > 0 && (
            <div className="flex items-center gap-2">
              {selectMode ? (
                <>
                  <button onClick={() => setSelectedIds(new Set(photos.map((p) => p.id)))} className="text-xs font-medium text-gray-600 hover:text-gray-800">{t("selectAll")}</button>
                  <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40">{t("deleteCount", { count: selectedIds.size })}</button>
                  <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="text-xs font-medium text-gray-500 hover:text-gray-700">{t("cancel")}</button>
                </>
              ) : (
                <>
                  <button onClick={() => setSelectMode(true)} className="text-sm font-medium text-gray-500 hover:text-gray-700">{t("select")}</button>
                  <button onClick={() => fileRef.current?.click()} className="text-sm font-medium text-primary-600 hover:text-primary-700">{t("addMore")}</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Share / Deliver section — between stats and grid */}
      {photos.length > 0 && (
        <div className="mt-4">
          {delivered ? (
            <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100">
                  <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-accent-700 text-sm">{t("photosDelivered")}</p>
                </div>
                {deliveryUrl && (
                  <button onClick={copyLink} className="shrink-0 rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700">
                    {copied ? t("copied") : t("copy")} link
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-warm-200 bg-warm-50 p-4">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="gallery-password" className="block text-sm font-medium text-gray-700">
                  {t("galleryPassword")}
                </label>
                <input
                  id="gallery-password"
                  type="text"
                  value={galleryPassword}
                  onChange={(e) => setGalleryPassword(e.target.value)}
                  placeholder={t("galleryPasswordPlaceholder")}
                  className="mt-1.5 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:w-56"
                />
              </div>
              <button
                onClick={handleShare}
                disabled={sharing || photos.length === 0 || galleryPassword.trim().length < 4}
                className="shrink-0 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-700 disabled:opacity-50"
              >
                {sharing ? t("sharing") : `Share ${photos.length} Photos`}
              </button>
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

    </div>
  );
}
