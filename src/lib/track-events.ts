import { useEffect, type RefObject } from "react";

/**
 * Client-side photographer-analytics events (card impressions, card
 * clicks, portfolio photo opens). Powers /dashboard/stats.
 *
 * Not to be confused with src/lib/analytics.ts (GA4 gtag events) or
 * VisitorTracker (session/pageview journal) — this pipeline feeds our
 * own photographer_events table via POST /api/track-events.
 *
 * Batching: events queue in memory and flush after 4s / 25 events /
 * page hide, so a catalog scroll costs 1-2 requests, not one per card.
 * The server reads the visitor from the `vid` cookie (set by
 * VisitorTracker), so the payload carries no identifiers.
 */

type TrackedEventType = "card_impression" | "card_click" | "photo_open";

interface TrackedEvent {
  t: TrackedEventType;
  slug: string;
  surface: string;
  item_id?: string;
  pos?: number;
}

const FLUSH_AFTER_MS = 4000;
const FLUSH_AT_COUNT = 25;
const IMPRESSION_DWELL_MS = 600;

const queue: TrackedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;
// One impression per card per page. Keyed by path|surface|slug so the
// same card seen again after navigating elsewhere counts again.
const seenImpressions = new Set<string>();

/**
 * Classify the page the card was rendered on. Localized URL segments
 * must mirror src/i18n/routing.ts pathnames.
 */
function surfaceFromPath(pathname: string): string {
  const p = pathname.replace(/^\/(pt|de|es|fr)(?=\/|$)/, "") || "/";
  const seg = p.split("/").filter(Boolean);
  if (seg.length === 0) return "home";
  const catalog = ["photographers", "fotografen", "fotografos", "photographes"];
  const locations = ["locations", "orte", "lugares", "lieux"];
  const shootTypes = ["photoshoots", "fotoshootings", "sesiones-de-fotos", "seances-photo"];
  const weddings = ["weddings", "hochzeiten", "bodas", "mariages"];
  if (catalog.includes(seg[0])) {
    if (seg.length === 1) return "catalog";
    if (seg[1] === "location") return "location";
    return "profile"; // similar-photographers blocks on a profile page
  }
  if (locations.includes(seg[0])) return "location";
  if (shootTypes.includes(seg[0]) || weddings.includes(seg[0])) return "shoot_type";
  if (seg[0] === "blog") return "blog";
  if (seg[0] === "spots") return "spot";
  return "other";
}

function flush(useBeacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const events = queue.splice(0, queue.length);
  const body = JSON.stringify({ events });
  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track-events", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/track-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never break the page.
  }
}

function enqueue(event: TrackedEvent) {
  if (typeof window === "undefined") return;
  queue.push(event);
  if (!listenersBound) {
    listenersBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
    window.addEventListener("pagehide", () => flush(true));
  }
  if (queue.length >= FLUSH_AT_COUNT) {
    flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_AFTER_MS);
}

export function trackCardImpression(slug: string, surface?: string) {
  if (typeof window === "undefined" || !slug) return;
  const resolvedSurface = surface || surfaceFromPath(window.location.pathname);
  const key = `${window.location.pathname}|${resolvedSurface}|${slug}`;
  if (seenImpressions.has(key)) return;
  if (seenImpressions.size > 2000) seenImpressions.clear();
  seenImpressions.add(key);
  enqueue({ t: "card_impression", slug, surface: resolvedSurface });
}

export function trackCardClick(slug: string, surface?: string) {
  if (typeof window === "undefined" || !slug) return;
  enqueue({ t: "card_click", slug, surface: surface || surfaceFromPath(window.location.pathname) });
  // The click likely navigates away — don't sit on the queue.
  flush();
}

export function trackPhotoOpen(slug: string, itemId: string | undefined, pos?: number) {
  if (typeof window === "undefined" || !slug) return;
  enqueue({
    t: "photo_open",
    slug,
    surface: surfaceFromPath(window.location.pathname),
    ...(itemId ? { item_id: itemId } : {}),
    ...(typeof pos === "number" ? { pos } : {}),
  });
}

/**
 * Fire a card_impression once the element has been ≥50% visible for
 * 600ms (dwell filters out fast scroll-past). Safe to call with a null
 * ref before mount.
 */
export function useCardImpression(
  ref: RefObject<HTMLElement | null>,
  slug: string,
  surface?: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let dwellTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!dwellTimer) {
              dwellTimer = setTimeout(() => {
                trackCardImpression(slug, surface);
                observer.disconnect();
              }, IMPRESSION_DWELL_MS);
            }
          } else if (dwellTimer) {
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [ref, slug, surface]);
}
