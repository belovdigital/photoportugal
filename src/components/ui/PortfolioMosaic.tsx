"use client";

import { useState, useEffect, useRef } from "react";

export interface MosaicPhoto {
  url: string;
  slug: string;
  name: string;
  location: string | null;
}

const VISIBLE_CELLS = 6;
// Per-cell rotation: each cell schedules its OWN swap at a random interval
// in [MIN_MS, MAX_MS] so cells flicker independently — like stars twinkling
// rather than a metronome. With 6 cells averaging ~4.5s, the page sees
// ~1.3 swaps/sec total, which reads as gentle continuous motion.
const ROTATE_MIN_MS = 3000;
const ROTATE_MAX_MS = 6000;
// Cross-fade duration must match the CSS animation in globals.css
// (`.animate-mosaic-fade-in`). The previous <img> stays mounted for this
// long so the new one has time to fade in over it.
const FADE_MS = 500;

/**
 * Stable-layout photo mosaic with cross-fade swaps.
 *
 * Each of the 6 cells has a *fixed* aspect ratio assigned by position, so the
 * grid never re-flows when a photo swaps in/out. Photos use `object-cover`
 * so they always fill their cell — we trade a bit of cropping for a layout
 * that doesn't jitter, which the natural-aspect (`columns-3 break-inside-avoid`)
 * version did badly.
 *
 * Swap animation: every ~3.5s a random cell gets a fresh photo. We render two
 * stacked `<img>`s in each cell — current + previous — and cross-fade their
 * opacity over 600ms. After the fade settles, the previous img unmounts.
 *
 * Mobile: hidden entirely (lg:block) — the value-prop section already does
 * its job with the headline + CTAs above the fold.
 */
/** Hook: auto-rotates a small visible window over a larger photo pool.
 * Each cell runs its OWN setTimeout chain at a random interval in
 * [ROTATE_MIN_MS, ROTATE_MAX_MS] — so cells swap independently and the
 * mosaic appears to twinkle rather than tick to a global beat. */
function useRotatingVisible(photos: MosaicPhoto[], visibleCount: number, hovering: boolean) {
  const [visible, setVisible] = useState<MosaicPhoto[]>(() => photos.slice(0, visibleCount));
  const poolRef = useRef<MosaicPhoto[]>(photos.slice(visibleCount));
  useEffect(() => {
    if (hovering || photos.length <= visibleCount) return;
    const timers: number[] = [];
    let cancelled = false;

    function scheduleSwap(cellIdx: number) {
      if (cancelled) return;
      const delay = ROTATE_MIN_MS + Math.random() * (ROTATE_MAX_MS - ROTATE_MIN_MS);
      timers[cellIdx] = window.setTimeout(() => {
        setVisible((prev) => {
          if (poolRef.current.length === 0) {
            const seen = new Set(prev.map((p) => p.url));
            poolRef.current = photos.filter((p) => !seen.has(p.url));
            if (poolRef.current.length === 0) return prev;
          }
          const next = poolRef.current.shift()!;
          const replaced = prev[cellIdx];
          poolRef.current.push(replaced);
          const out = [...prev];
          out[cellIdx] = next;
          return out;
        });
        scheduleSwap(cellIdx);
      }, delay);
    }

    for (let i = 0; i < visibleCount; i++) scheduleSwap(i);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [hovering, photos, visibleCount]);
  return visible;
}

export function PortfolioMosaic({ photos }: { photos: MosaicPhoto[] }) {
  const [hovering, setHovering] = useState(false);
  const visible = useRotatingVisible(photos, VISIBLE_CELLS, hovering);

  if (visible.length === 0) return null;

  return (
    <div
      className="relative hidden lg:block h-full"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Explicit `grid-rows-6` + `h-full` makes every row exactly 1/6 of the
          parent height. Cells take their span * (1/6) regardless of which photo
          loads — the layout never reflows when a photo swaps in. */}
      <div className="grid grid-cols-6 grid-rows-6 gap-3 h-full">
        <MosaicCell photo={visible[0]} className="col-span-3 row-span-4" priority />
        <MosaicCell photo={visible[1]} className="col-span-3 row-span-2" />
        <MosaicCell photo={visible[2]} className="col-span-2 row-span-2" />
        <MosaicCell photo={visible[3]} className="col-span-1 row-span-2" />
        <MosaicCell photo={visible[4]} className="col-span-3 row-span-2" />
        <MosaicCell photo={visible[5]} className="col-span-3 row-span-2" />
      </div>
    </div>
  );
}

/**
 * Smaller 4-cell mosaic in the same visual language as `PortfolioMosaic`,
 * sized to fit alongside the text column (top-left and bottom-left
 * positions in the value-prop section). Mixed cell sizes so it reads as
 * a continuation of the bigger mosaic on the right rather than a tidy grid.
 */
export function PortfolioMosaicQuad({ photos, className = "" }: {
  photos: MosaicPhoto[];
  className?: string;
}) {
  const [hovering, setHovering] = useState(false);
  // 3 cells: one large (2×2) plus two smaller (1×1 each), filling a 3×2 grid.
  const visible = useRotatingVisible(photos, 3, hovering);

  if (visible.length === 0) return null;

  return (
    <div
      className={`relative hidden lg:block h-full ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Same stable-height trick as PortfolioMosaic — `h-full` propagates the
          parent's pixel height into the grid so rows are pre-sized and layout
          doesn't reflow when a cell swaps photos. */}
      <div className="grid grid-cols-3 grid-rows-2 gap-3 h-full">
        <MosaicCell photo={visible[0]} className="col-span-2 row-span-2" priority />
        <MosaicCell photo={visible[1]} className="col-span-1 row-span-1" />
        <MosaicCell photo={visible[2]} className="col-span-1 row-span-1" />
      </div>
    </div>
  );
}

function MosaicCell({
  photo,
  className,
  priority = false,
}: {
  photo: MosaicPhoto | undefined;
  className: string;
  priority?: boolean;
}) {
  const [current, setCurrent] = useState<MosaicPhoto | undefined>(photo);
  const [previous, setPrevious] = useState<MosaicPhoto | null>(null);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!photo || !current || photo.url === current.url) {
      if (photo && !current) setCurrent(photo);
      return;
    }
    setPrevious(current);
    setCurrent(photo);
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(() => setPrevious(null), FADE_MS);
    return () => {
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.url]);

  if (!current) return <div className={`${className} rounded-2xl bg-warm-200`} />;

  // `target="_blank"` keeps the visitor on the homepage they were exploring;
  // a click from the mosaic feels like "open this photographer alongside",
  // not "leave the page I'm browsing".
  return (
    <a
      href={`/photographers/${current.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} group relative overflow-hidden rounded-2xl shadow-md`}
    >
      {previous && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previous.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.url}
        src={current.url}
        alt={current.name + (current.location ? ` photoshoot in ${current.location}` : "")}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        className="relative h-full w-full object-cover transition duration-700 group-hover:scale-[1.04] animate-mosaic-fade-in"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
        <p className="text-sm font-semibold text-white drop-shadow">{current.name}</p>
        {current.location && (
          <p className="text-xs text-white/85 drop-shadow">{current.location}</p>
        )}
      </div>
    </a>
  );
}
