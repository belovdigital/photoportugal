"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSwipeNavigation } from "@/lib/use-swipe";
import { localizeShootType } from "@/lib/shoot-type-labels";

interface PortfolioItem {
  url: string;
  thumbnail_url?: string | null;
  caption: string | null;
  location_slug: string | null;
  shoot_type: string | null;
  width?: number | null;
  height?: number | null;
}

interface LocationOption {
  slug: string;
  name: string;
}

function getThumbSrc(item: PortfolioItem): string {
  if (item.thumbnail_url) return item.thumbnail_url;
  return item.url.startsWith("/uploads/")
    ? `/api/img/${item.url.replace("/uploads/", "")}?w=600&q=80&f=webp`
    : item.url;
}

function getFullSrc(item: PortfolioItem): string {
  return item.url.startsWith("/uploads/")
    ? `/api/img/${item.url.replace("/uploads/", "")}?w=1200&q=85&f=webp`
    : item.url;
}

function PortfolioImage({ item, alt, onClick }: { item: PortfolioItem; alt: string; onClick: () => void }) {
  const aspectStyle = item.width && item.height
    ? { aspectRatio: `${item.width} / ${item.height}` }
    : undefined;

  return (
    <div
      className="mb-3 cursor-pointer overflow-hidden rounded-xl break-inside-avoid bg-warm-100 transition hover:opacity-90"
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      style={aspectStyle}
    >
      <img
        src={getThumbSrc(item)}
        alt={alt}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover select-none"
      />
    </div>
  );
}

function LightboxImage({ item, alt }: { item: PortfolioItem; alt: string }) {
  const thumbSrc = getThumbSrc(item);
  const fullSrc = getFullSrc(item);
  const [src, setSrc] = useState(thumbSrc);

  useEffect(() => {
    const img = new Image();
    img.src = fullSrc;
    img.onload = () => setSrc(fullSrc);
  }, [fullSrc]);

  return (
    <img
      src={src}
      alt={alt}
      className="h-[90vh] w-[90vw] object-contain select-none"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function PortfolioGallery({
  items,
  locations,
  photographerName,
}: {
  items: PortfolioItem[];
  locations: LocationOption[];
  photographerName?: string;
}) {
  const t = useTranslations("photographers.portfolioGallery");
  const locale = useLocale();
  const [filter, setFilter] = useState({ location: "", shootType: "" });
  const [lightbox, setLightbox] = useState<number | null>(null);

  const usedLocations = [...new Set(items.map((p) => p.location_slug).filter(Boolean))] as string[];
  const usedShootTypes = [...new Set(items.map((p) => p.shoot_type).filter(Boolean))] as string[];

  function describePhoto(item: PortfolioItem): string {
    if (item.caption) return item.caption;
    const parts: string[] = [];
    if (item.shoot_type) parts.push(item.shoot_type.replace(/-/g, " "));
    parts.push("photoshoot");
    if (item.location_slug) {
      const loc = locations.find((l) => l.slug === item.location_slug);
      if (loc) parts.push(`in ${loc.name}`);
    }
    if (photographerName) parts.push(`by ${photographerName}`);
    return parts.join(" ");
  }
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

  useSwipeNavigation({
    enabled: lightbox !== null,
    onPrev: () => navigate(-1),
    onNext: () => navigate(1),
    onDismiss: () => setLightbox(null),
  });

  // Preload adjacent full-res images when lightbox is open
  useEffect(() => {
    if (lightbox === null) return;
    const toPreload = [lightbox - 1, lightbox + 1].filter(i => i >= 0 && i < filtered.length);
    toPreload.forEach(i => {
      const img = new Image();
      img.src = getFullSrc(filtered[i]);
    });
  }, [lightbox, filtered]);

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900">{t("title")}</h2>

      {/* Filter pills */}
      {hasFilters && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter({ location: "", shootType: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              !filter.location && !filter.shootType
                ? "bg-gray-900 text-white" : "bg-warm-100 text-gray-500 hover:bg-warm-200"
            }`}
          >
            {t("all", { count: items.length })}
          </button>
          {usedLocations.map((slug) => (
            <button
              key={slug}
              onClick={() => setFilter((f) => ({ ...f, location: f.location === slug ? "" : slug }))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
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
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter.shootType === type
                  ? "bg-accent-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
              }`}
            >
              {localizeShootType(type, locale)}
            </button>
          ))}
        </div>
      )}

      {/* Masonry grid */}
      <div className="mt-4 columns-2 gap-3 sm:columns-3">
        {filtered.map((item, i) => (
          <PortfolioImage
            key={i}
            item={item}
            alt={describePhoto(item)}
            onClick={() => setLightbox(i)}
          />
        ))}
      </div>

      {filtered.length === 0 && items.length > 0 && (
        <p className="mt-4 text-sm text-gray-400">{t("noPhotosMatch")}</p>
      )}

      {/* Lightbox / Slider */}
      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          role="dialog"
          aria-label={t("photoViewer")}
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            aria-label={t("closeLightbox")}
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
              aria-label={t("previousPhoto")}
              className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image — progressive: show thumb instantly, swap to full when loaded */}
          <LightboxImage
            key={lightbox}
            item={filtered[lightbox]}
            alt={describePhoto(filtered[lightbox])}
          />

          {/* Next */}
          {lightbox < filtered.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              aria-label={t("nextPhoto")}
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
              <span className="text-white/30">{t("arrowKeysHint")}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
