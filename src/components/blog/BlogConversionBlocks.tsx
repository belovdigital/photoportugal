"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

// ----- Hero carousel -------------------------------------------------------

/**
 * Full-bleed hero with 5-photo scroll-snap carousel from a single
 * photographer. Mobile: native swipe; desktop: arrow buttons. Bottom-right
 * pill credits the photographer with a profile link.
 */
export function BlogHeroCarousel({
  thumbnails,
  photographerName,
  photographerSlug,
  fallbackTitle,
}: {
  thumbnails: string[];
  photographerName: string;
  photographerSlug: string;
  fallbackTitle: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || thumbnails.length <= 1) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        setIdx(Math.max(0, Math.min(thumbnails.length - 1, Math.round(el.scrollLeft / w))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [thumbnails.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative h-[300px] sm:h-[400px] lg:h-[480px] w-full overflow-hidden bg-gray-900 group/hero">
      <div
        ref={scrollerRef}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {thumbnails.map((url, i) => (
          <div key={url} className="relative h-full w-full shrink-0 snap-center">
            <OptimizedImage
              src={url}
              alt={`${fallbackTitle} — photo by ${photographerName}`}
              width={1600}
              priority={i === 0}
              className="h-full w-full opacity-80"
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {thumbnails.length > 1 && (
        <>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 hidden lg:flex opacity-0 group-hover/hero:opacity-100 transition h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex opacity-0 group-hover/hero:opacity-100 transition h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {thumbnails.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}

      <Link
        href={`/photographers/${photographerSlug}`}
        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-xs font-medium text-white hover:bg-black/70 transition"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Photo by {photographerName} →
      </Link>
    </div>
  );
}

// ----- Photo strip ---------------------------------------------------------

export type PhotoStripItem = {
  url: string;
  photographer_name: string;
  photographer_slug: string;
};

/**
 * Mid-post horizontal scroll-snap strip — 10 photos from various
 * photographers, each clickable to the photographer profile. Mobile-first
 * native swipe; desktop hover-arrows.
 */
export function BlogPhotoStrip({ photos, heading }: { photos: PhotoStripItem[]; heading: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (photos.length === 0) return null;

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 my-10 group/strip">
      <h3 className="px-4 sm:px-6 lg:px-8 text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        {heading}
      </h3>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 sm:px-6 lg:px-8 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((p) => (
          <Link
            key={p.url}
            href={`/photographers/${p.photographer_slug}`}
            className="relative shrink-0 snap-start overflow-hidden rounded-2xl bg-warm-100"
            style={{ width: "min(70vw, 320px)", height: "min(85vw, 380px)" }}
          >
            <OptimizedImage src={p.url} alt={`Photo by ${p.photographer_name}`} width={500} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <span className="text-xs font-medium text-white">◉ {p.photographer_name}</span>
            </div>
          </Link>
        ))}
      </div>
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="hidden lg:flex absolute left-2 top-[55%] -translate-y-1/2 opacity-0 group-hover/strip:opacity-100 transition h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:scale-110"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="hidden lg:flex absolute right-2 top-[55%] -translate-y-1/2 opacity-0 group-hover/strip:opacity-100 transition h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:scale-110"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ----- Photographer breakout -----------------------------------------------

export type PhotographerBreakoutData = {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  tagline: string | null;
  thumbnails: string[];
  packages: { id: string; name: string; price: number; duration_minutes: number; num_photos: number; is_popular: boolean }[];
};

/**
 * Mid-post photographer feature card. Half hero card / half booking
 * funnel. Carousel of 5 photos on top, bio + packages below. Each
 * package row is a one-tap booking link.
 */
export function BlogPhotographerBreakout({
  data,
  introLabel,
  bookCta,
  popularLabel,
}: {
  data: PhotographerBreakoutData;
  introLabel: string;
  bookCta: string;
  popularLabel: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || data.thumbnails.length <= 1) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        setIdx(Math.max(0, Math.min(data.thumbnails.length - 1, Math.round(el.scrollLeft / w))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data.thumbnails.length]);

  if (data.thumbnails.length === 0) return null;

  return (
    <aside className="my-12 -mx-4 sm:mx-0 sm:rounded-3xl overflow-hidden border-y sm:border border-warm-200 bg-warm-50">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        {/* Carousel */}
        <div className="relative h-72 sm:h-96 bg-gray-900 group/breakout">
          <div
            ref={scrollerRef}
            className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: "none" }}
          >
            {data.thumbnails.map((url) => (
              <div key={url} className="relative h-full w-full shrink-0 snap-center">
                <OptimizedImage src={url} alt={`Photo by ${data.name}`} width={1000} className="h-full w-full" />
              </div>
            ))}
          </div>
          {data.thumbnails.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {data.thumbnails.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60"}`} />
              ))}
            </div>
          )}
        </div>

        {/* Bio + packages */}
        <div className="p-5 sm:p-6 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            ✨ {introLabel}
          </p>
          <Link href={`/photographers/${data.slug}`} className="mt-2 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary-100 text-sm font-bold text-primary-600 shadow">
              {data.avatar_url ? (
                <OptimizedImage src={data.avatar_url} alt={data.name} width={120} className="h-full w-full" />
              ) : (
                data.name.charAt(0)
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-gray-900 truncate">{data.name}</h3>
              {data.review_count > 0 && (
                <p className="text-xs text-gray-500">★ {Number(data.rating).toFixed(1)} · {data.review_count} reviews</p>
              )}
            </div>
          </Link>
          {data.tagline && (
            <p className="mt-3 text-sm text-gray-600 italic line-clamp-3">&ldquo;{data.tagline}&rdquo;</p>
          )}

          {data.packages.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.packages.map((pkg) => (
                <Link
                  key={pkg.id}
                  href={`/book/${data.slug}?package=${pkg.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-warm-200 bg-white px-3 py-2.5 text-sm transition hover:border-primary-400 hover:bg-primary-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="truncate font-semibold text-gray-900">{pkg.name}</p>
                      {pkg.is_popular && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                          {popularLabel}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-gray-500">
                      {pkg.duration_minutes} min{pkg.num_photos > 0 && ` · ${pkg.num_photos} photos`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="font-bold text-gray-900">€{Math.round(Number(pkg.price))}</span>
                    <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
              <Link
                href={`/book/${data.slug}`}
                className="block text-center text-xs font-semibold text-primary-600 hover:text-primary-700 mt-2"
              >
                {bookCta} →
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ----- Reviews carousel ----------------------------------------------------

export type TopicReview = {
  id: string;
  rating: number;
  title: string | null;
  text: string | null;
  client_name: string | null;
  photographer_name: string;
  photographer_slug: string;
};

export function BlogReviewsCarousel({ reviews, heading }: { reviews: TopicReview[]; heading: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (reviews.length === 0) return null;

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 my-12 group/reviews">
      <h3 className="px-4 sm:px-6 lg:px-8 text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        {heading}
      </h3>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 sm:px-6 lg:px-8 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {reviews.map((r) => (
          <div
            key={r.id}
            className="shrink-0 snap-start rounded-2xl border border-warm-200 bg-white p-5"
            style={{ width: "min(85vw, 360px)" }}
          >
            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`h-4 w-4 ${i < Math.round(r.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            {r.title && <p className="text-sm font-semibold text-gray-900 line-clamp-2">{r.title}</p>}
            {r.text && <p className="mt-1.5 text-sm text-gray-600 line-clamp-5">{r.text}</p>}
            <p className="mt-3 text-xs text-gray-400">
              — {r.client_name || "Client"} on{" "}
              <Link href={`/photographers/${r.photographer_slug}`} className="text-primary-600 hover:underline">
                {r.photographer_name}
              </Link>
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="hidden lg:flex absolute left-2 top-[55%] -translate-y-1/2 opacity-0 group-hover/reviews:opacity-100 transition h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:scale-110"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="hidden lg:flex absolute right-2 top-[55%] -translate-y-1/2 opacity-0 group-hover/reviews:opacity-100 transition h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:scale-110"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ----- Sticky mobile bottom bar --------------------------------------------

/**
 * Mobile-only floating bottom CTA. Appears after the user has scrolled
 * past 30% of the article so it doesn't crowd the hero. Always-visible
 * "n photographers · Book now" pill that opens /photographers prefiltered.
 */
export function BlogStickyMobileBar({
  count,
  primaryHref,
  primaryLabel,
  contextLabel,
}: {
  count: number;
  primaryHref: string;
  primaryLabel: string;
  contextLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
      setVisible(scrolled > 0.15 && scrolled < 0.92);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-3 z-40 px-3 lg:hidden transition-transform duration-300 ${visible ? "translate-y-0" : "translate-y-32"}`}
    >
      <div className="mx-auto max-w-md flex items-center gap-2 rounded-2xl bg-gray-900 text-white shadow-2xl px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
            {count} {count === 1 ? "photographer" : "photographers"} {contextLabel}
          </p>
          <p className="text-xs text-white/80 truncate">Tap to browse + book directly</p>
        </div>
        <Link
          href={primaryHref}
          className="shrink-0 rounded-xl bg-primary-500 hover:bg-primary-600 px-4 py-2 text-sm font-bold transition"
        >
          {primaryLabel}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 text-white/60 hover:text-white p-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
