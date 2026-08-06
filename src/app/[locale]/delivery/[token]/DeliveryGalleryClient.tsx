"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useSwipeNavigation } from "@/lib/use-swipe";

/** Distribute items into N flex columns row-major (col k gets indexes
 *  [k, N+k, 2N+k, ...]). Used INSTEAD of CSS `columns-N` because Safari
 *  occasionally re-flows multi-column layouts down to 1 column while
 *  images lazy-load — flex columns are rock solid by comparison. */
function distributeRowMajor<T>(items: T[], cols: number): T[][] {
  const out: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => out[i % cols].push(it));
  return out;
}

interface Photo {
  id: string;
  url: string;
  filename: string;
  file_size: number;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  media_type?: "image" | "video";
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  /** Shot, but not part of this delivery and not bought — for sale. Carries
   *  the watermarked file only; the server never puts an original in it. */
  locked?: boolean;
}

function formatDuration(s: number | null | undefined): string {
  if (!s || s <= 0) return "";
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function DeliveryGalleryClient({
  photos,
  deliveryAccepted,
  selectedExtras,
  onToggleExtra,
  giftLeft = 0,
}: {
  photos: Photo[];
  deliveryAccepted: boolean;
  selectedExtras?: Set<string>;
  onToggleExtra?: (id: string) => void;
  /** Free picks the photographer granted and the client has not spent yet.
   *  While this is above zero a tap redeems immediately instead of basketing. */
  giftLeft?: number;
}) {
  const t = useTranslations("delivery");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function openLightbox(index: number) {
    setLightboxIndex(index);
  }

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const navigate = useCallback((dir: number) => {
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const next = prev + dir;
      if (next >= 0 && next < photos.length) return next;
      return prev;
    });
  }, [photos.length]);

  // Keyboard support
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, closeLightbox, navigate]);

  useSwipeNavigation({
    enabled: lightboxIndex !== null,
    onPrev: () => navigate(-1),
    onNext: () => navigate(1),
    onDismiss: closeLightbox,
  });

  // Progressive batching: with the 500-photo delivery limit, rendering
  // everything at once means up to ~1500 DOM cells (three responsive
  // grid variants) and a 75-150MB thumbnail stampede that OOMs mobile
  // Safari. Render a prefix and grow it as the visitor approaches the
  // bottom (IntersectionObserver sentinel). Slicing a PREFIX keeps the
  // baked-in lightbox indexes valid, and the lightbox itself can still
  // navigate the full set.
  const BATCH = 40;
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const visiblePhotos = useMemo(() => photos.slice(0, visibleCount), [photos, visibleCount]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Growth is gated on images actually LOADING, not just the sentinel
  // being visible: unloaded cells have zero height (dims are NULL on
  // legacy rows), so the whole grid starts collapsed, the sentinel sits
  // "in view", and a naive observer cascades every batch at once — the
  // exact stampede this batching exists to prevent.
  const sentinelVisibleRef = useRef(false);
  const loadedCountRef = useRef(0);
  const tryGrow = useCallback(() => {
    if (!sentinelVisibleRef.current) return;
    setVisibleCount((c) => {
      if (c >= photos.length) return c;
      if (loadedCountRef.current < c * 0.5) return c; // wait for the current window
      return Math.min(c + BATCH, photos.length);
    });
  }, [photos.length]);
  useEffect(() => {
    if (visibleCount >= photos.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        sentinelVisibleRef.current = entries.some((e) => e.isIntersecting);
        tryGrow();
      },
      // Start fetching the next batch well before the visitor hits the
      // bottom so scrolling never visibly stalls.
      { rootMargin: "1800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, photos.length, tryGrow]);

  // Each photo gets its ORIGINAL index baked in so renderCell can open
  // the lightbox at the right slot regardless of which column it lives
  // in. Distributed once per column-count.
  const indexed = useMemo(() => visiblePhotos.map((p, i) => ({ p, i })), [visiblePhotos]);

  // Two groups, because "yours" and "for sale" are different things and mixing
  // them made a client hunt for which tiles were which. Owned = in the package
  // or already taken (gift or purchase); the rest are still on offer.
  const ownedIndexed = useMemo(() => indexed.filter(({ p }) => !p.locked), [indexed]);
  const lockedIndexed = useMemo(() => indexed.filter(({ p }) => p.locked), [indexed]);
  const split = lockedIndexed.length > 0 && ownedIndexed.length > 0;

  function renderCell(photo: Photo, index: number) {
    const isVideo = photo.media_type === "video";
    const thumb = photo.thumbnail_url || photo.preview_url || photo.url;
    const locked = photo.locked === true;
    const picked = locked && !!selectedExtras?.has(photo.id);
    return (
      <div
        key={photo.id}
        className={`cursor-pointer overflow-hidden rounded-lg bg-warm-100 transition hover:opacity-90 relative${picked ? " ring-2 ring-primary-500" : ""}`}
        onClick={() => openLightbox(index)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          src={thumb}
          alt={photo.filename}
          loading="lazy"
          decoding="async"
          className="w-full block select-none"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
          onLoad={() => { loadedCountRef.current += 1; tryGrow(); }}
          onError={() => { loadedCountRef.current += 1; tryGrow(); }}
        />
        {locked && (
          /* A bare "+" in a 28px circle told nobody anything, and on a phone it
             was barely a tap target. A labelled pill across the bottom says what
             pressing it does, and the whole tile is clickable anyway. */
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-2 pt-8">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleExtra?.(photo.id); }}
              /* Translucent so the photograph underneath still reads — this is
                 the thing the client is deciding about. */
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold shadow-lg ring-1 ring-black/10 backdrop-blur-sm transition hover:brightness-105 ${
                picked ? "bg-green-600/90 text-white" : giftLeft > 0 ? "bg-accent-600/90 text-white" : "bg-white/75 text-gray-900"
              }`}
            >
              {picked ? `✓ ${t("extraPicked")}` : giftLeft > 0 ? `🎁 ${t("extraPickFree")}` : `＋ ${t("extraPick")}`}
            </button>
          </div>
        )}
        {isVideo && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                <svg className="h-6 w-6 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {photo.duration_seconds ? (
              <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                {formatDuration(photo.duration_seconds)}
              </span>
            ) : null}
          </>
        )}
        {isVideo && !deliveryAccepted && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <img
              src="/icon-512.png"
              alt=""
              aria-hidden="true"
              className="w-1/5 max-w-[64px] select-none opacity-30 mix-blend-screen"
              draggable={false}
            />
          </div>
        )}
      </div>
    );
  }

  function renderMasonry(items: { p: Photo; i: number }[]) {
    const c2 = distributeRowMajor(items, 2);
    const c3 = distributeRowMajor(items, 3);
    const c4 = distributeRowMajor(items, 4);
    return (
      <>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
          {c2.map((col, ci) => <div key={ci} className="flex flex-col gap-3">{col.map(({ p, i }) => renderCell(p, i))}</div>)}
        </div>
        <div className="mt-4 hidden grid-cols-3 gap-3 sm:grid md:hidden">
          {c3.map((col, ci) => <div key={ci} className="flex flex-col gap-3">{col.map(({ p, i }) => renderCell(p, i))}</div>)}
        </div>
        <div className="mt-4 hidden grid-cols-4 gap-3 md:grid">
          {c4.map((col, ci) => <div key={ci} className="flex flex-col gap-3">{col.map(({ p, i }) => renderCell(p, i))}</div>)}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Masonry gallery built from JS-distributed flex columns. We render
          three responsive variants (2 / 3 / 4 cols) and toggle visibility
          per breakpoint. CSS `columns-N` was broken on Safari — it
          collapsed to 1 column whenever images lazy-loaded. Flex columns
          are rock solid. */}
      {split ? (
        <>
          {/* A hairline rule between two walls of thumbnails was invisible.
              Each group gets a real header — icon, size, and one line saying
              what the group IS — and the paid group sits inside a tinted
              panel so it reads as a different place, not a scroll position. */}
          <div className="mt-10 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-xl text-green-700">✓</span>
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                {t("sectionYours", { count: ownedIndexed.length })}
              </h3>
              <p className="text-sm text-gray-500">{t("sectionYoursHint")}</p>
            </div>
          </div>
          {renderMasonry(ownedIndexed)}

          <div className="mt-12 rounded-3xl border-2 border-amber-200 bg-amber-50/60 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xl">
                {giftLeft > 0 ? "🎁" : "＋"}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-bold leading-tight text-amber-900 sm:text-3xl">
                  {t("sectionOnOffer", { count: lockedIndexed.length })}
                </h3>
                <p className="text-sm text-amber-800">
                  {giftLeft > 0 ? t("sectionOnOfferFree", { count: giftLeft }) : t("sectionOnOfferPaid")}
                </p>
              </div>
            </div>
            {renderMasonry(lockedIndexed)}
          </div>
        </>
      ) : (
        renderMasonry(indexed)
      )}

      {/* Batch-loading sentinel — grows the grid before the bottom is reached. */}
      {visibleCount < photos.length && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          role="dialog"
          aria-label={t("photoViewer")}
          onClick={closeLightbox}
        >
          {/* Deciding happens at full size, so the choice lives here too. */}
          {photos[lightboxIndex].locked && onToggleExtra && (
            <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onToggleExtra(photos[lightboxIndex!].id)}
                className={`rounded-2xl px-8 py-4 text-base font-bold shadow-2xl transition ${
                  selectedExtras?.has(photos[lightboxIndex].id)
                    ? "bg-green-600 text-white"
                    : giftLeft > 0 ? "bg-accent-600 text-white" : "bg-white text-gray-900"
                }`}
              >
                {selectedExtras?.has(photos[lightboxIndex].id)
                  ? `✓ ${t("extraPicked")}`
                  : giftLeft > 0 ? `🎁 ${t("extraPickFree")}` : `＋ ${t("extraPick")} · €2.90`}
              </button>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={closeLightbox}
            aria-label={t("close")}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              aria-label={t("previous")}
              className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Lightbox content — render <video> for video items, <img> for
              photos. Both stop propagation so clicking the media doesn't
              close the lightbox (only the dark backdrop closes it).
              Pre-acceptance: video gets an HTML watermark overlay (photos
              are already watermarked server-side via the preview JPEG). */}
          {photos[lightboxIndex].media_type === "video" ? (
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
              <video
                key={photos[lightboxIndex].id}
                src={photos[lightboxIndex].url}
                poster={photos[lightboxIndex].thumbnail_url ?? undefined}
                controls
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                autoPlay
                playsInline
                onContextMenu={(e) => e.preventDefault()}
                className="block max-h-[90vh] max-w-[90vw] select-none"
              />
              {!deliveryAccepted && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <img
                    src="/icon-512.png"
                    alt=""
                    aria-hidden="true"
                    className="w-1/3 max-w-[256px] select-none opacity-30 mix-blend-screen"
                    draggable={false}
                  />
                </div>
              )}
            </div>
          ) : (
            <img
              src={photos[lightboxIndex].url}
              alt={photos[lightboxIndex].filename}
              className="max-h-[90vh] max-w-[90vw] object-contain select-none"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}

          {/* Next */}
          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              aria-label={t("next")}
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Counter + download */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4">
            <span className="text-sm text-white/70">
              {lightboxIndex + 1} / {photos.length}
            </span>
            {deliveryAccepted ? (
              <a
                href={photos[lightboxIndex].url}
                download={photos[lightboxIndex].filename}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("download")}
              </a>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white/50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t("acceptToDownload")}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
