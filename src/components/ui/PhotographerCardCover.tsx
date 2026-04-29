"use client";

import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useTranslations } from "next-intl";
import { normalizeName } from "@/lib/format-name";

// Lightbox is heavy — load only on first open.
const PhotographerLightbox = lazy(() =>
  import("./PhotographerLightbox").then((m) => ({ default: m.PhotographerLightbox })),
);

/**
 * Carousel cover with native horizontal scroll-snap.
 *
 * Why scroll-snap instead of opacity cross-fade:
 *   - Mobile users expect swipe to feel like Instagram / Airbnb. CSS
 *     `snap-x snap-mandatory` gives that for free, with momentum + bounce
 *     handled by the browser.
 *   - Arrow buttons on desktop call `scrollBy({ left: width, behavior: "smooth" })`
 *     so the same scroller drives both inputs.
 *   - The active index syncs from the scroll position (rAF-throttled), so
 *     dot indicators always match what's visible.
 *
 * Loading: only the cover (idx 0) gets a real `<img>` on first paint. Other
 * slides are placeholder `<div>`s until either (a) the card scrolls near the
 * viewport, at which point we mount their `<img>`s with `loading="lazy"`,
 * or (b) the user begins swiping. Keeps initial DOM small on /photographers
 * with 50+ cards.
 *
 * Click on the image area opens a full lightbox; arrow buttons sit inside
 * the scroller as an overlay so a tap on them never bubbles into a swipe.
 */
export function PhotographerCardCover({
  slug,
  name,
  thumbnails,
  coverPositionY,
  height = "h-44",
  altPrefix,
}: {
  slug: string;
  name: string;
  thumbnails: string[];
  coverPositionY?: number | null;
  height?: string;
  altPrefix?: string;
}) {
  const t = useTranslations("photographers.card");
  const [idx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mountAll, setMountAll] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const total = thumbnails.length;

  // Mount all slides as soon as the card scrolls anywhere near the viewport.
  // We could lazy-render only on swipe, but that creates a one-frame gap on
  // the first swipe; pre-mounting once near-viewport is the right tradeoff.
  useEffect(() => {
    if (total <= 1) {
      setMountAll(true);
      return;
    }
    const el = wrapRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setMountAll(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setMountAll(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [total]);

  // Sync active idx with scroll position (rAF-throttled).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || total <= 1) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const next = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / w)));
        setIdx(next);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [total]);

  function go(delta: number, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = scrollerRef.current;
    if (!el || total <= 1) return;
    const w = el.clientWidth;
    const target = Math.max(0, Math.min(total - 1, idx + delta));
    el.scrollTo({ left: target * w, behavior: "smooth" });
  }

  function openLightbox(e: React.MouseEvent) {
    if (total === 0) return;
    e.stopPropagation();
    e.preventDefault();
    setLightboxOpen(true);
  }

  return (
    <div
      ref={wrapRef}
      className={`group/cover relative ${height} bg-gradient-to-br from-primary-400 to-primary-700 overflow-hidden`}
    >
      {/* Native scroll-snap track. `overscroll-x-contain` so a horizontal
          swipe doesn't trigger the browser's back-nav gesture on iOS. */}
      <div
        ref={scrollerRef}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {thumbnails.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={openLightbox}
            aria-label={t("openLightbox")}
            className="snap-start shrink-0 w-full h-full focus:outline-none cursor-zoom-in"
          >
            {(i === 0 || mountAll) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={altPrefix ? `${altPrefix} ${normalizeName(name)}` : `${normalizeName(name)} portfolio`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding={i === 0 ? "sync" : "async"}
                className="h-full w-full object-cover"
                style={{ objectPosition: i === 0 && coverPositionY != null ? `center ${coverPositionY}%` : "center" }}
              />
            ) : (
              // Placeholder until the card nears viewport — keeps `flex` widths
              // correct so scrollLeft math works even before lazy mount.
              <div className="h-full w-full" />
            )}
          </button>
        ))}
      </div>

      {/* Arrows — desktop only, fade in on hover. Tapping them never reaches
          the snap track because the buttons sit above with their own onClick. */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => go(-1, e)}
            aria-label="Previous photo"
            className={`hidden sm:flex absolute left-0 top-0 bottom-0 z-10 w-12 items-center justify-start pl-1 transition opacity-0 group-hover/cover:opacity-100 ${idx === 0 ? "pointer-events-none !opacity-0" : ""}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow ring-1 ring-black/5 hover:bg-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => go(1, e)}
            aria-label="Next photo"
            className={`hidden sm:flex absolute right-0 top-0 bottom-0 z-10 w-12 items-center justify-end pr-1 transition opacity-0 group-hover/cover:opacity-100 ${idx === total - 1 ? "pointer-events-none !opacity-0" : ""}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow ring-1 ring-black/5 hover:bg-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>

          {/* Dot indicator pinned to bottom edge — driven by the synced idx */}
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {thumbnails.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === idx ? "w-3 bg-white" : "w-1 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}

      {lightboxOpen && (
        <Suspense fallback={null}>
          <PhotographerLightbox
            slug={slug}
            name={name}
            initialUrl={thumbnails[idx]}
            onClose={() => setLightboxOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
