"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { ConciergeQuickStart } from "@/components/concierge/ConciergeQuickStart";

export interface HeroFeaturedPhotographer {
  slug: string;
  name: string;
  tagline: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  session_count: number;
  location_name: string;
  location_slug: string;
  /** Up to 6 portfolio photo URLs, used for the auto-rotating background slideshow. */
  portfolio_urls: string[];
}

/**
 * When provided, the hero pivots from "Meet [photographer]" framing to
 * "Photographers in [location]" — used on /locations/[slug] so paid-ad
 * landings have a location-targeted headline + quick-fact chips, with the
 * actual photographer in the carousel kept as a softer attribution.
 */
export interface HeroLocationContext {
  slug: string;
  name: string;
  region: string;
  photographerCount: number;
  minPrice: number | null;
  durationText: string | null;
  avgRating: number | null;
  totalReviews: number;
  /** When set (combo /locations/[slug]/[occasion] pages), the hero renders
   *  "<occasionLabel> in <locationName>" as the h1 instead of the default
   *  "Photographers in <locationName>". Pass an already-localized phrase
   *  like "Couples Photographer" / "Fotógrafo de Casais". */
  occasionLabel?: string;
  /** Per-locale preposition for the combo headline ("in", "em", "à"…). */
  occasionPreposition?: string;
}

const ROTATION_MS = 5000;

/**
 * Variant B — hero centred on ONE photographer (chosen by the server, cached
 * for the ISR cycle) with their portfolio photos auto-cross-fading on the
 * background. Personalises first impression AND showcases work without a click.
 *
 * Photographer pick is server-side: that means every visitor in a given 60s
 * window sees the same person, but there's no flash-of-wrong-content on
 * hydration (which there used to be when we re-rolled client-side). Photo
 * rotation is client-side because it has no SEO/SSR meaning.
 */
export function HeroSingleVariant({ photographer, locationContext, totalPhotographers }: {
  photographer: HeroFeaturedPhotographer;
  locationContext?: HeroLocationContext;
  /** Real count of approved photographers used in the "browse all N" link
   *  at the bottom of the overlay. Required so we never show "30+" when the
   *  actual roster has grown — the "+" looked sloppy and stale. */
  totalPhotographers?: number;
}) {
  const t = useTranslations("heroSingle");
  const tLoc = useTranslations("heroSingle.location");
  const tLocQuickStart = useTranslations("locations.detail.quickStart");

  const [photoIdx, setPhotoIdx] = useState(0);
  const [arrowsTouched, setArrowsTouched] = useState(false);
  // SSR-safe default: render the mobile single-photo branch first. On client
  // mount we flip to desktop if matchMedia matches. Picking a concrete
  // boolean (rather than `null`) means we never render a blank hero during
  // the gap between SSR and the matchMedia callback — which was leaving
  // mobile users on a broken-looking page.
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  // For the infinite carousel we render 3 copies of the photos array and
  // silently jump scrollLeft by ±copyWidth when the user scrolls into the
  // first or third copy. `absoluteIdxRef` tracks the slot's position in
  // the extended array (0..3N-1) so auto-rotate / arrows keep advancing
  // smoothly across copy boundaries; `isJumpingRef` guards against the
  // re-entrant scroll event the silent jump fires.
  const absoluteIdxRef = useRef(0);
  const isJumpingRef = useRef(false);
  // Pause auto-rotate when the hero is off-screen — a) saves a JS timer
  // running for nothing, b) avoids `el.scrollTo()` firing while the user
  // reads the rest of the page (which felt like a glitch on long scrolls).
  const [inView, setInView] = useState(true);
  // Per-image natural aspect (width/height), populated on <img onLoad>. Used
  // to decide whether a photo should be packed at natural width (tall/portrait
  // = neighbours peek in) or stretched to fill the viewport with object-cover
  // (wide-but-short landscape that would otherwise leave dark gaps at h-full).
  const [imgAspects, setImgAspects] = useState<Record<number, number>>({});
  // Hero box aspect ratio — recomputed on resize. A photo is "wide-but-short"
  // when its natural aspect is landscape (>1) yet still narrower than the hero
  // box at full height; those need stretch+crop, the rest stay at natural.
  const [heroAspect, setHeroAspect] = useState(16 / 9);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const update = () => {
      const el = sectionRef.current;
      if (el && el.clientHeight > 0) setHeroAspect(el.clientWidth / el.clientHeight);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia?.("(min-width: 768px)");
    if (!mql) { setIsDesktop(false); return; }
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Sync the visible photoIdx from scroll position AND keep the
  // infinite-carousel illusion alive: when the user has scrolled into the
  // first or third copy, silently teleport scrollLeft into the equivalent
  // position in the middle copy. Slot widths vary (variable photo aspects)
  // so we measure cumulative offsets rather than dividing by a fixed
  // slot width.
  useEffect(() => {
    if (!isDesktop) return;
    const el = scrollerRef.current;
    if (!el) return;
    const total = photographer?.portfolio_urls.length || 0;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Re-entry guard — when WE just shifted scrollLeft for the
        // infinite jump, the scroll event fires once more; ignore it so
        // we don't ping-pong.
        if (isJumpingRef.current) {
          isJumpingRef.current = false;
          return;
        }

        const center = el.scrollLeft + el.clientWidth / 2;
        let bestIdx = 0;
        let bestDist = Infinity;
        slotRefs.current.forEach((slot, i) => {
          if (!slot) return;
          const slotCenter = slot.offsetLeft + slot.clientWidth / 2;
          const d = Math.abs(slotCenter - center);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        });

        // Infinite jump: if the closest slot is in the first or third
        // copy, push scrollLeft by ±copyWidth so the user lands in the
        // equivalent middle-copy slot without seeing a seam.
        if (total > 1) {
          const firstMid = slotRefs.current[total];
          const firstThird = slotRefs.current[total * 2];
          if (firstMid && firstThird) {
            const copyWidth = firstThird.offsetLeft - firstMid.offsetLeft;
            // Jump must be INSTANT — `scroll-smooth` on the scroller
            // animates scrollLeft changes (even via "instant" param in
            // some WebKit builds), which makes the teleport visible.
            // Strip scroll-behavior for the assignment, then restore.
            const doInstantJump = (delta: number) => {
              isJumpingRef.current = true;
              const prev = el.style.scrollBehavior;
              el.style.scrollBehavior = "auto";
              el.scrollLeft = el.scrollLeft + delta;
              el.style.scrollBehavior = prev;
            };
            if (bestIdx < total) {
              doInstantJump(copyWidth);
              absoluteIdxRef.current = bestIdx + total;
              return;
            }
            if (bestIdx >= total * 2) {
              doInstantJump(-copyWidth);
              absoluteIdxRef.current = bestIdx - total;
              return;
            }
          }
        }

        absoluteIdxRef.current = bestIdx;
        const displayed = total > 1 ? bestIdx % total : bestIdx;
        // Functional setState — the handler closure captures a stale
        // photoIdx (effect deps exclude photoIdx so the listener is
        // installed once), and scrolling BACK was silently skipped
        // because `bestIdx !== closure_photoIdx` was false even when
        // state was different.
        setPhotoIdx((prev) => (prev === displayed ? prev : displayed));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, photographer]);

  // Centre a slot (by ABSOLUTE index in the extended array) inside the
  // scroller. We avoid `slot.scrollIntoView()` because that bubbles up
  // and scrolls the page back to the hero whenever the user has scrolled
  // past — extremely annoying when auto-rotation fires while reading the
  // rest of the page.
  function scrollSlotIntoView(absoluteIdx: number, smooth = true) {
    const el = scrollerRef.current;
    const slot = slotRefs.current[absoluteIdx];
    if (!el || !slot) return;
    const target = slot.offsetLeft - (el.clientWidth - slot.clientWidth) / 2;
    // `"instant"` (not `"auto"`) is the explicit override — without it,
    // the scroller's CSS `scroll-behavior: smooth` (Tailwind's
    // `scroll-smooth` class) animates even non-smooth callers, so the
    // initial mount-time scroll-to-middle-copy was visible as the carousel
    // sliding to the "end" then resetting.
    el.scrollTo({ left: target, behavior: (smooth ? "smooth" : "instant") as ScrollBehavior });
    absoluteIdxRef.current = absoluteIdx;
  }

  useEffect(() => {
    if (!isDesktop || !inView || !photographer || photographer.portfolio_urls.length <= 1 || arrowsTouched) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    // photoIdx is INTENTIONALLY excluded from deps — the interval reads
    // `absoluteIdxRef.current` (a ref) so it always sees the latest
    // position, and including photoIdx would tear down + restart the
    // timer on every visual tick, making the carousel feel jittery on
    // load (timer never quite fires).
    intervalRef.current = window.setInterval(() => {
      const next = absoluteIdxRef.current + 1;
      scrollSlotIntoView(next);
    }, ROTATION_MS);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, inView, photographer, arrowsTouched]);

  // Initial scroll on desktop: park the carousel at the start of the
  // middle copy so the user can swipe both directions without a seam.
  // We retry across several frames because slot widths are 0 until the
  // first images load — without the retry the scroll target would be
  // calc'd against zero-width slots and the anchor wouldn't actually be
  // in the middle copy. We set `scrollLeft` DIRECTLY (bypassing
  // `scrollTo`) so the scroller's `scroll-smooth` CSS doesn't animate
  // the jump, which is what made the load feel chaotic before.
  useEffect(() => {
    if (!isDesktop || !photographer) return;
    const total = photographer.portfolio_urls.length;
    if (total <= 1) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // ~1s at 60fps — long enough for the LCP image
    const tryAnchor = () => {
      if (cancelled) return;
      const el = scrollerRef.current;
      const slot = slotRefs.current[total];
      if (!el || !slot) {
        if (++attempts < MAX_ATTEMPTS) requestAnimationFrame(tryAnchor);
        return;
      }
      const target = slot.offsetLeft - (el.clientWidth - slot.clientWidth) / 2;
      // If slot widths haven't populated yet (target ≤ 0), retry next frame.
      if (target <= 0 && ++attempts < MAX_ATTEMPTS) {
        requestAnimationFrame(tryAnchor);
        return;
      }
      // Force scroll-behavior:auto for THIS assignment — the scroller has
      // Tailwind's `scroll-smooth` class, which WebKit honours for direct
      // scrollLeft assignment too. Without this override the anchor was
      // visible as the carousel rapidly scrolling through every photo to
      // reach the middle-copy slot.
      const prev = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      el.scrollLeft = target;
      el.style.scrollBehavior = prev;
      absoluteIdxRef.current = total;
    };
    requestAnimationFrame(tryAnchor);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, photographer]);

  if (!photographer) return null;

  const firstName = photographer.name.split(" ")[0];
  const photos = photographer.portfolio_urls.length > 0
    ? photographer.portfolio_urls
    : (photographer.cover_url ? [photographer.cover_url] : ["/hero-family.webp"]);
  const totalPhotos = photos.length;
  const displayRating = photographer.rating > 0 ? photographer.rating.toFixed(1) : null;

  function nudge(delta: number) {
    if (totalPhotos <= 1) return;
    setArrowsTouched(true);
    // Move by `delta` in the extended array. The scroll handler catches
    // any boundary crossings and rebases silently to the middle copy.
    scrollSlotIntoView(absoluteIdxRef.current + delta);
  }

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-gray-900"
      // Reserve space for fixed page chrome so the hero never overflows
      // below the viewport fold. 64px = the global header. On location
      // pages an extra ~44px breadcrumbs row sits above the hero, so we
      // subtract more there. Using inline style instead of Tailwind
      // because the calc operands need to be conditional.
      style={{
        minHeight: locationContext
          ? "calc(100svh - 64px - 44px)"
          : "calc(100svh - 64px)",
      }}
    >
      {/* Mobile (< md): single static photo, no carousel, no arrows. */}
      {!isDesktop && (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[0]}
            alt={t("coverAlt", { name: photographer.name, location: photographer.location_name })}
            className="h-full w-full object-cover object-center"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
        </div>
      )}

      {/* Desktop (≥ md): horizontal scroll-snap carousel.
          Per-photo width strategy decided once we know the photo's natural
          aspect (set on <img onLoad>):
            - Tall / portrait / square: slot is the photo's natural width at
              h-full so neighbouring photos peek in from the sides.
            - Wide-but-short landscape that would leave dark gaps at h-full
              (i.e. natural aspect < hero aspect): slot becomes 100vw and the
              <img> is `object-cover` so the photo fills the viewport with
              edges cropped — instead of floating in the middle with bars. */}
      {isDesktop && (
        <div
          ref={scrollerRef}
          className="absolute inset-0 flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Infinite carousel: render 3 copies of the photos array when
              we have more than one photo. Initial scroll position is the
              start of the middle copy; the scroll handler silently jumps
              ±copyWidth when the user crosses into the first or third
              copy. No leading/trailing spacers — neighbouring photos from
              the adjacent copy serve as the "peek" content, so first and
              last photos can always snap-center and there are never empty
              gaps at the carousel edges. */}
          {(totalPhotos > 1 ? [...photos, ...photos, ...photos] : photos).map((url, i) => {
            // Aspects are keyed by photo index in the ORIGINAL array
            // (i % totalPhotos) so the same photo's aspect populates all
            // three copies once any one of them loads.
            const photoIdxInOriginal = totalPhotos > 1 ? i % totalPhotos : i;
            const aspect = imgAspects[photoIdxInOriginal];
            // landscape but doesn't fill viewport at h-full → fill+crop
            const isWideShort = aspect !== undefined && aspect > 1 && aspect < heroAspect;
            // Eager-load only the very first occurrence (cover); the rest
            // are lazy. For copies 2 and 3 we use `key={url}-{i}` to keep
            // React happy with duplicate URLs.
            const isFirstOccurrence = i === (totalPhotos > 1 ? totalPhotos : 0);
            return (
              <div
                key={`${url}-${i}`}
                ref={(el) => { slotRefs.current[i] = el; }}
                className={`snap-center shrink-0 h-full${isWideShort ? " w-screen" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={isFirstOccurrence ? t("coverAlt", { name: photographer.name, location: photographer.location_name }) : ""}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (!img.naturalWidth || !img.naturalHeight) return;
                    const a = img.naturalWidth / img.naturalHeight;
                    setImgAspects((prev) => (prev[photoIdxInOriginal] !== undefined ? prev : { ...prev, [photoIdxInOriginal]: a }));
                  }}
                  className={isWideShort ? "h-full w-full object-cover object-center block" : "h-full w-auto block"}
                  loading={isFirstOccurrence ? "eager" : "lazy"}
                  decoding={isFirstOccurrence ? "sync" : "async"}
                  fetchPriority={isFirstOccurrence ? "high" : "low"}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Backdrop strictly behind the headline, so peripheral photo peeks
          stay visible as photos (not as darkness). Width clamped to the text
          column on the left, fades to nothing past it. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-[820px] bg-gradient-to-r from-gray-950/85 via-gray-950/55 to-transparent" />

      {/* Background slideshow arrows — desktop only. Mobile shows a single
          static photo (see above) and any carousel UI is hidden completely. */}
      {isDesktop && totalPhotos > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label="Previous photo"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white tabular-nums backdrop-blur-sm">
              {photoIdx + 1} / {totalPhotos}
            </span>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label="Next photo"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </>
      )}

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          {/* Availability / credibility chip */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {locationContext
              ? tLoc("availableChip", { count: locationContext.photographerCount, location: locationContext.name })
              : t("availableChip", { location: photographer.location_name })}
          </div>

          {/* On location pages this IS the page's canonical heading
              ("Photographers in {Location}") so it's an h1. On the homepage
              the heading is photographer-specific ("Meet X, your Lisbon
              photographer") and changes per request — bad SEO if it were
              h1, so we render h2 there and let the value-prop section
              below own the page's h1 with the stable copy. */}
          {locationContext ? (
            locationContext.occasionLabel ? (
              // Combo headline: "<Occasion>" line break "in <Location>".
              // We construct it inline (not via i18n) because the only
              // moving piece is the preposition; the rest is data passed in.
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-[3.5rem]">
                <span className="text-primary-400">{locationContext.occasionLabel}</span>
                <br className="hidden sm:inline" />{" "}
                {locationContext.occasionPreposition || "in"}{" "}
                <span className="text-primary-400">{locationContext.name}</span>
              </h1>
            ) : (
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-[3.5rem]">
                {tLoc.rich("headline", {
                  location: (chunks) => <span className="text-primary-400">{chunks}</span>,
                  br: () => <br className="hidden sm:inline" />,
                  locationName: locationContext.name,
                })}
              </h1>
            )
          ) : (
            <h2 className="mt-5 font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-[3.5rem]">
              {t.rich("headline", {
                name: (chunks) => <span className="text-primary-400">{chunks}</span>,
                br: () => <br className="hidden sm:inline" />,
                firstName,
                location: photographer.location_name,
              })}
            </h2>
          )}

          {/* On location pages: replace the photographer-tagline with a row
              of quick-fact chips (region, price-from, session length, count
              + rating). On homepage: show the photographer's tagline. */}
          {locationContext ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/90 backdrop-blur-sm">
                {locationContext.region}
              </span>
              {locationContext.minPrice !== null && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/90 backdrop-blur-sm">
                  {tLoc("fromPrice", { price: Math.round(locationContext.minPrice) })}
                </span>
              )}
              {locationContext.durationText && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/90 backdrop-blur-sm">
                  {locationContext.durationText}
                </span>
              )}
              {locationContext.avgRating && locationContext.avgRating > 0 && locationContext.totalReviews > 0 && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/90 backdrop-blur-sm">
                  ⭐ {locationContext.avgRating.toFixed(1)} · {tLoc("reviews", { count: locationContext.totalReviews })}
                </span>
              )}
            </div>
          ) : (
            photographer.tagline && (
              <p className="mt-5 max-w-xl text-lg italic text-white/85">
                &ldquo;{photographer.tagline}&rdquo;
              </p>
            )
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {photographer.avatar_url && (
              <Link href={`/photographers/${photographer.slug}`} className="group flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40 transition group-hover:ring-white">
                  <OptimizedImage src={photographer.avatar_url} alt={photographer.name} width={120} className="h-full w-full" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-white group-hover:underline">
                    {locationContext ? tLoc("byPhotographer", { name: photographer.name }) : photographer.name}
                  </p>
                  <p className="text-white/70 text-xs">{t("viewProfile")} →</p>
                </div>
              </Link>
            )}
            {!locationContext && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                {displayRating && (
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <strong>{displayRating}</strong>
                    {photographer.review_count > 0 && <span className="text-white/70">{t("reviewsCount", { count: photographer.review_count })}</span>}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* iOS-26 "liquid glass" panel — very thin, more transparent
              than the old frosted look. Minimal tint (`bg-white/10`), light
              blur (`backdrop-blur-md`), brighter edge (`border-white/25`)
              so the photo behind shows through clearly while still keeping
              the form readable. */}
          <div className="mt-7 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/25 p-4 shadow-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/80">
              {locationContext
                ? tLoc("matchPrompt", { location: locationContext.name })
                : t("matchPrompt", { firstName })}
            </p>
            {/* On location pages we ditch the email-capture form in favour
                of a free-text input that drops the visitor's question
                straight into the on-page AI concierge drawer. Lower
                friction (no email handover) + immediate gratification
                (bot replies in seconds). The homepage keeps the legacy
                MatchQuickForm — it doesn't have a location preset and the
                email path serves a different audience there. */}
            {locationContext ? (
              <ConciergeQuickStart
                placeholder={tLocQuickStart("placeholder", { location: locationContext.name })}
                cta={tLocQuickStart("cta")}
                locationName={locationContext.name}
              />
            ) : (
              <MatchQuickForm
                source="homepage_hero_b"
                size="md"
                variant="dark"
              />
            )}
          </div>

          <p className="mt-4 text-sm text-white/70">
            {t.rich("browseAll", {
              count: totalPhotographers ?? 0,
              link: (chunks) => (
                <Link href="/photographers" className="font-semibold text-white underline underline-offset-2 hover:text-primary-300">{chunks}</Link>
              ),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
