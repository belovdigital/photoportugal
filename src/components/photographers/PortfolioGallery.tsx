"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localizeShootType, canonicalizeShootType } from "@/lib/shoot-type-labels";
import { trackPhotoOpen } from "@/lib/track-events";

interface PortfolioItem {
  /** portfolio_items.id — enables per-photo open stats. Optional so
   *  legacy callers without ids keep working (opens then count only
   *  toward the photographer's total). */
  id?: string;
  url: string;
  thumbnail_url?: string | null;
  caption: string | null;
  location_slug: string | null;
  shoot_type: string | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Row-major masonry: items[0..N-1] live in a single visual row even though the
 * heights stagger (true masonry feel). Achieved by hand-distributing items into
 * N column flex-containers — column k receives indexes [k, N+k, 2N+k, ...].
 *
 * Two layouts rendered side-by-side (mobile 2-col, desktop 3-col) with Tailwind
 * `sm:hidden` / `hidden sm:grid` toggles. No resize listener and no hydration
 * mismatch — the SSR HTML matches the client first paint exactly.
 *
 * Why not CSS `columns`? It flows column-major: with 12 photos in 3 columns
 * the user reads [0,1,2,3 → 4,5,6,7 → 8,9,10,11] going *down* each column,
 * which doesn't match the order the photographer drag-and-dropped in their
 * dashboard. Row-major distribution fixes that.
 */
function RowMasonry<T>({ items, renderItem }: {
  items: T[];
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  function distribute(cols: number) {
    const out: { item: T; idx: number }[][] = Array.from({ length: cols }, () => []);
    items.forEach((it, i) => out[i % cols].push({ item: it, idx: i }));
    return out;
  }
  const cols2 = distribute(2);
  const cols3 = distribute(3);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
        {cols2.map((col, c) => (
          <div key={c} className="flex flex-col gap-3">
            {col.map(({ item, idx }) => renderItem(item, idx))}
          </div>
        ))}
      </div>
      <div className="mt-4 hidden grid-cols-3 gap-3 sm:grid">
        {cols3.map((col, c) => (
          <div key={c} className="flex flex-col gap-3">
            {col.map(({ item, idx }) => renderItem(item, idx))}
          </div>
        ))}
      </div>
    </>
  );
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

/** Stable empty default — a fresh `[]` per render defeats memoization. */
const NO_ITEMS: PortfolioItem[] = [];

export function PortfolioGallery({
  items,
  businessItems = NO_ITEMS,
  locations,
  photographerName,
  photographerSlug,
}: {
  items: PortfolioItem[];
  /** Corporate/B2B photos. Rendered in their own root-level tab so client
   *  work never mixes with leisure shoots; the tab is omitted entirely when
   *  the photographer has no business photos. */
  businessItems?: PortfolioItem[];
  locations: LocationOption[];
  photographerName?: string;
  /** Enables photo_open events for /dashboard/stats. */
  photographerSlug?: string;
}) {
  const t = useTranslations("photographers.portfolioGallery");
  const locale = useLocale();
  const hasBusinessTab = businessItems.length > 0;
  // A photographer who uploaded corporate work only still gets a usable
  // gallery — open on whichever tab actually has photos.
  const [tab, setTab] = useState<"leisure" | "business">(
    items.length === 0 && hasBusinessTab ? "business" : "leisure"
  );
  const activeItems = tab === "business" ? businessItems : items;
  const [filter, setFilter] = useState({ location: "", shootType: "" });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const lightboxScrollerRef = useRef<HTMLDivElement>(null);
  // Tracks whether we've already done the no-animation jump to the index
  // the user clicked on. Prevents the scroller from yanking back when the
  // user has already started swiping.
  const lightboxInitialJumpRef = useRef<number | null>(null);

  const usedLocations = [...new Set(activeItems.map((p) => p.location_slug).filter(Boolean))] as string[];
  // Canonicalize before de-duping so legacy slug/case variants ("wedding"
  // vs "Wedding", "solo" vs "Solo Portrait") collapse to a single pill.
  const usedShootTypes = [...new Set(activeItems.map((p) => canonicalizeShootType(p.shoot_type)).filter(Boolean))] as string[];

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
  // Every photo in the business tab carries the same shoot type, so a
  // "Business" pill there would filter nothing — locations still do.
  const shootTypePills = tab === "business" ? [] : usedShootTypes;
  const hasFilters = usedLocations.length > 0 || shootTypePills.length > 0;

  const filtered = activeItems.filter((item) => {
    if (filter.location && item.location_slug !== filter.location) return false;
    // Compare on the canonical form so a "Wedding" pill also matches photos
    // still tagged "wedding" (and vice-versa) until the data migration lands.
    if (filter.shootType && canonicalizeShootType(item.shoot_type) !== filter.shootType) return false;
    return true;
  });

  // Arrow / keyboard navigation drive the scroll-snap scroller; the
  // lightbox idx then syncs back from scroll position. Mobile users get
  // native swipe with momentum + iOS back-gesture blocked by
  // `overscroll-x-contain` on the scroller.
  const navigate = useCallback((dir: number) => {
    const el = lightboxScrollerRef.current;
    if (!el || lightbox === null) return;
    const next = lightbox + dir;
    if (next < 0 || next >= filtered.length) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, [lightbox, filtered.length]);

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

  // Sync lightbox idx with scroll position (rAF-throttled).
  useEffect(() => {
    if (lightbox === null) return;
    const el = lightboxScrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const next = Math.max(0, Math.min(filtered.length - 1, Math.round(el.scrollLeft / w)));
        setLightbox((prev) => (prev === next ? prev : next));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [lightbox, filtered.length]);

  // Jump the scroller to the photo the user clicked on, exactly once per
  // open. Subsequent navigation goes through `navigate` (smooth scroll).
  useEffect(() => {
    if (lightbox === null) {
      lightboxInitialJumpRef.current = null;
      return;
    }
    if (lightboxInitialJumpRef.current === lightbox) return;
    const el = lightboxScrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: lightbox * el.clientWidth, behavior: "auto" });
    lightboxInitialJumpRef.current = lightbox;
  }, [lightbox]);

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900">{t("title")}</h2>

      {/* Root-level tabs — leisure work and corporate work are separate
          bodies of work and must not share a grid. Only rendered when the
          photographer actually has business photos. */}
      {hasBusinessTab && (
        <div className="mt-3 flex gap-6 border-b border-warm-200">
          {([
            ["leisure", t("tabPersonal"), items.length],
            ["business", t("tabBusiness"), businessItems.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setFilter({ location: "", shootType: "" }); setLightbox(null); }}
              aria-current={tab === key}
              className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${
                tab === key
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {label} <span className="font-normal text-gray-400">({count})</span>
            </button>
          ))}
        </div>
      )}

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
            {t("all", { count: activeItems.length })}
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
          {shootTypePills.map((type) => (
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

      {/* Masonry with reading order: row-major. CSS `columns` flows vertically
          (col-major: items 0,1,2,3 stack in column 0), which makes the order
          confusing — readers expect items 1→2→3 left-to-right across the row.
          We hand-distribute items into N columns by index % N so column 0
          holds items [0,N,2N,...], column 1 [1,N+1,...], etc. Each column is
          a flex-vertical container, so items keep their natural height and we
          retain the staggered masonry look. */}
      <RowMasonry
        items={filtered}
        renderItem={(item, i) => (
          <PortfolioImage
            key={i}
            item={item}
            alt={describePhoto(item)}
            onClick={() => {
              // Position = the photo's index in the photographer's own
              // sort order (not the filtered view) so the stats page can
              // relate clicks to grid placement.
              if (photographerSlug) trackPhotoOpen(photographerSlug, item.id, activeItems.indexOf(item));
              setLightbox(i);
            }}
          />
        )}
      />
      {filtered.length === 0 && activeItems.length > 0 && (
        <p className="mt-4 text-sm text-gray-400">{t("noPhotosMatch")}</p>
      )}

      {/* Lightbox / Slider — native horizontal scroll-snap carousel.
          Mobile gets real Instagram-style swipes (with iOS back-nav blocked
          by `overscroll-x-contain`); desktop gets arrows + keyboard. */}
      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-black/95"
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

          {/* Previous — desktop only; mobile uses native swipe. */}
          {lightbox > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              aria-label={t("previousPhoto")}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Scroll-snap track holding all filtered photos. Each slot is
              full-viewport-wide so swipes feel like Instagram / Airbnb. */}
          <div
            ref={lightboxScrollerRef}
            className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {filtered.map((it, i) => (
              <div
                key={it.url}
                className="snap-center shrink-0 w-full h-full flex items-center justify-center px-2 sm:px-12"
                onClick={() => setLightbox(null)}
              >
                {/* Only mount the image for the active slide and immediate
                    neighbours — keeps a 40-photo gallery from fetching all
                    full-res images on open. */}
                {Math.abs(i - lightbox) <= 1 ? (
                  <LightboxImage
                    item={it}
                    alt={describePhoto(it)}
                  />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
            ))}
          </div>

          {/* Next — desktop only; mobile uses native swipe. */}
          {lightbox < filtered.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              aria-label={t("nextPhoto")}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Counter + caption */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 z-10">
            {filtered[lightbox].caption && (
              <p className="text-sm text-white/80">{filtered[lightbox].caption}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-white/50">
              <span>{lightbox + 1} / {filtered.length}</span>
              <span className="text-white/30 hidden sm:inline">{t("arrowKeysHint")}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
