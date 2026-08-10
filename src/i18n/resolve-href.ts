import { routing } from "./routing";

/**
 * next-intl translates a STRING href only when it matches a key in the
 * pathnames table exactly. Static routes therefore localise ("/locations" ->
 * "/de/orte"), but a concrete dynamic path matches no key: "/locations/lisbon"
 * fell through untranslated, rendered as "/de/locations/lisbon", and the
 * middleware answered it with a 301 to "/de/orte/lisbon". Search Console
 * counted those in the hundreds per market as "Page with redirect".
 *
 * The Link types were widened so call sites could keep passing interpolated
 * strings, on the stated assumption that runtime behaviour matched the
 * {pathname, params} form. It does not — that widening silenced exactly the
 * error which would have caught this. Rather than migrate ~70 call sites, the
 * conversion happens here: a concrete path is matched back against the dynamic
 * patterns and passed on in the form next-intl can translate.
 *
 * Deliberately free of React and next-intl imports so it stays unit-testable
 * on its own.
 */
const DYNAMIC_PATTERNS = Object.keys(routing.pathnames ?? {})
  .filter((key) => key.includes("["))
  .map((pattern) => ({ pattern, segments: pattern.split("/").filter(Boolean) }));

export function resolveHref(href: string | object): string | object {
  // Objects are already in the translatable form; external URLs, "mailto:" and
  // bare "#anchor" hrefs are not ours to rewrite.
  if (typeof href !== "string" || !href.startsWith("/")) return href;

  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const withoutHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = withoutHash.indexOf("?");
  const search = queryAt === -1 ? "" : withoutHash.slice(queryAt + 1);
  const pathname = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const extras = {
    ...(search ? { query: Object.fromEntries(new URLSearchParams(search)) } : {}),
    ...(hash ? { hash } : {}),
  };

  // A static key translates on its own — but only as a bare string. next-intl
  // looks the href up verbatim, so "/photographers?location=rome" missed the
  // "/photographers" entry and stayed unlocalised, which is the same redirect
  // in a different costume.
  if (pathname in (routing.pathnames ?? {})) {
    return search || hash ? { pathname, ...extras } : href;
  }

  const segments = pathname.split("/").filter(Boolean);
  let best: { pathname: string; params: Record<string, string> } | null = null;
  let bestLiterals = -1;

  for (const { pattern, segments: patternSegments } of DYNAMIC_PATTERNS) {
    if (patternSegments.length !== segments.length) continue;

    const params: Record<string, string> = {};
    let literals = 0;
    let matches = true;

    for (let i = 0; i < segments.length; i++) {
      const segment = patternSegments[i];
      if (segment.startsWith("[") && segment.endsWith("]")) {
        params[segment.slice(1, -1)] = segments[i];
      } else if (segment === segments[i]) {
        literals++;
      } else {
        matches = false;
        break;
      }
    }

    // Rank by how many segments matched literally, not by pattern length:
    // "/photographers/location/rome" fits both "/photographers/[slug]/[package]"
    // and "/photographers/location/[slug]", and only the second is the route
    // that exists.
    if (matches && literals > bestLiterals) {
      best = { pathname: pattern, params };
      bestLiterals = literals;
    }
  }

  if (!best) return href;

  return { ...best, ...extras };
}
