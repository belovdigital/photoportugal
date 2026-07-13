import { query } from "@/lib/db";

export type RecommendationStrategy =
  | "best_fit"
  | "fresh_fit"
  | "featured_fit"
  | "local_fit"
  | "llm_pick";

export type TrafficSegment = "paid_ads" | "organic" | "returning";

export interface RecommendationSnapshot {
  photographerId: string;
  rank: number;
  strategy: RecommendationStrategy;
  fitScore: number | null;
  sessionCountAtTime: number | null;
  reviewCountAtTime: number | null;
  isFeaturedAtTime: boolean | null;
  isVerifiedAtTime: boolean | null;
}

/**
 * Fire-and-forget logger for every photographer the concierge shows.
 * Called once per `show_matches` tool resolution; one row per photographer
 * in the returned card list.
 *
 * Deliberately not awaited at call site — if DB hiccups we still want the
 * chat reply to succeed. The caller `void`s the promise; we swallow any
 * errors here so the unhandled-rejection log stays quiet.
 */
export async function logRecommendations(
  chatId: string,
  trafficSegment: TrafficSegment | null,
  picks: RecommendationSnapshot[]
): Promise<void> {
  if (!picks.length || !chatId) return;
  try {
    const values: unknown[] = [];
    const rowFragments: string[] = [];
    let pIdx = 1;
    for (const p of picks) {
      rowFragments.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
      );
      values.push(
        chatId,
        p.photographerId,
        p.rank,
        p.strategy,
        p.fitScore,
        p.sessionCountAtTime,
        p.reviewCountAtTime,
        p.isFeaturedAtTime,
        p.isVerifiedAtTime,
        trafficSegment
      );
    }
    await query(
      `INSERT INTO concierge_recommendation_events (
         chat_id, photographer_id, rank, strategy, fit_score,
         session_count_at_time, review_count_at_time,
         is_featured_at_time, is_verified_at_time, traffic_segment
       ) VALUES ${rowFragments.join(", ")}`,
      values
    );
  } catch (err) {
    console.error("[concierge/rec-events] log failed:", err);
  }
}

/** Mark a recommendation as clicked. Idempotent — only writes once per
 *  (chat, photographer). Called from /api/concierge/recommendation-click. */
export async function markClicked(chatId: string, photographerId: string): Promise<void> {
  try {
    await query(
      `UPDATE concierge_recommendation_events
          SET clicked_profile_at = NOW()
        WHERE chat_id = $1 AND photographer_id = $2 AND clicked_profile_at IS NULL`,
      [chatId, photographerId]
    );
  } catch (err) {
    console.error("[concierge/rec-events] markClicked failed:", err);
  }
}

/** Mark recommendation(s) as having led to a booking. Called from the
 *  bookings POST. Walks back from a paid booking → its
 *  photographer_id + the chat that surfaced them. */
export async function markBookingFromConcierge(
  chatId: string,
  photographerId: string
): Promise<void> {
  try {
    await query(
      `UPDATE concierge_recommendation_events
          SET booking_created_at = COALESCE(booking_created_at, NOW())
        WHERE chat_id = $1 AND photographer_id = $2`,
      [chatId, photographerId]
    );
  } catch (err) {
    console.error("[concierge/rec-events] markBookingFromConcierge failed:", err);
  }
}

/** Mark recommendation as having led to the visitor messaging the
 *  photographer. Called from /api/inquiries POST. Idempotent. */
export async function markMessageStarted(
  chatId: string,
  photographerId: string
): Promise<void> {
  try {
    await query(
      `UPDATE concierge_recommendation_events
          SET message_started_at = NOW()
        WHERE chat_id = $1 AND photographer_id = $2 AND message_started_at IS NULL`,
      [chatId, photographerId]
    );
  } catch (err) {
    console.error("[concierge/rec-events] markMessageStarted failed:", err);
  }
}

/** Mark recommendation(s) as having led to a paid booking. Called from
 *  Stripe webhook on checkout.session.completed for type=booking. */
export async function markPaidFromConcierge(
  chatId: string,
  photographerId: string
): Promise<void> {
  try {
    await query(
      `UPDATE concierge_recommendation_events
          SET paid_at = NOW()
        WHERE chat_id = $1 AND photographer_id = $2 AND paid_at IS NULL`,
      [chatId, photographerId]
    );
  } catch (err) {
    console.error("[concierge/rec-events] markPaidFromConcierge failed:", err);
  }
}

/** Resolve a visitor's traffic segment from their session attribution.
 *  Cheap helper; null when unknown (treated as "organic" upstream). */
export function classifyTrafficSegment(input: {
  gclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  userId?: string | null;
}): TrafficSegment {
  if (input.userId) return "returning";
  if (input.gclid) return "paid_ads";
  const medium = (input.utm_medium || "").toLowerCase();
  if (medium === "cpc" || medium === "ads" || medium === "ppc") return "paid_ads";
  const src = (input.utm_source || "").toLowerCase();
  if (src === "google_ads" || src === "googleads" || src === "fb_ads") return "paid_ads";
  return "organic";
}

/** Epsilon (exploration rate) for fresh_fit slot allocation.
 *  Tuned manually per cost-of-traffic; revisit once we have 2 weeks
 *  of conversion data per segment. */
export const EPSILON_BY_SEGMENT: Record<TrafficSegment, number> = {
  paid_ads: 0.15,
  organic: 0.30,
  returning: 0.40,
};

/**
 * Missed-match telemetry for /dashboard/stats: photographers who were
 * in scope for a chat but dropped by a gate (language / location /
 * outranked). Deduped per (chat, photographer, reason) — multi-turn
 * chats re-rank every turn. Fire-and-forget.
 */
export async function logConciergeExclusions(
  chatId: string,
  entries: { photographerId: string; reason: string }[],
): Promise<void> {
  if (!chatId || entries.length === 0) return;
  const capped = entries.slice(0, 150);
  try {
    await query(
      `INSERT INTO concierge_exclusion_events (chat_id, photographer_id, reason)
       SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::varchar[])
       ON CONFLICT (chat_id, photographer_id, reason) DO NOTHING`,
      [capped.map(() => chatId), capped.map((e) => e.photographerId), capped.map((e) => e.reason)],
    );
  } catch (err) {
    console.error("[concierge/exclusions] log failed:", err);
  }
}
