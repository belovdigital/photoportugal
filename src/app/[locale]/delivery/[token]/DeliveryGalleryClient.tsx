"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
}

function formatDuration(s: number | null | undefined): string {
  if (!s || s <= 0) return "";
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function DeliveryGalleryClient({ photos, deliveryAccepted }: { photos: Photo[]; deliveryAccepted: boolean }) {
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

  // Each photo gets its ORIGINAL index baked in so renderCell can open
  // the lightbox at the right slot regardless of which column it lives
  // in. Distributed once per column-count.
  const indexed = useMemo(() => photos.map((p, i) => ({ p, i })), [photos]);
  const cols2 = useMemo(() => distributeRowMajor(indexed, 2), [indexed]);
  const cols3 = useMemo(() => distributeRowMajor(indexed, 3), [indexed]);
  const cols4 = useMemo(() => distributeRowMajor(indexed, 4), [indexed]);

  function renderCell(photo: Photo, index: number) {
    const isVideo = photo.media_type === "video";
    const thumb = photo.thumbnail_url || photo.preview_url || photo.url;
    return (
      <div
        key={photo.id}
        className="cursor-pointer overflow-hidden rounded-lg bg-warm-100 transition hover:opacity-90 relative"
        onClick={() => openLightbox(index)}
      >
        <img
          src={thumb}
          alt={photo.filename}
          loading="lazy"
          className="w-full block"
        />
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
            <div className="rotate-[-12deg] text-[18px] font-bold uppercase tracking-widest text-white/35 select-none whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
              Photo Portugal
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Masonry gallery built from JS-distributed flex columns. We render
          three responsive variants (2 / 3 / 4 cols) and toggle visibility
          per breakpoint. CSS `columns-N` was broken on Safari — it
          collapsed to 1 column whenever images lazy-loaded. Flex columns
          are rock solid. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
        {cols2.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map(({ p, i }) => renderCell(p, i))}
          </div>
        ))}
      </div>
      <div className="mt-6 hidden grid-cols-3 gap-3 sm:grid md:hidden">
        {cols3.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map(({ p, i }) => renderCell(p, i))}
          </div>
        ))}
      </div>
      <div className="mt-6 hidden grid-cols-4 gap-3 md:grid">
        {cols4.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map(({ p, i }) => renderCell(p, i))}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          role="dialog"
          aria-label={t("photoViewer")}
          onClick={closeLightbox}
        >
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
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <video
                key={photos[lightboxIndex].id}
                src={photos[lightboxIndex].url}
                poster={photos[lightboxIndex].thumbnail_url ?? undefined}
                controls
                autoPlay
                playsInline
                className="block max-h-[90vh] max-w-[90vw] select-none"
              />
              {!deliveryAccepted && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rotate-[-15deg] text-3xl sm:text-5xl font-bold uppercase tracking-widest text-white/30 select-none whitespace-nowrap" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                    Photo Portugal
                  </div>
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
