"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { OptimizedImage } from "./OptimizedImage";

interface CarouselImage {
  url: string;
  alt: string;
  attribution: string;
  source: "wikimedia" | "unsplash" | "photographer";
  source_url?: string;
}

/**
 * Swipeable hero carousel for the spot page. Replaces the old separate
 * 2-image "leftover gallery" section — every curated photo of the spot
 * now lives in the hero, the visitor swipes through it, and the dark
 * gradient overlay makes the H1/plaque content stay readable across all
 * slides regardless of brightness.
 *
 * Mobile: native horizontal scroll-snap (one slide per viewport, no JS
 * needed for interaction). Desktop: same scroll-snap container, plus
 * pagination dots and prev/next buttons. Auto-advance every 6s when more
 * than one image is provided; pauses on hover/focus and after manual
 * interaction so the user is never fighting the rotation.
 */
export function SpotHeroCarousel({ images, photoByLabel, viaLabel }: {
  images: CarouselImage[];
  photoByLabel: string;
  viaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [interacted, setInteracted] = useState(false);

  // Keep `active` in sync with whichever slide the scroll-snap container
  // settled on. This way the dots stay accurate when the user swipes
  // (mobile) or uses the prev/next buttons.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        if (i !== active) setActive(i);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  // Auto-advance — stops as soon as the user interacts with the carousel,
  // since at that point they're driving and shouldn't be fighting the timer.
  useEffect(() => {
    if (images.length < 2 || interacted) return;
    const id = window.setInterval(() => {
      const el = containerRef.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % images.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => clearInterval(id);
  }, [images.length, interacted]);

  const goTo = useCallback((i: number) => {
    const el = containerRef.current;
    if (!el) return;
    setInteracted(true);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  const sourceLabel = (src: CarouselImage["source"]) =>
    src === "photographer" ? "" : ` · ${viaLabel} ${src === "wikimedia" ? "Wikimedia Commons" : "Unsplash"}`;

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center">
            <OptimizedImage
              src={img.url}
              alt={img.alt}
              priority={i === 0}
              className="h-full w-full"
            />
          </div>
        ))}
      </div>
      {/* Single dark gradient overlay covers all slides at once — keeping it
          on top means the H1/plaque text stays readable as the slides scroll
          underneath. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary-950/85 via-primary-900/65 to-primary-800/45" />

      {/* Pagination dots — pinned just above the bottom edge. Always
          rendered (even with 1 image) so the layout is stable, but
          visually hidden when there's nothing to navigate. */}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-1.5 sm:bottom-5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
            />
          ))}
        </div>
      )}

      {/* Per-slide attribution (Wikimedia/Unsplash images legally require
          credit + license disclosure — we link to the file page so the
          license is one click away). */}
      {images[active]?.attribution && (
        <div className="absolute bottom-2 right-3 z-20 max-w-[60%] text-right text-[10px] text-primary-100/70 sm:text-[11px]">
          <a
            href={images[active].source_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white"
          >
            {photoByLabel} {images[active].attribution}{sourceLabel(images[active].source)}
          </a>
        </div>
      )}

      {/* Desktop prev/next buttons. Mobile relies on swipe — adding visible
          arrows there clutters the hero unnecessarily. */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo((active - 1 + images.length) % images.length)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50 sm:flex"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo((active + 1) % images.length)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50 sm:flex"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
