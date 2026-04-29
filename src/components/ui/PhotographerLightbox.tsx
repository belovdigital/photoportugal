"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { normalizeName } from "@/lib/format-name";
import { Link } from "@/i18n/navigation";

/**
 * Modal photo viewer triggered from a photographer card. Loads the full
 * portfolio (up to 40 photos) on first open. Esc / arrow keys / native
 * swipe / overlay tap to close, arrows + thumbnails to navigate.
 *
 * Image navigation uses CSS scroll-snap (same pattern as
 * `PhotographerCardCover`). Each photo is a full-viewport-wide snap-center
 * slot; the user just swipes. `overscroll-x-contain` blocks the iOS
 * back-navigation gesture so swiping in the lightbox can't pull the page
 * out from under it.
 */
export function PhotographerLightbox({
  slug,
  name,
  initialUrl,
  onClose,
}: {
  slug: string;
  name: string;
  initialUrl?: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<{ url: string; caption: string | null }[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Latches once the initial fetch has placed the user on `startAt`. Any
  // further setIdx (arrow clicks, thumbnail clicks) must NOT be overwritten
  // by a slow fetch resolving — that was the "right arrow jumps back" bug.
  const initialIdxLatched = useRef(false);
  // Tracks whether we've already done the no-animation jump to the initial
  // photo on first items render — without this, every items state update
  // would yank the carousel back to startAt.
  const initialScrolledRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Keep the active thumbnail visible in the bottom strip — but use
  // `inline: "nearest"`, which is a no-op when the thumb is already in the
  // viewport. Centering on every idx change felt jumpy on first open.
  useEffect(() => {
    const el = thumbRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [idx]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/photographers/${slug}/portfolio`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { items: { url: string; caption: string | null }[] }) => {
        if (cancelled) return;
        const apiList = d.items || [];
        // The lightbox shows the *portfolio* — items photographers explicitly
        // curated. The cover image (a separate field) doesn't belong in that
        // sequence; if the visitor opened the lightbox by tapping the cover
        // slide, we just start them on portfolio[0] rather than prepending
        // the cover (which would visually disappear after Right arrow and
        // feel like a glitch).
        let finalList = apiList;
        let startAt = 0;
        if (initialUrl) {
          const found = apiList.findIndex((it) => it.url === initialUrl);
          if (found >= 0) startAt = found;
        }
        if (finalList.length === 0 && initialUrl) {
          // Empty portfolio — fall back to whatever the user clicked on so
          // we never render a blank modal.
          finalList = [{ url: initialUrl, caption: null }];
        }
        setItems(finalList);
        if (!initialIdxLatched.current) {
          setIdx(startAt);
          initialIdxLatched.current = true;
        }
      })
      .catch(() => {
        if (cancelled) return;
        setItems(initialUrl ? [{ url: initialUrl, caption: null }] : []);
      });
    return () => { cancelled = true; };
  }, [slug, initialUrl]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const total = items?.length ?? 0;

  // Sync idx with scroll position (rAF-throttled). Same shape as
  // PhotographerCardCover — Math.round on scrollLeft / clientWidth gives the
  // index of the slot currently centered.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || total <= 1) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const next = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / w)));
        setIdx((prev) => (prev === next ? prev : next));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [total]);

  // Jump the scroller to the initial photo without animation, exactly once
  // when items first arrive. Subsequent idx changes drive scroll via `go`
  // and the keyboard handler — never via this effect.
  useEffect(() => {
    if (!items || total === 0 || initialScrolledRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "auto" });
    initialScrolledRef.current = true;
  }, [items, total, idx]);

  const go = useCallback((delta: number) => {
    if (total <= 1) return;
    const el = scrollerRef.current;
    if (!el) return;
    const next = (idx + delta + total) % total;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, [total, idx]);

  const jumpTo = useCallback((target: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, go]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${normalizeName(name)} portfolio`}
    >
      {/* Top bar */}
      <div
        className="relative flex items-center justify-between px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{normalizeName(name)}</p>
          {total > 0 && (
            <p className="text-xs text-white/60 tabular-nums">{idx + 1} / {total}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/photographers/${slug}`}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            View profile →
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image area — native horizontal scroll-snap carousel. Each slot is a
          full-viewport-wide snap-center, so swipes feel like Instagram /
          Airbnb and arrow clicks call `scrollTo` on the same scroller.
          `overscroll-x-contain` blocks iOS back-navigation gesture. */}
      <div
        className="relative flex-1 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {!items && (
          <div className="flex h-full items-center justify-center text-white/60 text-sm">Loading portfolio…</div>
        )}
        {items && total === 0 && (
          <div className="flex h-full items-center justify-center text-white/60 text-sm">No portfolio photos yet</div>
        )}
        {items && total > 0 && (
          <div
            ref={scrollerRef}
            className="flex h-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((it, i) => (
              <div
                key={it.url}
                className="snap-center shrink-0 w-full h-full flex items-center justify-center px-2 sm:px-12"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.url}
                  alt={it.caption || `${normalizeName(name)} portfolio`}
                  // Eager-load only the active slide and its immediate
                  // neighbours; the rest stay lazy so a 40-photo portfolio
                  // doesn't fetch all images on open.
                  loading={Math.abs(i - idx) <= 1 ? "eager" : "lazy"}
                  decoding={Math.abs(i - idx) <= 1 ? "sync" : "async"}
                  className="max-h-[85vh] max-w-full h-auto w-auto object-contain"
                />
              </div>
            ))}
          </div>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label="Previous"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label="Next"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Bottom thumbnail strip */}
      {items && total > 1 && (
        <div
          ref={stripRef}
          className="flex gap-1.5 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it, i) => (
            <button
              key={it.url}
              ref={(el) => { thumbRefs.current[i] = el; }}
              type="button"
              onClick={() => jumpTo(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-md transition ${i === idx ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
