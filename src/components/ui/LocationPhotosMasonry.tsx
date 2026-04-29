"use client";

import { useTranslations } from "next-intl";

export interface LocationMasonryPhoto {
  url: string;
  width: number | null;
  height: number | null;
  photographer: {
    slug: string;
    name: string;
    avatar_url: string | null;
  };
}

/**
 * Block 3 of the location landing page — photos shot in this location by
 * the platform's photographers, rendered with two responsive layouts:
 *
 *   - Mobile (< lg): horizontal scroll-snap carousel where each slot is a
 *     fixed-height card (~70svh) and the WIDTH is derived from the photo's
 *     natural aspect ratio (`calc(height * w/h)`). Mixed orientations work
 *     out naturally — portraits become slim slots (~50vw), panoramas wide
 *     (~140vw, peeking past the viewport edge). `snap-start` aligns each
 *     card's left edge to the screen so the next photo always peeks in
 *     from the right, signalling swipeability. `overscroll-x-contain` blocks
 *     the iOS back-navigation gesture so swiping never yanks the page out.
 *
 *   - Desktop (lg+): 3-column row-major masonry. Cell aspect comes from the
 *     photo's natural dims so images render uncropped. Hovering a cell
 *     reveals a gradient overlay with the photographer's avatar + name and
 *     a "open profile" chevron.
 *
 * Both layouts open the photographer's profile in a new tab on click —
 * keeps the visitor on the location LP they were exploring while letting
 * them dig into a specific photographer alongside.
 */
export function LocationPhotosMasonry({ photos }: { photos: LocationMasonryPhoto[] }) {
  const t = useTranslations("locations.detail");

  if (photos.length === 0) return null;

  const cols = distributeBalanced(photos, 3);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-6 sm:mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("realPhotos.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 sm:mt-2 sm:text-base">
              {t("realPhotos.subtitle")}
            </p>
          </div>
        </div>

        {/* Mobile: horizontal swipe carousel with peek of next photo */}
        <div className="-mx-4 sm:-mx-6 lg:hidden">
          <div className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain scroll-pl-4 sm:scroll-pl-6 px-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photos.map((p, i) => (
              <PhotoCard
                key={`m-${p.url}-${i}`}
                photo={p}
                viewProfileText={t("realPhotos.viewProfile")}
                variant="mobile"
              />
            ))}
          </div>
        </div>

        {/* Desktop: 3-col row-major masonry. Hover overlay shows attribution. */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4 xl:gap-5">
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-4 xl:gap-5">
              {col.map((p, i) => (
                <PhotoCard
                  key={`d-${p.url}-${i}`}
                  photo={p}
                  viewProfileText={t("realPhotos.viewProfile")}
                  variant="desktop"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PhotoCard({
  photo,
  viewProfileText,
  variant,
}: {
  photo: LocationMasonryPhoto;
  viewProfileText: string;
  variant: "mobile" | "desktop";
}) {
  const aspect = photo.width && photo.height ? photo.width / photo.height : null;

  if (variant === "mobile") {
    // All mobile cards render at the same fixed portrait shape (70vw × 3:4
    // aspect ≈ 70 × 93vw). Mixed orientations would look chaotic in a
    // peek-carousel — landscape photos stretched horizontally, portraits
    // narrow — so we crop landscapes to portrait via object-cover +
    // object-center, taking the middle of the frame. Trade: lose some
    // edges of horizontal shots for visual consistency, which matters more
    // on a small screen. ~30vw of the next card peeks past the right edge,
    // signalling swipeability.
    return (
      <a
        href={`/photographers/${photo.photographer.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="snap-start shrink-0 mr-3 last:mr-0 relative block overflow-hidden rounded-2xl bg-warm-100 w-[70vw] aspect-[3/4]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={`Photo by ${photo.photographer.name}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
        <PhotoOverlay photographer={photo.photographer} viewProfileText={viewProfileText} alwaysVisible />
      </a>
    );
  }

  return (
    <a
      href={`/photographers/${photo.photographer.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-2xl bg-warm-100"
      style={aspect ? { aspectRatio: `${photo.width} / ${photo.height}` } : { aspectRatio: "4 / 5" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={`Photo by ${photo.photographer.name}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
      />
      <PhotoOverlay photographer={photo.photographer} viewProfileText={viewProfileText} />
    </a>
  );
}

function PhotoOverlay({
  photographer,
  viewProfileText,
  alwaysVisible = false,
}: {
  photographer: LocationMasonryPhoto["photographer"];
  viewProfileText: string;
  alwaysVisible?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-3 sm:px-4 ${
        alwaysVisible ? "" : "opacity-0 transition group-hover:opacity-100"
      }`}
    >
      {photographer.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photographer.avatar_url}
          alt=""
          className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full ring-2 ring-white/40 object-cover"
        />
      ) : (
        <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full bg-white/20" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white drop-shadow">
          {photographer.name}
        </p>
        <p className="truncate text-[11px] text-white/80">{viewProfileText}</p>
      </div>
      <svg className="h-4 w-4 shrink-0 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

/** Distribute photos into N columns by greedy-balancing column heights so
 *  the masonry doesn't end with a tall column and a stubby tail. For each
 *  photo, pick the currently shortest column and append. Heights are
 *  estimated from the photo's natural aspect (height/width ratio at unit
 *  width). Photos without dims fall back to a 4:5 portrait estimate.
 *  Caller still gets a weighted-random order, just sprinkled across columns. */
function distributeBalanced(items: LocationMasonryPhoto[], cols: number): LocationMasonryPhoto[][] {
  const out: LocationMasonryPhoto[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  for (const item of items) {
    const ratio = item.width && item.height ? item.height / item.width : 1.25;
    let minIdx = 0;
    for (let i = 1; i < cols; i++) {
      if (heights[i] < heights[minIdx]) minIdx = i;
    }
    out[minIdx].push(item);
    heights[minIdx] += ratio;
  }
  return out;
}
