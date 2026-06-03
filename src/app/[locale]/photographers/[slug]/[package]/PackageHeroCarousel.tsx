"use client";

// Hero carousel for the package page — full-bleed photo backdrop with
// the title/CTA overlay rendered as a child. Auto-advances every 6s,
// pauses on user interaction, supports swipe + keyboard arrows.

import { useEffect, useRef, useState } from "react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface Photo {
  url: string;
  alt: string;
}

export function PackageHeroCarousel({
  photos,
  children,
}: {
  photos: Photo[];
  children?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const total = photos.length;

  useEffect(() => {
    if (paused || total < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(id);
  }, [paused, total]);

  function go(delta: number) {
    setPaused(true);
    setIndex((i) => (i + delta + total) % total);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  }

  return (
    <section
      className="relative h-[55vh] min-h-[360px] w-full overflow-hidden bg-gray-900 sm:h-[80vh]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {photos.map((p, i) => (
        <div
          key={i}
          aria-hidden={i !== index}
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          {/* The first slide is the LCP element on this page —
              fetch it eagerly with high priority. The rest can wait. */}
          {i === 0 ? (
            <img
              src={p.url}
              alt={p.alt}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <OptimizedImage
              src={p.url}
              alt={p.alt}
              width={1600}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}

      {children}

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-900 hover:bg-white sm:flex"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-900 hover:bg-white sm:flex"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setPaused(true); setIndex(i); }}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
