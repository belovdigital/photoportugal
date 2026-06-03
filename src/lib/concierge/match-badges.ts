// Deterministic badges added to each photographer match card after the AI
// returns 3 picks. Computed server-side (no LLM, no hallucinations) from
// real data. Each card gets at most 2 badges, prioritised in render order.
//
// Combines with the AI-generated `style_label` (e.g. "Cinematic style") —
// that one comes from the model and lives on the match itself, not here.

import type { ConciergePhotographer } from "@/lib/concierge/photographer-context";

export type BadgeType =
  | "best_match"        // #1 in AI's order
  | "fastest_responder" // lowest avg_response_minutes among the 3
  | "most_reviews"      // highest review_count, ≥1.5x avg of the 3
  | "best_value"        // lowest min_price, ≤0.7x avg of the 3
  | "featured";         // photographer.is_featured

export interface MatchBadge {
  type: BadgeType;
  label: string;
}

interface MatchInput extends ConciergePhotographer {
  /** AI ordering — first slug = best_match. */
  rank: number;
}

const LABELS: Record<BadgeType, string> = {
  best_match: "Best match",
  fastest_responder: "Fast responder",
  most_reviews: "Most reviews",
  best_value: "Best value",
  featured: "Featured",
};

/** Compute badges for the 3 (or N) AI-returned matches. Returns a map
 *  photographerId → badges (max 2 each, ordered by display priority). */
export function computeBadges(matches: MatchInput[]): Map<string, MatchBadge[]> {
  const out = new Map<string, MatchBadge[]>();
  if (matches.length === 0) return out;

  // Aggregates for relative comparisons
  const reviewCounts = matches.map((m) => m.review_count || 0);
  const avgReviews = reviewCounts.reduce((s, n) => s + n, 0) / reviewCounts.length;
  const maxReviews = Math.max(...reviewCounts);

  const prices = matches
    .map((m) => (m.min_price != null ? Number(m.min_price) : null))
    .filter((n): n is number => n !== null && Number.isFinite(n));
  const avgPrice = prices.length ? prices.reduce((s, n) => s + n, 0) / prices.length : null;
  const minPrice = prices.length ? Math.min(...prices) : null;

  const responses = matches
    .map((m) => (m.avg_response_minutes != null ? m.avg_response_minutes : null))
    .filter((n): n is number => n !== null && Number.isFinite(n));
  const minResponse = responses.length ? Math.min(...responses) : null;

  for (const m of matches) {
    const badges: MatchBadge[] = [];

    if (m.rank === 0) badges.push({ type: "best_match", label: LABELS.best_match });

    if (
      minResponse !== null &&
      m.avg_response_minutes != null &&
      m.avg_response_minutes === minResponse &&
      m.avg_response_minutes <= 60
    ) {
      badges.push({ type: "fastest_responder", label: LABELS.fastest_responder });
    }

    if (
      m.review_count > 0 &&
      m.review_count === maxReviews &&
      m.review_count >= avgReviews * 1.5 &&
      m.review_count >= 5
    ) {
      badges.push({ type: "most_reviews", label: LABELS.most_reviews });
    }

    if (
      minPrice !== null &&
      m.min_price != null &&
      Number(m.min_price) === minPrice &&
      avgPrice !== null &&
      Number(m.min_price) <= avgPrice * 0.7
    ) {
      badges.push({ type: "best_value", label: LABELS.best_value });
    }

    if (m.is_featured) {
      badges.push({ type: "featured", label: LABELS.featured });
    }

    // Cap at 2 — anything more crowds the card. Priority order is the
    // push order above (best_match > fastest > most_reviews > best_value > featured).
    out.set(m.id, badges.slice(0, 2));
  }
  return out;
}
