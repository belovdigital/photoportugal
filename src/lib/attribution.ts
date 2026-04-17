// Read attribution params (utm_*, gclid) with 90-day localStorage persistence,
// falling back to URL params → sessionStorage.
// Client-side only.

const ATTRIBUTION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function getAttributionParam(key: "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "gclid"): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get(key);
  if (fromUrl) return fromUrl;
  try {
    const stored = localStorage.getItem(`pp_${key}`);
    if (stored) {
      const parsed = JSON.parse(stored) as { v: string; ts: number };
      if (parsed?.v && typeof parsed.ts === "number" && Date.now() - parsed.ts < ATTRIBUTION_MAX_AGE_MS) {
        return parsed.v;
      }
      localStorage.removeItem(`pp_${key}`);
    }
  } catch {}
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export function getAllAttribution(): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  gclid: string | null;
} {
  return {
    utm_source: getAttributionParam("utm_source"),
    utm_medium: getAttributionParam("utm_medium"),
    utm_campaign: getAttributionParam("utm_campaign"),
    utm_term: getAttributionParam("utm_term"),
    gclid: getAttributionParam("gclid"),
  };
}
