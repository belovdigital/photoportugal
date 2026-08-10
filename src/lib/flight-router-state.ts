/**
 * Is this `Next-Router-State-Tree` header something Next can actually parse?
 *
 * Next parses the header on every RSC navigation and throws
 * "The router state header was sent but could not be parsed." when it cannot —
 * which surfaces as a 500 for the whole page:
 *
 *   curl .../faq                                              -> 200
 *   curl -H 'RSC: 1' -H 'Next-Router-State-Tree: nonsense' ... -> 500
 *
 * A real browser never sends a broken one, but a scanner, a truncating proxy or
 * a speculative prefetch can, and each one pages us with a false 5xx. The
 * middleware uses this to drop the RSC headers instead, downgrading the request
 * to a plain document render — which is what a client in that state needs.
 *
 * Mirrors `parseAndValidateFlightRouterState` in
 * node_modules/next/dist/server/app-render/parse-and-validate-flight-router-state.js
 * and the `flightRouterStateSchema` it asserts against, in .../app-render/types.js.
 * Re-implemented rather than deep-imported so this carries no dependency on
 * Next's internal module paths.
 *
 * JSON.parse alone is NOT enough — the schema is what rejects most bad input.
 * `["",{},null,null,true]` is valid JSON but fails validation, because the
 * fifth slot must be a number.
 *
 * Erring strict is the safe direction: a valid header wrongly rejected only
 * costs that one navigation a full document render instead of an RSC payload.
 * If a future Next release widens the schema, re-check this against it —
 * scripts/check-flight-router-state.mjs diffs the two implementations.
 */

const DYNAMIC_PARAM_TYPES = new Set([
  "c", "ci(..)(..)", "ci(.)", "ci(..)", "ci(...)",
  "oc",
  "d", "di(..)(..)", "di(.)", "di(..)", "di(...)",
]);

const REFRESH_MARKERS = new Set(["refetch", "inside-shared-layout", "metadata-only"]);

/** Next's own cap, applied before it attempts to parse. */
const MAX_HEADER_LENGTH = 20 * 2000;

function isSegment(value: unknown): boolean {
  if (typeof value === "string") return true;
  // [param name, param cache key, dynamic param type, static siblings]
  if (!Array.isArray(value) || value.length !== 4) return false;
  const [name, cacheKey, type, siblings] = value;
  return (
    typeof name === "string" &&
    typeof cacheKey === "string" &&
    typeof type === "string" &&
    DYNAMIC_PARAM_TYPES.has(type) &&
    (siblings === null || (Array.isArray(siblings) && siblings.every((s) => typeof s === "string")))
  );
}

export function isFlightRouterState(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5) return false;
  const [segment, children, url, marker, loading] = value;

  if (!isSegment(segment)) return false;
  // superstruct's record() accepts any object, and an array is one — Next lets
  // `["", []]` through, so this does too rather than being gratuitously stricter.
  if (typeof children !== "object" || children === null) return false;
  if (!Object.values(children as Record<string, unknown>).every(isFlightRouterState)) return false;

  if (value.length > 2 && url !== null && url !== undefined) {
    if (!Array.isArray(url) || url.length !== 2 || !url.every((u) => typeof u === "string")) return false;
  }
  if (value.length > 3 && marker !== null && marker !== undefined) {
    if (typeof marker !== "string" || !REFRESH_MARKERS.has(marker)) return false;
  }
  if (value.length > 4 && loading !== undefined && typeof loading !== "number") return false;

  return true;
}

export function isParsableRouterState(value: string): boolean {
  if (value.length > MAX_HEADER_LENGTH) return false;
  try {
    return isFlightRouterState(JSON.parse(decodeURIComponent(value)));
  } catch {
    return false;
  }
}
