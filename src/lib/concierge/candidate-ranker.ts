// Server-side pre-ranking of photographer candidates before the LLM call.
// We still pass the full list to the model (so it can suggest locations,
// answer comparison questions etc.), but we ALSO inject a small "top
// candidates" block when we can extract a clear intent. The LLM is then
// nudged to prefer these — the pre-rank handles the deterministic part
// (coverage match × tier × rating × reviews) and the LLM keeps doing the
// stylistic / persona match it's good at.
//
// Inputs: photographers + signals (page context, last user message,
// (slug:foo) hints, conversation history).
// Output: { topCandidates: ConciergePhotographer[]; intent: ResolvedIntent }

import type { ConciergePhotographer } from "@/lib/concierge/photographer-context";
import type { PageContext } from "@/lib/concierge/page-context";
import { LOCATION_TREE, type LocationNode } from "@/lib/location-hierarchy";
import { shootTypes as ALL_SHOOT_TYPES } from "@/lib/shoot-types-data";

export interface ResolvedIntent {
  /** The most specific location slug we've inferred — could be a city,
   *  island, region, or null if not enough signal. */
  locationSlug: string | null;
  /** The occasion / shoot-type slug if inferred. */
  occasionSlug: string | null;
  /** True when the location came from a hard signal (URL, slug:hint).
   *  Lower-confidence sources (regex against last message) are still
   *  used but weighted less in case of conflict. */
  locationConfident: boolean;
}

const SLUG_HINT_RE = /\(slug:([a-z0-9-]+)\)/i;

/** Walk the location tree, returning all ancestor slugs of `slug` plus
 *  `slug` itself. e.g., "sao-miguel" → ["sao-miguel", "azores-eastern-group", "azores"]. */
export function ancestorsOf(slug: string): string[] {
  function find(nodes: LocationNode[], path: string[]): string[] | null {
    for (const node of nodes) {
      const next = [...path, node.slug];
      if (node.slug === slug) return next;
      const deeper = find(node.children || [], next);
      if (deeper) return deeper;
    }
    return null;
  }
  const path = find(LOCATION_TREE, []);
  if (!path) return [slug];
  return path.reverse(); // most specific first
}

/** Reverse: descendants of a parent slug. */
export function descendantsOf(slug: string): string[] {
  function find(nodes: LocationNode[]): LocationNode | null {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const deeper = find(node.children || []);
      if (deeper) return deeper;
    }
    return null;
  }
  function flatten(node: LocationNode): string[] {
    return [node.slug, ...(node.children || []).flatMap(flatten)];
  }
  const root = find(LOCATION_TREE);
  return root ? flatten(root) : [slug];
}

/** Coverage match: photographer covers `requestedSlug` if any of their
 *  coverage slugs equals it OR is an ancestor (broader region) OR a
 *  descendant (more specific location they explicitly cover). Returns
 *  the match quality (0-3) for ranking — higher is more specific. */
export function coverageMatchScore(
  photographerLocations: string[],
  requestedSlug: string
): number {
  if (!requestedSlug) return 0;
  const ancestors = new Set(ancestorsOf(requestedSlug));
  const descendants = new Set(descendantsOf(requestedSlug));
  let score = 0;
  for (const loc of photographerLocations) {
    if (loc === requestedSlug) return 3;          // exact match
    if (ancestors.has(loc)) score = Math.max(score, 2);    // photographer covers a parent (broader)
    if (descendants.has(loc)) score = Math.max(score, 1);  // photographer covers a child (more specific)
  }
  return score;
}

/** Try to figure out what the visitor wants from all available signals. */
export function resolveIntent(opts: {
  pageContext: PageContext | null;
  messages: { role: string; content: string }[];
}): ResolvedIntent {
  const { pageContext, messages } = opts;

  // Pass 1: hard signals — slug hint in last user message wins, then page URL.
  let locationSlug: string | null = null;
  let occasionSlug: string | null = null;
  let locationConfident = false;

  // Slug hint in any recent user message (most recent wins)
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const hint = SLUG_HINT_RE.exec(m.content || "");
    if (hint) {
      locationSlug = hint[1].toLowerCase();
      locationConfident = true;
      break;
    }
  }

  // Page context fallback (URL is high-confidence too)
  if (!locationSlug && pageContext?.location?.slug) {
    locationSlug = pageContext.location.slug;
    locationConfident = true;
  }
  if (pageContext?.occasion?.slug) {
    occasionSlug = pageContext.occasion.slug;
  }

  // Pass 2: scan recent user messages for occasion keywords if not yet set.
  if (!occasionSlug) {
    const recentText = messages
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content?.toLowerCase() || "")
      .join(" ");
    for (const st of ALL_SHOOT_TYPES) {
      const aliases = [st.slug, st.slug.replace(/-/g, " "), st.name.toLowerCase()];
      if (aliases.some((a) => recentText.includes(a))) {
        occasionSlug = st.slug;
        break;
      }
    }
  }

  return { locationSlug, occasionSlug, locationConfident };
}

/** Score a photographer for the given intent. Higher is better. */
export function scoreCandidate(
  p: ConciergePhotographer,
  intent: ResolvedIntent
): number {
  let score = 0;
  if (intent.locationSlug) {
    const cov = coverageMatchScore(p.locations || [], intent.locationSlug);
    if (cov === 0) return 0; // out of scope — will be filtered
    score += cov * 100;
  }
  if (intent.occasionSlug) {
    const types = p.shoot_types || [];
    if (types.includes(intent.occasionSlug)) score += 30;
    else score -= 5; // soft penalty for missing occasion specialty (don't kill — they may still be a strong fit)
  }
  if (p.is_featured) score += 50;
  if (p.is_verified) score += 20;
  if (p.is_founding) score += 10;
  score += (Number(p.rating) || 0) * 5;
  score += Math.log1p(Number(p.review_count) || 0) * 5;
  return score;
}

/** Run the full ranker. Returns null if no clear intent (caller skips
 *  the prompt augmentation). Otherwise returns the top N candidates and
 *  the resolved intent for prompt formatting. */
export function rankTopCandidates(opts: {
  photographers: ConciergePhotographer[];
  intent: ResolvedIntent;
  topN?: number;
  excludeSlugs?: Set<string>;
}): ConciergePhotographer[] {
  const { photographers, intent, topN = 12, excludeSlugs } = opts;
  if (!intent.locationSlug && !intent.occasionSlug) return [];
  const scored = photographers
    .filter((p) => !excludeSlugs || !excludeSlugs.has(p.slug))
    .map((p) => ({ p, score: scoreCandidate(p, intent) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((x) => x.p);
  return scored;
}

/** Format the top candidates as a compact prompt block to nudge the LLM
 *  toward the deterministic best fits. */
export function formatTopCandidatesBlock(
  candidates: ConciergePhotographer[],
  intent: ResolvedIntent
): string {
  if (candidates.length === 0) return "";
  const intentLabel = [
    intent.locationSlug ? `location=${intent.locationSlug}` : null,
    intent.occasionSlug ? `occasion=${intent.occasionSlug}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const lines = candidates.map((p, i) => {
    const tags: string[] = [];
    if (p.is_featured) tags.push("FEATURED");
    if (p.is_verified) tags.push("VERIFIED");
    if (p.is_founding) tags.push("FOUNDING");
    const tagStr = tags.length ? `[${tags.join(",")}] ` : "";
    const reviews = Number(p.review_count) > 0 ? `${Number(p.rating).toFixed(1)}★ (${p.review_count} reviews)` : "no reviews yet";
    const langs = (p.languages || []).slice(0, 3).join(", ") || "EN";
    const price = p.min_price ? `from €${p.min_price}` : "price tbd";
    return `${i + 1}. ${tagStr}${p.slug} — ${p.name} — covers: ${(p.locations || []).join(", ")} — ${reviews} — ${langs} — ${price}`;
  });
  return `\n\n## Top server-ranked candidates for this conversation (${intentLabel})\n\nServer-side filter (coverage hierarchy + tier + rating + reviews) ranked these as the strongest fits. Prefer them when calling show_matches UNLESS the visitor's stated style/preference clearly points elsewhere — your job is the stylistic/persona match on top of this pool.\n\n${lines.join("\n")}\n`;
}
