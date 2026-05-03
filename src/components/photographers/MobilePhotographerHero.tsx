"use client";

import { useState } from "react";
import { lazy, Suspense } from "react";
import { normalizeName } from "@/lib/format-name";
import { ActiveBadge } from "@/components/ui/ActiveBadge";

// Lazy-load lightbox — heavy, mounts only on first cover tap.
const PhotographerLightbox = lazy(() =>
  import("@/components/ui/PhotographerLightbox").then((m) => ({ default: m.PhotographerLightbox })),
);

/**
 * Conversion-first mobile hero for /photographers/[slug]: above-the-fold
 * is dominated by the photographer's actual work (swipeable cover photo
 * carousel, ~55vh tall) with a thin info overlay at the bottom — name,
 * rating, response time. No summer notice, shoot-type chips, or location
 * lists here; those live further down where intent is lower. Tapping any
 * photo opens the same lightbox the cards use, giving visitors the full
 * portfolio in one motion.
 *
 * Hidden on lg+ via the parent's `lg:hidden` wrapper — desktop keeps its
 * existing avatar+text hero.
 */
export function MobilePhotographerHero({
  slug,
  name,
  isVerified,
  isFeatured,
  isFounding,
  rating,
  reviewCount,
  lastSeenAt,
  responseLabel,
  primaryLocationName,
  thumbnails,
  coverPositionY,
}: {
  slug: string;
  name: string;
  isVerified: boolean;
  isFeatured: boolean;
  isFounding: boolean;
  rating: number;
  reviewCount: number;
  lastSeenAt: string | null;
  responseLabel: string | null;
  primaryLocationName: string | null;
  thumbnails: string[];
  coverPositionY: number | null;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const total = thumbnails.length;
  const cleanName = normalizeName(name);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const w = el.clientWidth || 1;
    const next = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / w)));
    if (next !== activeIdx) setActiveIdx(next);
  }

  return (
    <div className="relative bg-gray-900 lg:hidden">
      {/* Photo carousel — full-bleed mobile, ~55vh tall. Native scroll-snap
          for the swipe + iOS overscroll-x-contain blocks the back-nav
          gesture so swiping never yanks the page out from under us. */}
      {total > 0 ? (
        <div
          onScroll={handleScroll}
          className="flex h-[55svh] min-h-[360px] overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {thumbnails.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`Open photo ${i + 1} of ${total}`}
              className="snap-center shrink-0 w-full h-full focus:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${cleanName} portfolio photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding={i === 0 ? "sync" : "async"}
                className="h-full w-full object-cover"
                style={{ objectPosition: i === 0 && coverPositionY != null ? `center ${coverPositionY}%` : "center" }}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex h-[55svh] min-h-[360px] items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 text-white text-2xl font-bold">
          {cleanName.charAt(0)}
        </div>
      )}

      {/* Dot indicator */}
      {total > 1 && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1">
          {thumbnails.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${i === activeIdx ? "w-4 bg-white" : "w-1 bg-white/60"}`}
            />
          ))}
        </div>
      )}

      {/* Bottom-overlay info bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-white drop-shadow truncate">
            {cleanName}
          </h1>
          {isVerified && (
            <svg className="h-5 w-5 shrink-0 text-sky-400" fill="currentColor" viewBox="0 0 20 20" aria-label="Verified">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {isFeatured && (
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-yellow-900">Featured</span>
          )}
          {isFounding && !isFeatured && (
            <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold text-white">Founding</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
          {reviewCount > 0 && (
            <a href="#reviews" className="pointer-events-auto inline-flex items-center gap-1">
              <span className="text-amber-400">⭐</span>
              <strong className="font-bold">{Number(rating).toFixed(1)}</strong>
              <span className="text-white/70">({reviewCount})</span>
            </a>
          )}
          {primaryLocationName && (
            <span className="inline-flex min-w-0 max-w-[48vw] items-center gap-1 text-white/80">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="truncate">{primaryLocationName}</span>
            </span>
          )}
          {responseLabel && (
            <span className="text-white/70 text-xs">{responseLabel}</span>
          )}
          <span className="pointer-events-auto inline-flex">
            <ActiveBadge lastSeenAt={lastSeenAt} size="sm" />
          </span>
        </div>
      </div>

      {/* Lightbox — opens on photo tap, mounts lazily. */}
      {lightboxOpen && (
        <Suspense fallback={null}>
          <PhotographerLightbox
            slug={slug}
            name={cleanName}
            initialUrl={thumbnails[activeIdx]}
            onClose={() => setLightboxOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
