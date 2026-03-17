"use client";

import { useState, useEffect, useCallback } from "react";

interface PortfolioItem {
  url: string;
  caption: string | null;
  location_slug: string | null;
  shoot_type: string | null;
}

interface LocationOption {
  slug: string;
  name: string;
}

export function PortfolioGallery({
  items,
  locations,
}: {
  items: PortfolioItem[];
  locations: LocationOption[];
}) {
  const [filter, setFilter] = useState({ location: "", shootType: "" });
  const [lightbox, setLightbox] = useState<number | null>(null);

  const usedLocations = [...new Set(items.map((p) => p.location_slug).filter(Boolean))] as string[];
  const usedShootTypes = [...new Set(items.map((p) => p.shoot_type).filter(Boolean))] as string[];
  const hasFilters = usedLocations.length > 0 || usedShootTypes.length > 0;

  const filtered = items.filter((item) => {
    if (filter.location && item.location_slug !== filter.location) return false;
    if (filter.shootType && item.shoot_type !== filter.shootType) return false;
    return true;
  });

  // Keyboard navigation for lightbox
  const navigate = useCallback((dir: number) => {
    setLightbox((prev) => {
      if (prev === null) return null;
      const next = prev + dir;
      if (next < 0 || next >= filtered.length) return prev;
      return next;
    });
  }, [filtered.length]);

  useEffect(() => {
    if (lightbox === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") navigate(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") navigate(-1);
      else if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, navigate]);

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900">Portfolio</h2>

      {/* Filter pills */}
      {hasFilters && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter({ location: "", shootType: "" })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              !filter.location && !filter.shootType
                ? "bg-gray-900 text-white" : "bg-warm-100 text-gray-500 hover:bg-warm-200"
            }`}
          >
            All ({items.length})
          </button>
          {usedLocations.map((slug) => (
            <button
              key={slug}
              onClick={() => setFilter((f) => ({ ...f, location: f.location === slug ? "" : slug }))}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter.location === slug
                  ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
              }`}
            >
              {locations.find((l) => l.slug === slug)?.name || slug}
            </button>
          ))}
          {usedShootTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter((f) => ({ ...f, shootType: f.shootType === type ? "" : type }))}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter.shootType === type
                  ? "bg-accent-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Masonry grid — preserves original aspect ratios */}
      <div className="mt-4 columns-2 gap-3 sm:columns-3">
        {filtered.map((item, i) => (
          <div
            key={i}
            className="mb-3 cursor-pointer overflow-hidden rounded-xl bg-warm-100 break-inside-avoid transition hover:opacity-90"
            onClick={() => setLightbox(i)}
          >
            <img
              src={item.url}
              alt={item.caption || "Portfolio photo"}
              className="w-full"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {filtered.length === 0 && items.length > 0 && (
        <p className="mt-4 text-sm text-gray-400">No photos match this filter.</p>
      )}

      {/* Lightbox / Slider */}
      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous */}
          {lightbox > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image */}
          <img
            src={filtered[lightbox].url}
            alt={filtered[lightbox].caption || "Portfolio photo"}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightbox < filtered.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Counter + caption */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
            {filtered[lightbox].caption && (
              <p className="text-sm text-white/80">{filtered[lightbox].caption}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-white/50">
              <span>{lightbox + 1} / {filtered.length}</span>
              <span className="text-white/30">Use arrow keys to navigate</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
