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
  /** Max budget in EUR if mentioned ("around 300", "under €500"). */
  budgetEur?: number | null;
  /** Group size if mentioned ("we are 4", "for 6 people"). */
  groupSize?: number | null;
  /** ISO date if a shoot date was mentioned and resolvable. */
  targetDate?: string | null;
}

const BUDGET_RE = /(?:€|EUR|euros?)\s*(\d{2,4})\b|(?:under|below|max|up to|around|about)\s*(\d{2,4})\s*(?:€|EUR|euros?)?/i;
const GROUP_RE = /\b(\d{1,2})\s*(?:people|persons?|adults?|pax|of us|guests?)\b|\bwe(?:'re|\sare)?\s*(\d{1,2})\b|\bgroup of\s*(\d{1,2})\b/i;

/** Pull budget/group/size hints from recent user messages. Pure regex —
 *  the LLM still understands richer intent on its own, but having these
 *  in the ranker means deterministic boosts that survive prompt
 *  drift. */
export function extractStructuredSignals(messages: { role: string; content: string }[]): {
  budgetEur: number | null;
  groupSize: number | null;
} {
  const text = messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content || "")
    .join(" ");
  let budgetEur: number | null = null;
  let groupSize: number | null = null;
  const bm = BUDGET_RE.exec(text);
  if (bm) {
    const v = parseInt(bm[1] || bm[2] || "0", 10);
    if (v >= 50 && v <= 5000) budgetEur = v;
  }
  const gm = GROUP_RE.exec(text);
  if (gm) {
    const v = parseInt(gm[1] || gm[2] || gm[3] || "0", 10);
    if (v >= 2 && v <= 20) groupSize = v;
  }
  return { budgetEur, groupSize };
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

  // Blog topic — when the visitor is reading a post we use its derived
  // topic as soft signal. Confidence is lower than URL/slug-hint because
  // the visitor might be browsing unrelated content, but it's better than
  // nothing for "find me a photographer" with no other clues.
  if (!locationSlug && pageContext?.blogTopic?.locationSlug) {
    locationSlug = pageContext.blogTopic.locationSlug;
    // not confident — blog reader may want a different place
  }
  if (!occasionSlug && pageContext?.blogTopic?.shootTypeSlug) {
    occasionSlug = pageContext.blogTopic.shootTypeSlug;
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
  // Featured photographers paid for prominent placement — bump to +80
  // so they reliably outscore unfeatured peers with strong ratings.
  // Was +50, but a non-featured photog with 5★ + many reviews easily
  // beat that, which made the featured tag effectively meaningless on
  // the concierge side.
  if (p.is_featured) score += 80;
  if (p.is_verified) score += 20;
  if (p.is_founding) score += 10;
  score += (Number(p.rating) || 0) * 5;
  score += Math.log1p(Number(p.review_count) || 0) * 5;
  // Response speed (May 2026): faster responders convert better. Cap
  // bonus at +8 so this doesn't dominate the location/occasion match.
  const respMin = (p as { avg_response_minutes?: number | null }).avg_response_minutes;
  if (typeof respMin === "number" && respMin > 0) {
    if (respMin < 30) score += 8;
    else if (respMin < 60) score += 5;
    else if (respMin < 180) score += 2;
  }
  // Budget compatibility — gentle, not hard. If the visitor said
  // "around €300" but the photographer's min price is €450, we don't
  // exclude them (they might still match for the right session), just
  // de-prioritise. Conversely, photographers comfortably under budget
  // get a small lift so the top of the list isn't all premium tier.
  if (intent.budgetEur && p.min_price) {
    const ratio = p.min_price / intent.budgetEur;
    if (ratio <= 0.9) score += 8;        // well within budget
    else if (ratio <= 1.1) score += 3;   // close enough
    else if (ratio <= 1.3) score -= 5;   // stretching
    else score -= 15;                    // way over
  }
  return score;
}

/**
 * Strategy tag attached to each shortlisted candidate. Drives both the
 * ranker output ordering AND the per-recommendation analytics row.
 */
export type RankerStrategy =
  | "best_fit"
  | "fresh_fit"
  | "featured_fit"
  | "local_fit";

export interface RankedCandidate {
  photographer: ConciergePhotographer;
  score: number;
  strategy: RankerStrategy;
}

/** Newcomer condition: 0-2 sessions completed AND profile is real (not a
 *  ghost). We don't boost photographers who joined but never finished
 *  setup, since showing them in matches would frustrate visitors. */
function isNewcomer(p: ConciergePhotographer): boolean {
  const sessions = (p as { session_count?: number }).session_count ?? 0;
  if (sessions > 2) return false;
  // Has the basics — checked by photographer-context query already, but
  // double-guard. Cover + at least 1 portfolio thumb = "publishable".
  if (!p.cover_url) return false;
  if (!p.portfolio_thumbs || p.portfolio_thumbs.length === 0) return false;
  return true;
}

/** Deterministic exact-city boost: if the visitor named a specific city
 *  (not a region), and the photographer covers that EXACT city node, we
 *  flag them as local_fit. Better visitor experience than surfacing a
 *  region-wide photographer who technically matches but doesn't know
 *  the city in detail. */
function isLocalFit(p: ConciergePhotographer, intent: ResolvedIntent): boolean {
  if (!intent.locationSlug) return false;
  return (p.locations || []).includes(intent.locationSlug);
}

/** Run the full ranker. Returns null if no clear intent (caller skips
 *  the prompt augmentation). Otherwise returns up to `topN` candidates,
 *  each tagged with the strategy that surfaced them.
 *
 *  Bandit logic (May 2026):
 *  - Hard filter: must score > 0 (covers location + meets baseline)
 *  - Tier 1: ALWAYS include the single highest score (`best_fit`)
 *  - Tier 2: ε-probability slot for a `fresh_fit` newcomer if any is
 *    within 25% of the top score. Caller controls ε via `epsilon`.
 *  - Tier 3: fill remaining slots with next-highest scores, tagging
 *    featured photographers as `featured_fit`, exact-city matches as
 *    `local_fit`, everyone else as `best_fit`.
 */
export function rankTopCandidates(opts: {
  photographers: ConciergePhotographer[];
  intent: ResolvedIntent;
  topN?: number;
  excludeSlugs?: Set<string>;
  /** Legacy ε-greedy knob — kept for backward compat / tests but no
   *  longer drives newcomer inclusion. Newcomer slot is now guaranteed
   *  (see slot 3 below) so we can stop randomly skipping new photogs
   *  whom we explicitly committed to surfacing. */
  epsilon?: number;
  /** Inject deterministic randomness for tests/replay. Defaults to
   *  Math.random() at call time. Currently only consulted to randomise
   *  picks WITHIN the featured pool when several are equally valid. */
  random?: () => number;
  /** Slugs of newcomers shown in concierge chats recently (last ~7d).
   *  When the matching newcomer pool is large enough, the ranker prefers
   *  newcomers NOT in this set so exposure rotates across the roster
   *  instead of concentrating on the same 3 names. Caller queries
   *  `concierge_recommendation_events` to build it. */
  recentlyShownNewcomers?: Set<string>;
  /** Missed-match telemetry: called once per dropped candidate with the
   *  gate that dropped it. "location" = coverage miss on a located
   *  intent; "outranked" = scored but didn't fit into topN. */
  onDrop?: (photographerId: string, reason: "location" | "outranked") => void;
}): RankedCandidate[] {
  const { photographers, intent, topN = 12, excludeSlugs, recentlyShownNewcomers } = opts;
  const rng = opts.random ?? Math.random;
  if (!intent.locationSlug && !intent.occasionSlug) return [];

  const scored = photographers
    .filter((p) => !excludeSlugs || !excludeSlugs.has(p.slug))
    .map((p) => ({ p, score: scoreCandidate(p, intent) }))
    .filter((x) => {
      if (x.score > 0) return true;
      // score 0 with a located intent = the only hard coverage drop
      if (intent.locationSlug) opts.onDrop?.(x.p.id, "location");
      return false;
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const result: RankedCandidate[] = [];
  const used = new Set<string>();
  const topScore = scored[0].score;

  function pushCandidate(s: { p: ConciergePhotographer; score: number }, forcedStrategy?: RankerStrategy) {
    const strategy = forcedStrategy
      ?? (s.p.is_featured ? "featured_fit" : (isLocalFit(s.p, intent) ? "local_fit" : "best_fit"));
    result.push({ photographer: s.p, score: s.score, strategy });
    used.add(s.p.slug);
  }

  // ── Slot 1: best fit — absolute top score, always.
  pushCandidate(scored[0]);

  // ── Slot 2: guaranteed Featured slot.
  // Featured photographers paid for prominent placement; without an
  // explicit slot they almost never surfaced (only 2 featured_fit
  // picks across 49 chats in our prod data before this change). Now:
  //   - if slot 1 is already featured → no double-featured spam
  //   - else pick the highest-scoring featured photog that still
  //     legitimately matches (score must be > 0, which is already
  //     filtered above)
  //   - if multiple featured photogs are tied at the same top score,
  //     pick one at random so we rotate exposure across paid slots
  if (topN >= 2 && !scored[0].p.is_featured) {
    const featuredCandidates = scored.filter((x) => !used.has(x.p.slug) && x.p.is_featured);
    if (featuredCandidates.length > 0) {
      // Group by score and randomise within the top score band so equally
      // ranked featured photogs share the slot fairly over time.
      const topFeaturedScore = featuredCandidates[0].score;
      const tied = featuredCandidates.filter((x) => x.score === topFeaturedScore);
      const pick = tied[Math.floor(rng() * tied.length)];
      pushCandidate(pick, "featured_fit");
    }
  }

  // Helper: pick a newcomer from the full qualifying pool with bias
  // toward names NOT shown in recent chats. Previously this used
  // `slice(0, 3)` which concentrated exposure on the same top-scoring
  // newcomers (in May 2026, three names took ~70% of fresh_fit picks).
  // No score threshold — `score > 0` already requires intent match.
  function pickNewcomer(): { p: ConciergePhotographer; score: number } | null {
    const qualifying = scored.filter((x) => !used.has(x.p.slug) && isNewcomer(x.p));
    if (qualifying.length === 0) return null;
    const recent = recentlyShownNewcomers;
    // Prefer not-recently-shown when there's anyone left after the filter;
    // otherwise fall through so exposure isn't completely starved.
    const fresh = recent && recent.size > 0
      ? qualifying.filter((x) => !recent.has(x.p.slug))
      : qualifying;
    const pool = fresh.length > 0 ? fresh : qualifying;
    return pool[Math.floor(rng() * pool.length)];
  }

  // ── Slot 3: guaranteed Newcomer slot.
  // Visibility ramp for photogs with 0-2 completed sessions. Pool is now
  // ALL qualifying newcomers (not top-3 by score) with a preference for
  // those not shown recently in other concierge chats — distributes
  // exposure across the full newcomer roster instead of the same handful.
  if (topN >= 3) {
    const pick = pickNewcomer();
    if (pick) pushCandidate(pick, "fresh_fit");
  }

  // ── Slot ~6: second Newcomer slot when there's room.
  // With topN=12 (default) the LLM still only shows 2-4 cards, and a
  // single newcomer in slot 3 often gets dropped in favour of more
  // established names. Adding a second injection at slot 6 keeps a
  // newcomer in the LLM's working pool even after the top of the list
  // is "used up" — without pushing established/featured photogs out of
  // the early slots (slots 1-2 stay best+featured).
  if (topN >= 6) {
    const pick = pickNewcomer();
    if (pick) pushCandidate(pick, "fresh_fit");
  }

  // ── Remaining slots: top score order, skipping anything used.
  for (const s of scored) {
    if (result.length >= topN) break;
    if (used.has(s.p.slug)) continue;
    pushCandidate(s);
  }

  if (opts.onDrop) {
    for (const s of scored) {
      if (!used.has(s.p.slug)) opts.onDrop(s.p.id, "outranked");
    }
  }

  return result;
}

/** Legacy shape — flat list, no strategy tags. Kept for callers that
 *  only want the candidate set for prompt augmentation. */
export function rankTopCandidatesFlat(opts: {
  photographers: ConciergePhotographer[];
  intent: ResolvedIntent;
  topN?: number;
  excludeSlugs?: Set<string>;
}): ConciergePhotographer[] {
  return rankTopCandidates({ ...opts, epsilon: 0 }).map((r) => r.photographer);
}

/** Format the top candidates as a compact prompt block to nudge the LLM
 *  toward the deterministic best fits. Accepts ranked candidates so the
 *  ranker's strategy tags ([NEW], [FEATURED]) are visible to the LLM —
 *  without them the LLM picks established names by default and never
 *  surfaces the newcomer/featured slots we explicitly injected. */
export function formatTopCandidatesBlock(
  candidates: RankedCandidate[],
  intent: ResolvedIntent
): string {
  if (candidates.length === 0) return "";
  const intentLabel = [
    intent.locationSlug ? `location=${intent.locationSlug}` : null,
    intent.occasionSlug ? `occasion=${intent.occasionSlug}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const lines = candidates.map((rc, i) => {
    const p = rc.photographer;
    const tags: string[] = [];
    // Strategy tags first — these are the injection slots the LLM should
    // honour. `[NEW]` = newcomer visibility ramp (0-2 sessions completed);
    // `[FEATURED]` = paid prominent placement (also reflected on p.is_featured).
    if (rc.strategy === "fresh_fit") tags.push("NEW");
    if (p.is_featured) tags.push("FEATURED");
    if (p.is_verified) tags.push("VERIFIED");
    if (p.is_founding) tags.push("FOUNDING");
    const tagStr = tags.length ? `[${tags.join(",")}] ` : "";
    const reviews = Number(p.review_count) > 0 ? `${Number(p.rating).toFixed(1)}★ (${p.review_count} reviews)` : "no reviews yet";
    const langs = (p.languages || []).slice(0, 3).join(", ") || "EN";
    const price = p.min_price ? `from €${p.min_price}` : "price tbd";
    return `${i + 1}. ${tagStr}${p.slug} — ${p.name} — covers: ${(p.locations || []).join(", ")} — ${reviews} — ${langs} — ${price}`;
  });
  return `\n\n## Top server-ranked candidates for this conversation (${intentLabel})\n\nServer-side filter (coverage hierarchy + tier + rating + reviews) ranked these as the strongest fits. Prefer them when calling show_matches UNLESS the visitor's stated style/preference clearly points elsewhere — your job is the stylistic/persona match on top of this pool.\n\n**Important when picking show_matches:**\n- ALWAYS try to include any **[NEW]** photographer when their intent matches — we're giving them exposure while they build a session/review history.\n- ALWAYS try to include any **[FEATURED]** photographer when their intent matches — they paid for prominent placement.\n- These two injection slots should rarely both be dropped from a 2-4 card response unless the visitor's style preference clearly excludes them.\n\n${lines.join("\n")}\n`;
}
