"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useConfirmModal } from "@/components/ui/ConfirmModal";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  DragOverlay, useDroppable, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Same library and the same sensors as the portfolio grid, so dragging feels
// identical in both places — and TouchSensor is why this works on a phone at
// all: HTML5 drag events never fire there.
function SortableTile({ id, disabled, children }: {
  id: string; disabled?: boolean;
  children: (h: { listeners: Record<string, unknown>; attributes: Record<string, unknown> }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      {children({ listeners: (listeners || {}) as Record<string, unknown>, attributes: attributes as unknown as Record<string, unknown> })}
    </div>
  );
}

// A pile is a drop target in its own right, otherwise an empty Extra photos
// section is impossible to drop into — exactly the state a photographer starts from.
function PileDropZone({ id, children, className }: { id: string; children: React.ReactNode; className: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "rounded-xl ring-2 ring-accent-400" : ""}`}>
      {children}
    </div>
  );
}

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
  // Included = part of what the booking promised, and what the client
  // receives. Excluded photos are held back — and, with paid extras live,
  // offered for sale. purchased_at means the client already bought it, which
  // makes the exclusion irreversible.
  is_included?: boolean;
  purchased_at?: string | null;
}

export function DeliveryUploadClient({
  bookingId,
  initialPhotos,
  isDelivered: initialDelivered,
  clientAccepted,
  hasOpenDispute,
  deliveryToken: initialToken,
  deliveryPassword: initialPassword,
  initialTitle,
  initialMessage,
  requiredPhotos = 0,
  initialGiftSlots = 0,
  initialPeekToken = null,
  initialPeekSharedAt = null,
}: {
  bookingId: string;
  initialPhotos: Photo[];
  isDelivered: boolean;
  clientAccepted: boolean;
  hasOpenDispute: boolean;
  deliveryToken: string | null;
  deliveryPassword?: string | null;
  initialTitle?: string | null;
  initialMessage?: string | null;
  /** Photos promised by the paid package — the photographer must add at
   *  least this many (videos don't count) before they can deliver. 0 = no
   *  package/expectation, so the check is skipped. */
  requiredPhotos?: number;
  initialGiftSlots?: number;
  /** Sneak peek state — token + timestamp when already shared. */
  initialPeekToken?: string | null;
  initialPeekSharedAt?: string | null;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  // Most recent server-side error reason picked off a failed upload
  // response. Surfaces things like "Delivery limit reached (max 500
  // items)" in the failed-files banner instead of the generic "didn't
  // upload, retry" — which used to make the photographer retry forever
  // against a hard limit they had no way to see.
  const [lastUploadError, setLastUploadError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Progressive grid batching — 500-photo deliveries must not render (or
  // fetch) everything at once. Fresh uploads reveal the full grid so the
  // photographer always sees what they just added.
  const GRID_BATCH = 60;
  const [visibleCount, setVisibleCount] = useState(GRID_BATCH);
  const gridSentinelRef = useRef<HTMLDivElement>(null);
  const sendPanelRef = useRef<HTMLDivElement>(null);
  const prevPhotoCountRef = useRef(initialPhotos.length);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [delivered, setDelivered] = useState(initialDelivered);
  const [giftSlots, setGiftSlots] = useState(initialGiftSlots);
  const [giftDraft, setGiftDraft] = useState(String(initialGiftSlots ?? 0));
  const [giftSaving, setGiftSaving] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [sendPanelVisible, setSendPanelVisible] = useState(true);

  // canEdit: photographer can edit the deliverable up until the client
  // formally accepts. Sharing the link doesn't lock anything — the client
  // hasn't seen / accepted yet so swapping a photo is fine. A dispute /
  // redo request also UNLOCKS edits even after acceptance, since fixing
  // the gallery is the whole point of that flow.
  const canEdit = !clientAccepted || hasOpenDispute;

  useEffect(() => {
    // Uploads append to the end — reveal everything so new photos are
    // visibly there (deletes shrink the list and must NOT reveal).
    if (photos.length > prevPhotoCountRef.current) setVisibleCount(photos.length);
    prevPhotoCountRef.current = photos.length;
  }, [photos.length]);

  useEffect(() => {
    const el = sendPanelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSendPanelVisible(e.isIntersecting), { rootMargin: "-40px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [photos.length, delivered]);

  useEffect(() => {
    if (visibleCount >= photos.length) return;
    const el = gridSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + GRID_BATCH, photos.length));
        }
      },
      { rootMargin: "1600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, photos.length]);
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
  const [galleryPassword, setGalleryPassword] = useState(() => initialPassword || String(Math.floor(1000 + Math.random() * 9000)));
  // Sneak peek — optional 1-10 photo early share (never a delivery).
  const [peekToken, setPeekToken] = useState<string | null>(initialPeekToken);
  const [peekShared, setPeekShared] = useState(!!initialPeekSharedAt);
  const [peekSending, setPeekSending] = useState(false);
  const [peekError, setPeekError] = useState("");
  const [peekCopied, setPeekCopied] = useState(false);

  async function sharePeek() {
    if (peekSending || peekShared) return;
    setPeekSending(true);
    setPeekError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share_peek" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setPeekError(data?.error || t("peekError"));
        setPeekSending(false);
        return;
      }
      setPeekToken(data.peek_token);
      setPeekShared(true);
    } catch {
      setPeekError(t("peekError"));
    }
    setPeekSending(false);
  }

  function copyPeekLink() {
    if (!peekToken) return;
    navigator.clipboard?.writeText(`${window.location.origin}/peek/${peekToken}`).then(() => {
      setPeekCopied(true);
      setTimeout(() => setPeekCopied(false), 1500);
    }).catch(() => {});
  }
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

  // Anchor for shift-click. The mistaken upload is almost always a
  // contiguous run in upload order, so selecting 40 of 100 was 40 clicks
  // before this — the actual complaint, more than "select all" was.
  const lastClickedRef = useRef<string | null>(null);

  function toggleSelect(id: string, extend = false) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const anchor = lastClickedRef.current;
      if (extend && anchor && anchor !== id) {
        const from = photos.findIndex((p) => p.id === anchor);
        const to = photos.findIndex((p) => p.id === id);
        if (from !== -1 && to !== -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          // A range always selects. Making it toggle means dragging back
          // over your own selection silently unpicks it.
          for (let i = lo; i <= hi; i++) next.add(photos[i].id);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastClickedRef.current = id;
  }

  // Two piles, not a mode. Videos ride along with the delivery — they never
  // counted toward a photo promise and are not sold.
  const includedPhotos = photos.filter((p) => p.is_included !== false);
  const extraPhotos = photos.filter((p) => p.is_included === false);
  // The promise is counted in PHOTOS. Videos live in the delivery pile but are
  // not part of any count, so every number that gates sharing derives from
  // this one value instead of being recomputed inline four different ways.
  const includedPhotoCount = includedPhotos.filter((p) => p.media_type !== "video").length;
  // Only while the photographer can still act on it. An accepted delivery has
  // no move buttons, no gift panel and a server that refuses every write, so
  // the warning there would be a permanent alarm with no off switch — and on
  // this platform 26 finished deliveries are legitimately over their promise.
  const overBy = requiredPhotos > 0 && !delivered && !clientAccepted
    ? Math.max(0, includedPhotoCount - requiredPhotos)
    : 0;

  // Moving 180 photos one at a time is not a workflow. The API already takes
  // an array; this is the single call that does the whole split.
  const surplusIds = overBy > 0
    ? includedPhotos.filter((p) => p.media_type !== "video" && !p.purchased_at).slice(requiredPhotos).map((p) => p.id)
    : [];

  // Dragging: within a pile it reorders, across piles it also changes what the
  // client gets. The global order IS the two piles concatenated, which keeps
  // the server's first-N trim agreeing with what the photographer sees.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const canDrag = canEdit && !selectMode;
  const [dragging, setDragging] = useState<Photo | null>(null);

  function pileOf(id: string): "delivery" | "extras" | null {
    if (id === "delivery" || id === "extras") return id;
    const ph = photos.find((p) => p.id === id);
    if (!ph) return null;
    return ph.is_included === false ? "extras" : "delivery";
  }

  async function persistOrder(ordered: Photo[], flipped?: { id: string; included: boolean }) {
    const before = photos;
    setPhotos(ordered);
    try {
      if (flipped) {
        const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_included", photo_ids: [flipped.id], included: flipped.included }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setPhotos(before);
          alert(data?.error || t("includeFailed"));
          return;
        }
      }
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_order", photo_ids: ordered.map((p) => p.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhotos(before);
        alert(data?.error || t("includeFailed"));
      }
    } catch {
      setPhotos(before);
      alert(t("includeFailed"));
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging(photos.find((p) => p.id === String(e.active.id)) || null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (activeId === overId) return;

    const from = pileOf(activeId);
    const to = pileOf(overId);
    if (!from || !to) return;

    const moved = photos.find((p) => p.id === activeId);
    if (!moved) return;
    // Videos ride with the delivery and are never sold; a sold photo is the
    // client's and cannot be pulled back out.
    if (from !== to && (moved.media_type === "video" || moved.purchased_at)) return;

    let included = includedPhotos.slice();
    let extras = extraPhotos.slice();

    if (from === to) {
      const list = from === "delivery" ? included : extras;
      const oldIdx = list.findIndex((p) => p.id === activeId);
      const newIdx = overId === from ? list.length - 1 : list.findIndex((p) => p.id === overId);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const next = arrayMove(list, oldIdx, newIdx);
      if (from === "delivery") included = next; else extras = next;
      void persistOrder([...included, ...extras]);
      return;
    }

    const src = from === "delivery" ? included : extras;
    const dst = to === "delivery" ? included : extras;
    const oldIdx = src.findIndex((p) => p.id === activeId);
    if (oldIdx < 0) return;
    const [taken] = src.splice(oldIdx, 1);
    const flipped = { ...taken, is_included: to === "delivery" };
    const at = overId === to ? dst.length : Math.max(0, dst.findIndex((p) => p.id === overId));
    dst.splice(at, 0, flipped);
    void persistOrder([...included, ...extras], { id: activeId, included: to === "delivery" });
  }

  const shareBlocked = sharing || photos.length === 0 || galleryPassword.trim().length < 4
    || (requiredPhotos > 0 && (includedPhotoCount < requiredPhotos || overBy > 0));

  const shareLabel = (() => {
    if (sharing) return t("sharing");
    const videoCnt = photos.filter((p) => p.media_type === "video").length;
    if (videoCnt === 0) return t("sharePhotos", { count: includedPhotoCount });
    if (includedPhotoCount === 0) return t("shareVideos", { count: videoCnt });
    return t("sharePhotosAndVideos", { photos: includedPhotoCount, videos: videoCnt });
  })();

  const counterLine = requiredPhotos > 0 ? (
    <p className={`text-xs ${overBy > 0 ? "font-semibold text-red-600" : includedPhotoCount < requiredPhotos ? "font-medium text-amber-700" : "text-gray-500"}`}>
      {overBy > 0
        ? t("photoCounterOver", { count: includedPhotoCount, required: requiredPhotos, over: overBy })
        : includedPhotoCount < requiredPhotos
          ? t("photoCounterShort", { count: includedPhotoCount, required: requiredPhotos, remaining: requiredPhotos - includedPhotoCount })
          : t("photoCounterOk", { count: includedPhotoCount, required: requiredPhotos })}
    </p>
  ) : null;

  async function moveSurplusToExtras() {
    if (surplusIds.length === 0 || bulkMoving) return;
    setBulkMoving(true);
    const before = photos;
    const ids = new Set(surplusIds);
    setPhotos((prev) => prev.map((p) => (ids.has(p.id) ? { ...p, is_included: false } : p)));
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_included", photo_ids: surplusIds, included: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhotos(before);
        alert(data?.error || t("includeFailed"));
      }
    } catch {
      setPhotos(before);
      alert(t("includeFailed"));
    } finally {
      setBulkMoving(false);
    }
  }
  const showSplit = extraPhotos.length > 0 ||
    (requiredPhotos > 0 && photos.filter((p) => p.media_type !== "video").length > requiredPhotos);

  async function moveOne(id: string, toDelivery: boolean) {
    const before = photos;
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, is_included: toDelivery } : p)));
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_included", photo_ids: [id], included: toDelivery }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhotos(before);
        alert(data?.error || t("includeFailed"));
      }
    } catch {
      setPhotos(before);
    }
  }

  function renderTile(photo: Photo, dragHandle?: { listeners: Record<string, unknown>; attributes: Record<string, unknown> }) {
    const isVideo = photo.media_type === "video";
    // For videos use the ffmpeg-extracted poster; for photos the
    // url IS already an image (presigned). Falling back to url for
    // images preserves the existing behaviour.
    // ALWAYS prefer the 1200px thumbnail in the grid. Using the
    // presigned ORIGINAL (3-20MB each) meant a 500-photo delivery
    // pulled gigabytes into the manage page and killed mobile.
    const previewSrc = photo.thumbnail_url || photo.url;
    return (
    <div
      key={photo.id}
      className={`group relative aspect-square overflow-hidden rounded-lg bg-warm-100 ${selectMode ? "cursor-pointer" : dragHandle ? "cursor-grab active:cursor-grabbing" : ""} ${selectedIds.has(photo.id) ? "ring-2 ring-primary-500" : ""}`}
      onClick={selectMode ? (e) => toggleSelect(photo.id, e.shiftKey) : undefined}
      {...(dragHandle ? { ...dragHandle.attributes, ...dragHandle.listeners } : {})}
    >
      {showSplit && !selectMode && !clientAccepted && photo.media_type !== "video" && !photo.purchased_at && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); moveOne(photo.id, photo.is_included === false); }}
          onPointerDown={(e) => e.stopPropagation()}
          /* Always visible on touch — there is no hover on a phone, and a
             control you cannot discover is the same as no control. */
          className="absolute inset-x-1 bottom-1 z-20 rounded-md bg-white/95 py-1.5 text-[11px] font-semibold text-gray-800 shadow transition md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
        >
          {photo.is_included === false ? t("moveToDelivery") : t("moveToExtras")}
        </button>
      )}
      {photo.purchased_at && (
        <span className="absolute left-1 top-1 z-20 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {t("soldBadge")}
        </span>
      )}
      <img
        src={previewSrc}
        alt={photo.filename}
        loading="lazy"
        decoding="async"
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
  }

  async function saveGiftSlots() {
    const n = parseInt(giftDraft, 10) || 0;
    if (n === giftSlots) return;
    setGiftSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_gift_slots", gift_slots: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error || t("includeFailed")); return; }
      setGiftSlots(n);
    } finally {
      setGiftSaving(false);
    }
  }



  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    const ok = await confirm("Delete Photos", t("deletePhotos", { count: selectedIds.size }), { danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    setDeleteProgress({ current: 0, total: ids.length });
    // Chunks, not one request per photo: 100 frames used to be 100 sequential
    // round trips. The server takes up to 200 per call; 50 keeps the URL short
    // and the progress bar honest.
    const CHUNK = 50;
    let removed = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      try {
        const res = await fetch(
          `/api/bookings/${bookingId}/delivery?photoIds=${chunk.join(",")}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed += chunk.length;
          // Surface the reason — an accepted delivery or an open dispute is
          // refused server-side, and silently doing nothing looks like a bug.
          alert(typeof data?.error === "string" ? data.error : t("deleteFailed"));
          break;
        }
        // Trust the server's list rather than the request: anything it did
        // not delete stays on screen instead of vanishing from the grid.
        const deleted: string[] = Array.isArray(data?.deleted) ? data.deleted : chunk;
        const gone = new Set(deleted);
        setPhotos((prev) => prev.filter((p) => !gone.has(p.id)));
        removed += deleted.length;
      } catch {
        failed += chunk.length;
        alert(t("deleteFailed"));
        break;
      }
      setDeleteProgress({ current: Math.min(i + CHUNK, ids.length), total: ids.length });
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    setDeleting(false);
    if (failed > 0 && removed > 0) {
      alert(t("deletePartial", { removed, failed }));
    }
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

  function isVideo(file: File): boolean {
    if ((file.type || "").startsWith("video/")) return true;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return ["mp4", "mov", "webm", "m4v"].includes(ext);
  }

  // Videos go to R2 directly via a presigned PUT. Cloudflare's edge proxy
  // caps multipart bodies at 100MB on Free/Pro plans, so anything bigger
  // (and we cap photographer videos at 500MB) would be killed in flight
  // if it went through our origin. The browser hits R2 on its native
  // endpoint — which CF doesn't proxy — and we only carry presign +
  // finalize JSON, both tiny.
  async function uploadVideoViaPresign(file: File): Promise<boolean> {
    const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
    fileBytesRef.current.set(fileKey, 0);

    const presignRes = await fetch(`/api/bookings/${bookingId}/delivery/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || "",
        file_size: file.size,
      }),
    });
    if (!presignRes.ok) {
      const body = await presignRes.text();
      console.error("[delivery upload] presign failed:", body);
      try { const data = JSON.parse(body); if (data?.error) setLastUploadError(String(data.error)); } catch {}
      return false;
    }
    const presign = await presignRes.json() as {
      upload_url: string;
      s3_key: string;
      content_type: string;
      download_filename: string;
    };

    // Direct PUT to R2. XHR (not fetch) so we still get progress events.
    const putOk = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presign.upload_url);
      xhr.setRequestHeader("Content-Type", presign.content_type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          fileBytesRef.current.set(fileKey, e.loaded);
          recomputeBytes();
        }
      };
      xhr.upload.onload = () => {
        fileBytesRef.current.set(fileKey, file.size);
        recomputeBytes();
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.onabort = () => resolve(false);
      xhr.send(file);
    });
    if (!putOk) return false;

    // Tell the server the upload landed so it can write the DB row and
    // kick off background thumbnail/metadata extraction.
    const finalizeRes = await fetch(`/api/bookings/${bookingId}/delivery/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        s3_key: presign.s3_key,
        filename: file.name,
        download_filename: presign.download_filename,
      }),
    });
    if (!finalizeRes.ok) {
      const body = await finalizeRes.text();
      console.error("[delivery upload] finalize failed:", body);
      try { const data = JSON.parse(body); if (data?.error) setLastUploadError(String(data.error)); } catch {}
      return false;
    }
    const data = await finalizeRes.json();
    if (data.uploaded) {
      setPhotos((prev) => [...prev, ...data.uploaded]);
      return true;
    }
    return false;
  }

  async function uploadOneFile(file: File): Promise<boolean> {
    if (isVideo(file)) return uploadVideoViaPresign(file);

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
        // Non-2xx (or 2xx with no uploaded payload) — pull the server's
        // error message off the body if there is one, so the failed-
        // files banner can show a concrete reason ("Delivery limit
        // reached (max 500 items)") instead of generic retry copy.
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error) setLastUploadError(String(data.error));
        } catch {}
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
      setLastUploadError(null);
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
    // Held-back extras are on offer, not delivered — they must not count
    // toward the promise, nor inflate the number quoted to the photographer.
    const deliverablePhotos = includedPhotoCount;
    if (requiredPhotos > 0 && deliverablePhotos > requiredPhotos) {
      // The delivery is the promise, exactly. Surplus frames belong in the
      // extras pile, where the client can buy them — or receive them free if
      // the photographer sets a gift. Sending them silently gives away work
      // and leaves nothing to sell.
      setError(t("tooManyPhotos", {
        count: deliverablePhotos,
        required: requiredPhotos,
        over: deliverablePhotos - requiredPhotos,
      }));
      return;
    }
    if (requiredPhotos > 0 && deliverablePhotos < requiredPhotos) {
      // Mirror the server guard so the photographer sees it before the
      // confirm dialog. Videos don't count toward the package photo minimum.
      setError(t("needMorePhotos", { required: requiredPhotos, count: deliverablePhotos }));
      return;
    }
    const photoCnt = deliverablePhotos;
    const videoCnt = photos.filter((p) => p.media_type === "video").length;
    // The dialog never mentioned the other pile, so the last thing a
    // photographer saw before sending said nothing about what goes on sale.
    const extrasCnt = extraPhotos.filter((p) => p.media_type !== "video").length;
    const confirmText = (videoCnt === 0
      ? t("confirmShare", { count: photoCnt })
      : photoCnt === 0
        ? t("confirmShareVideos", { count: videoCnt })
        : t("confirmSharePhotosAndVideos", { photos: photoCnt, videos: videoCnt }))
      + (extrasCnt > 0 ? `\n\n${t("confirmShareExtras", { count: extrasCnt })}` : "");
    const okShare = await confirm("Share Delivery", confirmText, { confirmLabel: "Share" });
    if (!okShare) return;

    setSharing(true);
    try {
      let res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share",
          password: galleryPassword.trim(),
          title: deliveryTitle.trim(),
          message: deliveryMessage.trim(),
        }),
      });
      let data = await res.json();
      if (res.status === 409 && data?.code === "small_delivery_confirm") {
        // No-package booking with a suspiciously small gallery — make the
        // photographer explicitly distinguish "full delivery" from a sneak
        // peek before we let it through.
        setSharing(false);
        const okSmall = await confirm(
          t("smallDeliveryTitle"),
          t("smallDeliveryText", { count: data.uploaded }),
          { confirmLabel: t("smallDeliveryConfirm") }
        );
        if (!okSmall) return;
        setSharing(true);
        res = await fetch(`/api/bookings/${bookingId}/delivery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "share",
            password: galleryPassword.trim(),
            title: deliveryTitle.trim(),
            message: deliveryMessage.trim(),
            confirm_small: true,
          }),
        });
        data = await res.json();
      }
      if (!res.ok || !data.success) {
        setError(data?.code === "insufficient_photos"
          ? t("needMorePhotos", { required: data.required, count: data.uploaded })
          : (data?.error || "Failed to share delivery. Please try again."));
        setSharing(false);
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

  // Re-send an already-delivered gallery to the client. Same server path
  // as handleShare (regenerates the link, re-emails the client, re-posts
  // the DELIVERY chat message), but callable from the "delivered" state so
  // a photographer who added photos — or whose delivery was re-opened by
  // admin (which can rotate the token and kill the client's old link) —
  // can push a fresh link without support. Only offered while the client
  // hasn't accepted yet (canEdit).
  async function handleResend() {
    const pw = (galleryPassword || initialPassword || "").trim();
    if (pw.length < 4) {
      setError(t("setPassword"));
      return;
    }
    // Adding photos after the first share is exactly how a gallery goes over
    // its promise, and this button used to ship every surplus frame for free.
    if (requiredPhotos > 0 && includedPhotoCount > requiredPhotos) {
      setError(t("tooManyPhotos", {
        count: includedPhotoCount,
        required: requiredPhotos,
        over: includedPhotoCount - requiredPhotos,
      }));
      return;
    }
    const photoCnt = includedPhotoCount;
    const ok = await confirm(t("resendToClient"), t("confirmResend", { count: photoCnt }), { confirmLabel: t("resendToClient") });
    if (!ok) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // confirm_small: true — this is an already-delivered gallery being
        // re-sent, not a first delivery, so skip the small-gallery nag.
        body: JSON.stringify({
          action: "share",
          password: pw,
          title: deliveryTitle.trim(),
          message: deliveryMessage.trim(),
          confirm_small: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error || "Failed to re-send delivery. Please try again.");
        return;
      }
      setDeliveryToken(data.token);
      setDeliveryUrl(data.deliveryUrl);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch {
      setError("Failed to re-send delivery. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  function copyLink() {
    const text = galleryPassword
      ? `${deliveryUrl}?pw=${encodeURIComponent(galleryPassword)}`
      : deliveryUrl;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalSize = photos.reduce((sum, p) => sum + (p.file_size || 0), 0);

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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

      {/* Failed uploads - retry. Wording: previously we guessed "(likely
          too large)" but server-side per-file errors include a real
          reason now, so just say "didn't upload" — Retry usually fixes
          transient failures (network blip, server hiccup, etc.) and if
          it persists, admin has already been emailed with the per-file
          reasons. */}
      {!uploading && failedFiles.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-800">
                {failedFiles.length} photo{failedFiles.length !== 1 ? "s" : ""} didn't upload.
              </p>
              {lastUploadError ? (
                <p className="mt-0.5 text-sm text-amber-700">
                  Reason: <span className="font-semibold">{lastUploadError}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-amber-700">
                  Try Retry. If it keeps failing, we've already been notified.
                </p>
              )}
            </div>
            <button
              onClick={() => handleUpload(failedFiles)}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition"
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
                  <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40">{selectedIds.size > 0 && selectedIds.size === photos.length ? t("deleteAllCount", { count: photos.length }) : t("deleteCount", { count: selectedIds.size })}</button>
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


      {/* Peek and gift — the arranging tools. Sending lives in its own panel. */}
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
                  {/* The card announced the send and said nothing about the
                      other pile, which is where the photographer's next euro
                      comes from. */}
                  {extraPhotos.filter((p) => p.media_type !== "video").length > 0 && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-700">
                      {t("deliveredExtrasOnSale", { count: extraPhotos.filter((p) => p.media_type !== "video").length })}
                    </p>
                  )}
                  {canEdit && (
                    <p className="mt-0.5 text-xs text-accent-700/80">{t("canStillEditUntilAccepted")}</p>
                  )}
                  {initialPassword && (
                    <p className="mt-1 text-xs text-accent-700/80">
                      {t("galleryPassword")}: <span className="font-mono font-semibold text-accent-800">{initialPassword}</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Re-send only while the client can still accept — a fresh
                      link + email, e.g. after adding photos or an admin
                      re-open that rotated the token. */}
                  {canEdit && (
                    <button
                      onClick={handleResend}
                      disabled={resending}
                      className="rounded-lg border border-accent-600 bg-white px-3 py-1.5 text-xs font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-50"
                    >
                      {resending ? t("resending") : resent ? t("resent") : t("resendToClient")}
                    </button>
                  )}
                  {deliveryUrl && (
                    <button onClick={copyLink} className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700">
                      {copied ? t("copied") : t("copy")} link
                    </button>
                  )}
                </div>
              </div>
              {resent && (
                <p className="mt-2 text-xs font-medium text-accent-700">✓ {t("resentToast")}</p>
              )}
              {error && (
                <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
              )}
            </div>
          ) : (
            <>
            {/* Sneak peek — optional early share while editing. Shows only
                pre-delivery with 1-10 images uploaded; silently disappears
                past 10 (they're clearly heading for the full delivery). */}
            {(() => {
              const imgCount = photos.filter((p) => p.media_type !== "video").length;
              if (peekShared) {
                return (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-sm font-medium text-violet-800">{t("peekSent", { count: imgCount })}</p>
                    {peekToken && (
                      <button type="button" onClick={copyPeekLink} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
                        {peekCopied ? t("copied") : t("peekCopyLink")}
                      </button>
                    )}
                  </div>
                );
              }
              if (imgCount < 1 || imgCount > 10) return null;
              return (
                <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[220px] flex-1">
                      <p className="text-sm font-semibold text-violet-900">✨ {t("peekHeading")}</p>
                      <p className="mt-0.5 text-xs text-violet-700">{t("peekSub", { count: imgCount })}</p>
                    </div>
                    <button
                      type="button"
                      onClick={sharePeek}
                      disabled={peekSending}
                      className="shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
                    >
                      {peekSending ? "…" : t("peekSend", { count: imgCount })}
                    </button>
                  </div>
                  {peekError && <p className="mt-2 text-xs text-red-600">{peekError}</p>}
                </div>
              );
            })()}
            {(showSplit || giftSlots > 0) && !clientAccepted && (
              <div className="mt-6 w-full rounded-xl border border-accent-200 bg-accent-50 p-4">
                <p className="text-sm font-bold text-accent-900">🎁 {t("giftTitle")}</p>
                <p className="mt-1 text-sm text-accent-800">{t("giftBody")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGiftDraft(String(Math.max(0, (parseInt(giftDraft, 10) || 0) - 1)))}
                    className="h-9 w-9 rounded-lg border border-accent-300 bg-white text-lg font-bold text-accent-700"
                  >−</button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={giftDraft}
                    onChange={(e) => {
                      // Keep it a free-text field while typing — clamping on every
                      // keystroke makes "1" impossible to turn into "12".
                      const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                      setGiftDraft(raw);
                    }}
                    onBlur={() => setGiftDraft(String(Math.min(999, parseInt(giftDraft, 10) || 0)))}
                    className="h-9 w-16 rounded-lg border border-accent-300 bg-white text-center text-xl font-bold text-accent-900 focus:border-accent-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setGiftDraft(String(Math.min(999, (parseInt(giftDraft, 10) || 0) + 1)))}
                    className="h-9 w-9 rounded-lg border border-accent-300 bg-white text-lg font-bold text-accent-700"
                  >+</button>
                  <button
                    type="button"
                    onClick={saveGiftSlots}
                    disabled={giftSaving || (parseInt(giftDraft, 10) || 0) === giftSlots}
                    className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {giftSaving ? "…" : t("save")}
                  </button>
                </div>
                {(() => {
                  const draft = parseInt(giftDraft, 10) || 0;
                  return (
                    <>
                      {/* The counter shows the draft; echoing the SAVED number
                          underneath it read as a bug ("11" above, "2" below). */}
                      {draft !== giftSlots ? (
                        <p className="mt-2 text-xs font-semibold text-accent-800">{t("giftUnsaved", { count: draft })}</p>
                      ) : (
                        <p className="mt-2 text-xs text-accent-700">
                          {giftSlots > 0 ? t("giftStateOn", { count: giftSlots }) : t("giftStateOff")}
                        </p>
                      )}
                      {/* Warns on the number in the box, not the saved one —
                          typing 993 against 4 available should say so now,
                          not after you commit it. */}
                      {draft > extraPhotos.length && (
                        <p className="mt-1 text-xs text-amber-700">{t("giftMoreThanExtras", { available: extraPhotos.length })}</p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            </>
          )}
        </div>
      )}

      {/* Send — one panel: what you say, the password, and the button. It used
          to be three separate cards touching each other, and the note to the
          client sat at the top of the page before a photo even existed. */}
      {photos.length > 0 && !delivered && (
        <div ref={sendPanelRef} className="mt-8 rounded-2xl border-2 border-accent-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-bold text-gray-900">{t("messageHeading")}</h3>
            <span className="text-xs text-gray-400">
              {savingMessage ? t("messageSaving") : messageSaved ? t("messageSaved") : ""}
            </span>
          </div>

          <input
            type="text"
            // Free-text gallery title, NOT a contact field — browser autofill
            // kept dropping a saved address into it.
            autoComplete="off"
            autoCorrect="off"
            data-1p-ignore
            data-lpignore="true"
            name="delivery-gallery-title"
            value={deliveryTitle}
            onChange={(e) => { setDeliveryTitle(e.target.value); scheduleSaveMessage(e.target.value, deliveryMessage); }}
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            className="mt-3 w-full rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-base font-semibold text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
          <p className="mt-1.5 text-[11px] leading-snug text-gray-400">{t("titleHelp")}</p>

          <textarea
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            name="delivery-gallery-message"
            value={deliveryMessage}
            onChange={(e) => { setDeliveryMessage(e.target.value); scheduleSaveMessage(deliveryTitle, e.target.value); }}
            placeholder={t("messagePlaceholder")}
            maxLength={1500}
            rows={3}
            className="mt-3 w-full rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
          <div className="mt-1.5 flex items-start justify-between gap-3">
            <p className="text-[11px] leading-snug text-gray-400">{t("messageHelp")}</p>
            <p className="shrink-0 text-[11px] text-gray-400">{deliveryMessage.length}/1500</p>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-warm-200 pt-4">
            <div className="min-w-[180px] flex-1">
              <label htmlFor="gallery-password" className="block text-sm font-medium text-gray-700">{t("galleryPassword")}</label>
              <input
                id="gallery-password"
                type="text"
                value={galleryPassword}
                onChange={(e) => setGalleryPassword(e.target.value)}
                placeholder={t("galleryPasswordPlaceholder")}
                className="mt-1.5 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:w-48"
              />
            </div>
            <button
              onClick={handleShare}
              disabled={shareBlocked}
              className="shrink-0 rounded-xl bg-accent-600 px-6 py-3 text-sm font-bold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              {shareLabel}
            </button>
            {counterLine}
          </div>
          {/* The error used to render only at the top of the page, one full
              scroll away from the button that caused it. */}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        </div>
      )}

      {/* Two piles: drag to reorder, drag across to change what the client gets.
          The tap-to-move button stays for anyone who would rather not drag. */}
      {photos.length > 0 && showSplit && (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={`mt-6 flex flex-wrap items-baseline justify-between gap-2 border-b-2 pb-2 ${overBy > 0 ? "border-red-300" : "border-accent-200"}`}>
            <h3 className={`text-base font-bold ${overBy > 0 ? "text-red-700" : "text-gray-900"}`}>
              {overBy > 0 ? "⚠" : "✓"} {t("sectionIncluded", { count: includedPhotoCount })}
              {overBy > 0 && (
                <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  {t("overCapBadge", { required: requiredPhotos })}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">{t("sectionIncludedHint")}</p>
          </div>
          {overBy > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-800">{t("overCapHint", { over: overBy })}</p>
              <button
                type="button"
                onClick={moveSurplusToExtras}
                disabled={bulkMoving}
                className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkMoving ? "…" : t("moveSurplus", { over: overBy })}
              </button>
            </div>
          )}
          <SortableContext items={includedPhotos.slice(0, visibleCount).map((p) => p.id)} strategy={rectSortingStrategy}>
            <PileDropZone id="delivery" className="mt-3 grid min-h-[6rem] grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {includedPhotos.slice(0, visibleCount).map((photo) => (
                <SortableTile key={photo.id} id={photo.id} disabled={!canDrag}>
                  {(h) => renderTile(photo, canDrag ? h : undefined)}
                </SortableTile>
              ))}
            </PileDropZone>
          </SortableContext>

          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-amber-200 pb-2">
            <h3 className="text-base font-bold text-amber-800">€ {t("sectionExtras", { count: extraPhotos.length })}</h3>
            <p className="text-xs text-amber-700">{t("sectionExtrasHint")}</p>
          </div>
          <SortableContext items={extraPhotos.slice(0, visibleCount).map((p) => p.id)} strategy={rectSortingStrategy}>
            <PileDropZone id="extras" className="mt-3 grid min-h-[6rem] grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {extraPhotos.length === 0 ? (
                <p className="col-span-full rounded-xl border border-dashed border-warm-300 px-4 py-6 text-center text-sm text-gray-500">{t("sectionExtrasEmpty")}</p>
              ) : (
                extraPhotos.slice(0, visibleCount).map((photo) => (
                  <SortableTile key={photo.id} id={photo.id} disabled={!canDrag}>
                    {(h) => renderTile(photo, canDrag ? h : undefined)}
                  </SortableTile>
                ))
              )}
            </PileDropZone>
          </SortableContext>

          <DragOverlay>
            {dragging && (
              <div className="aspect-square w-32 overflow-hidden rounded-lg border-2 border-accent-400 shadow-2xl ring-4 ring-accent-200/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dragging.thumbnail_url || dragging.url} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {photos.length > 0 && !showSplit && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.slice(0, visibleCount).map((photo) => renderTile(photo))}
        </div>
      )}



      {/* Reachability, not decoration: the panel sits above the gallery so the
          note actually gets written, which means 500 photos later it is far
          off the top — a slim bar takes over the moment it scrolls away.
          Fixed, not sticky — the dashboard's <main> sets overflow-x, which
          turns it into a scrollport and leaves a sticky child with no travel.
          bottom-16 clears the mobile nav. */}
      {photos.length > 0 && !delivered && !sendPanelVisible && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-warm-300 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-end gap-3">
            {counterLine}
            <button
              onClick={handleShare}
              disabled={shareBlocked}
              className="shrink-0 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              {shareLabel}
            </button>
          </div>
        </div>
      )}

      {/* Infinite-scroll sentinel — both piles are batched, so this has to
          live below them or a 500-photo delivery stops at the first 60. */}
      {visibleCount < photos.length && <div ref={gridSentinelRef} className="h-4" />}

      {modal}
    </div>
  );
}
