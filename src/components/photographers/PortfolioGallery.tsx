"use client";

import { useState } from "react";

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

      {/* Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((item, i) => (
          <div
            key={i}
            className="group cursor-pointer aspect-square overflow-hidden rounded-xl bg-warm-100"
            onClick={() => setLightbox(i)}
          >
            <img
              src={item.url}
              alt={item.caption || "Portfolio photo"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {filtered.length === 0 && items.length > 0 && (
        <p className="mt-4 text-sm text-gray-400">No photos match this filter.</p>
      )}

      {/* Lightbox */}
      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {lightbox > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <img
            src={filtered[lightbox].url}
            alt={filtered[lightbox].caption || "Portfolio photo"}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox < filtered.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {lightbox + 1} / {filtered.length}
          </div>
        </div>
      )}
    </section>
  );
}
