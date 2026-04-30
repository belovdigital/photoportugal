"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useConfirmModal } from "@/components/ui/ConfirmModal";

interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  filename: string;
  file_size: number;
  media_type?: "image" | "video";
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
}

export function DeliveryUploadClient({
  bookingId,
  initialPhotos,
  isDelivered: initialDelivered,
  clientAccepted,
  hasOpenDispute,
  deliveryToken: initialToken,
  initialTitle,
  initialMessage,
}: {
  bookingId: string;
  initialPhotos: Photo[];
  isDelivered: boolean;
  clientAccepted: boolean;
  hasOpenDispute: boolean;
  deliveryToken: string | null;
  initialTitle?: string | null;
  initialMessage?: string | null;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [sharing, setSharing] = useState(false);
  const [delivered, setDelivered] = useState(initialDelivered);

  // canEdit: photographer can edit the deliverable up until the client
  // formally accepts. Sharing the link doesn't lock anything — the client
  // hasn't seen / accepted yet so swapping a photo is fine. A dispute /
  // redo request also UNLOCKS edits even after acceptance, since fixing
  // the gallery is the whole point of that flow.
  const canEdit = !clientAccepted || hasOpenDispute;
  const [deliveryToken, setDeliveryToken] = useState(initialToken);
  // `window` is undefined during SSR (Next.js still server-renders this
  // "use client" component for the initial paint), so the URL is empty
  // initially and gets populated in a `useEffect` once we're on the
  // client. Without this guard the photographer's deliver page 500's
  // whenever `initialToken` is set (i.e. anytime they revisit a shared
  // delivery to edit it).
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [deliveryTitle, setDeliveryTitle] = useState(initialTitle || "");
  const [deliveryMessage, setDeliveryMessage] = useState(initialMessage || "");
  const [savingMessage, setSavingMessage] = useState(false);
  const [messageSaved, setMessageSaved] = useState(false);
  const saveMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const t = useTranslations("delivery");
  const { modal, confirm } = useConfirmModal();

  // Hydrate deliveryUrl on the client once `window` is available. Runs
  // also when `deliveryToken` changes (e.g. after share) so the URL
  // refreshes without a page reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDeliveryUrl(deliveryToken ? `${window.location.origin}/delivery/${deliveryToken}` : "");
  }, [deliveryToken]);

  // Debounced auto-save of title + message — fires 800ms after the
  // photographer stops typing so we don't hammer the API on every
  // keystroke. The "Saved" indicator quietly confirms persistence.
  function scheduleSaveMessage(nextTitle: string, nextMessage: string) {
    if (saveMessageTimer.current) clearTimeout(saveMessageTimer.current);
    saveMessageTimer.current = setTimeout(async () => {
      setSavingMessage(true);
      setMessageSaved(false);
      try {
        const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_message", title: nextTitle, message: nextMessage }),
        });
        if (res.ok) {
          setMessageSaved(true);
          setTimeout(() => setMessageSaved(false), 1500);
        }
      } catch {} finally {
        setSavingMessage(false);
      }
    }, 800);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    const ok = await confirm("Delete Photos", t("deletePhotos", { count: selectedIds.size }), { danger: true, confirmLabel: "Delete" });
    if (!ok) return;
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

  // Byte-level progress: keep an uploaded-bytes-per-file map and sum it
  // so the bar is smooth even with a single large file (50MB photo, 500MB
  // video). Upload-stage finishes when the browser hands the bytes off; if
  // the response then takes a while (e.g. server-side ffmpeg on a video),
  // the bar parks at 100% and `phase` flips to "processing" so the UI
  // doesn't look frozen.
  const [bytesProgress, setBytesProgress] = useState({ uploaded: 0, total: 0 });
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing">("uploading");
  const fileBytesRef = useRef<Map<string, number>>(new Map());
  // Shared session across overlapping handleUpload calls. If the photographer
  // hits "Add more" while a previous batch is still running, the new files
  // are merged into THIS session instead of clobbering the in-flight state
  // (totals reset to zero, bar disappears, etc).
  const uploadSessionRef = useRef<{
    totalFiles: number;
    totalBytes: number;
    completedFiles: number;
    failedFiles: File[];
  } | null>(null);

  function recomputeBytes() {
    let sum = 0;
    fileBytesRef.current.forEach((v) => { sum += v; });
    setBytesProgress((p) => {
      const next = { ...p, uploaded: sum };
      // Once all bytes are sent (sum >= total) we're waiting on the
      // server (ffmpeg / preview generation). Flip phase so the label
      // reads "Processing" instead of stuck at 100%.
      if (next.total > 0 && sum >= next.total) {
        setUploadPhase((cur) => (cur === "uploading" ? "processing" : cur));
      }
      return next;
    });
  }

  async function uploadOneFile(file: File): Promise<boolean> {
    const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
    fileBytesRef.current.set(fileKey, 0);
    return new Promise<boolean>((resolve) => {
      const formData = new FormData();
      formData.append("files", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/bookings/${bookingId}/delivery`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          fileBytesRef.current.set(fileKey, e.loaded);
          recomputeBytes();
        }
      };
      xhr.upload.onload = () => {
        // Bytes fully sent; mark this file at full size and switch phase
        // to "processing" if no other file is still uploading bytes.
        fileBytesRef.current.set(fileKey, file.size);
        recomputeBytes();
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.uploaded) {
              setPhotos((prev) => [...prev, ...data.uploaded]);
              resolve(true);
              return;
            }
          } catch {}
        }
        resolve(false);
      };
      xhr.onerror = () => resolve(false);
      xhr.onabort = () => resolve(false);
      xhr.send(formData);
    });
  }

  async function handleUpload(files: FileList | File[]) {
    // Accept both photos and videos. The server validates by MIME prefix
    // AND file extension, so we mirror that here — without the extension
    // fallback browsers that don't know the video MIME (older Macs, some
    // .mov export tools) would dump empty `file.type` and we'd silently
    // drop the file before even attempting upload.
    const VID_EXT = ["mp4", "mov", "webm", "m4v"];
    const filtered = Array.from(files).filter((f) => {
      const t = (f.type || "").toLowerCase();
      if (t.startsWith("image/") || t.startsWith("video/")) return true;
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      return VID_EXT.includes(ext);
    });
    if (filtered.length === 0) return;

    const addedBytes = filtered.reduce((s, f) => s + f.size, 0);
    const fresh = uploadSessionRef.current === null;

    if (fresh) {
      uploadSessionRef.current = {
        totalFiles: filtered.length,
        totalBytes: addedBytes,
        completedFiles: 0,
        failedFiles: [],
      };
      fileBytesRef.current.clear();
      setUploading(true);
      setUploadPhase("uploading");
      setFailedFiles([]);
      setUploadProgress({ current: 0, total: filtered.length, failed: 0 });
      setBytesProgress({ uploaded: 0, total: addedBytes });
    } else {
      // Merging into an in-flight session: extend totals so the same bar
      // keeps tracking everything together. uploaded bytes stay where they
      // are (real progress), so the bar dips back proportionally — that's
      // honest, the photographer just queued more work.
      const session = uploadSessionRef.current!;
      session.totalFiles += filtered.length;
      session.totalBytes += addedBytes;
      setUploadProgress((p) => ({ ...p, total: session.totalFiles, failed: session.failedFiles.length }));
      setBytesProgress((p) => ({ uploaded: p.uploaded, total: session.totalBytes }));
      // Phase may have flipped to "processing" when the previous batch's
      // bytes maxed out; the new files restart the byte stream so go back.
      setUploadPhase("uploading");
    }

    const BATCH_SIZE = 2;
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (file) => ({ file, ok: await uploadOneFile(file) })));

      for (const r of results) {
        if (!r.ok) {
          const retryOk = await uploadOneFile(r.file);
          if (!retryOk) uploadSessionRef.current!.failedFiles.push(r.file);
        }
      }

      const session = uploadSessionRef.current!;
      session.completedFiles += batch.length;
      setUploadProgress({
        current: session.completedFiles,
        total: session.totalFiles,
        failed: session.failedFiles.length,
      });
    }

    // Whichever overlapping call sees completedFiles catch up to totalFiles
    // wraps up. Pure equality check on the shared ref — works regardless of
    // which call started first or finishes first.
    const session = uploadSessionRef.current!;
    if (session.completedFiles >= session.totalFiles) {
      setFailedFiles([...session.failedFiles]);
      setUploading(false);
      uploadSessionRef.current = null;
    }
  }

  async function handleDelete(photoId: string) {
    const ok = await confirm("Remove Photo", t("removePhoto"), { danger: true, confirmLabel: "Remove" });
    if (!ok) return;

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
    const photoCnt = photos.filter((p) => p.media_type !== "video").length;
    const videoCnt = photos.filter((p) => p.media_type === "video").length;
    const confirmText = videoCnt === 0
      ? t("confirmShare", { count: photoCnt })
      : photoCnt === 0
        ? t("confirmShareVideos", { count: videoCnt })
        : t("confirmSharePhotosAndVideos", { photos: photoCnt, videos: videoCnt });
    const okShare = await confirm("Share Delivery", confirmText, { confirmLabel: "Share" });
    if (!okShare) return;

    setSharing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share",
          password: galleryPassword.trim(),
          title: deliveryTitle.trim(),
          message: deliveryMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error || "Failed to share delivery. Please try again.");
        return;
      }
      setDelivered(true);
      setDeliveryToken(data.token);
      setDeliveryUrl(data.deliveryUrl);
    } catch {
      setError("Failed to share delivery. Please try again.");
    }
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
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Title + warm message — always rendered so the photographer can
          see what they wrote even after sharing, but inputs go read-only
          (disabled, dimmer bg) once `canEdit` flips false. */}
      {(canEdit || deliveryTitle || deliveryMessage) && (
        <div className="mb-6 rounded-xl border border-warm-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{t("messageHeading")}</h3>
            <span className="text-xs text-gray-400">
              {!canEdit
                ? t("messageLocked")
                : savingMessage ? t("messageSaving")
                : messageSaved ? t("messageSaved")
                : ""}
            </span>
          </div>
          <input
            type="text"
            value={deliveryTitle}
            onChange={(e) => {
              setDeliveryTitle(e.target.value);
              scheduleSaveMessage(e.target.value, deliveryMessage);
            }}
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            disabled={!canEdit}
            className="mt-3 w-full rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-base font-semibold text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <textarea
            value={deliveryMessage}
            onChange={(e) => {
              setDeliveryMessage(e.target.value);
              scheduleSaveMessage(deliveryTitle, e.target.value);
            }}
            placeholder={t("messagePlaceholder")}
            maxLength={1500}
            rows={4}
            disabled={!canEdit}
            className="mt-2 w-full rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-70"
          />
          {canEdit && <p className="mt-1 text-[11px] text-gray-400">{deliveryMessage.length}/1500</p>}
        </div>
      )}

      {/* Upload area — shown until the client has accepted (pre-share + post-share edit window). */}
      {canEdit && (
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
            accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm,.m4v"
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </div>
      )}

      {/* Upload progress — bar driven by bytes uploaded so even a single
          large file shows smooth motion (file-count progress only ticks
          when each file finishes). After all bytes are sent, the phase
          flips to "processing" while the server runs ffmpeg / generates
          previews — bar pegged at 100% but the label tells the user
          we're still doing something. */}
      {uploading && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-warm-200">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{
                width: `${
                  bytesProgress.total > 0
                    ? Math.min(100, (bytesProgress.uploaded / bytesProgress.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 shrink-0 tabular-nums">
            {(() => {
              const pct = bytesProgress.total > 0
                ? Math.min(100, Math.round((bytesProgress.uploaded / bytesProgress.total) * 100))
                : 0;
              const isProcessing = uploadPhase === "processing" || (pct >= 100 && uploadProgress.current < uploadProgress.total);
              if (isProcessing) return `${t("processing")} · ${uploadProgress.current}/${uploadProgress.total}`;
              return `${pct}% · ${uploadProgress.current}/${uploadProgress.total}`;
            })()}
          </span>
        </div>
      )}

      {/* Delete progress */}
      {deleting && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-red-100">
            <div className="h-full rounded-full bg-red-500 transition-all duration-200" style={{ width: `${deleteProgress.total > 0 ? (deleteProgress.current / deleteProgress.total) * 100 : 0}%` }} />
          </div>
          <span className="text-sm font-medium text-red-600 shrink-0">{t("deletingProgress", { current: deleteProgress.current, total: deleteProgress.total })}</span>
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
              {t("retryUpload")}
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
          {canEdit && photos.length > 0 && (
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
                  {canEdit && (
                    <p className="mt-0.5 text-xs text-accent-700/80">{t("canStillEditUntilAccepted")}</p>
                  )}
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
                {(() => {
                  if (sharing) return t("sharing");
                  const photoCnt = photos.filter((p) => p.media_type !== "video").length;
                  const videoCnt = photos.filter((p) => p.media_type === "video").length;
                  if (videoCnt === 0) return t("sharePhotos", { count: photoCnt });
                  if (photoCnt === 0) return t("shareVideos", { count: videoCnt });
                  return t("sharePhotosAndVideos", { photos: photoCnt, videos: videoCnt });
                })()}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => {
            const isVideo = photo.media_type === "video";
            // For videos use the ffmpeg-extracted poster; for photos the
            // url IS already an image (presigned). Falling back to url for
            // images preserves the existing behaviour.
            const previewSrc = isVideo
              ? (photo.thumbnail_url || photo.url)
              : photo.url;
            return (
            <div
              key={photo.id}
              className={`group relative aspect-square overflow-hidden rounded-lg bg-warm-100 ${selectMode ? "cursor-pointer" : ""} ${selectedIds.has(photo.id) ? "ring-2 ring-primary-500" : ""}`}
              onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
            >
              <img
                src={previewSrc}
                alt={photo.filename}
                className="h-full w-full object-cover"
              />
              {isVideo && (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                      <svg className="h-5 w-5 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  {photo.duration_seconds ? (
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                      {Math.floor((photo.duration_seconds || 0) / 60)}:{String((photo.duration_seconds || 0) % 60).padStart(2, "0")}
                    </span>
                  ) : null}
                </>
              )}
              {selectMode ? (
                <div className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedIds.has(photo.id) ? "border-primary-500 bg-primary-500" : "border-white bg-white/70"}`}>
                  {selectedIds.has(photo.id) && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ) : canEdit ? (
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
            );
          })}
        </div>
      )}

      {modal}
    </div>
  );
}
