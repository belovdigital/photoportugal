import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

// Concierge recommendation analytics. Two payloads:
//
//   byStrategy: shown / clicked / booked / paid per strategy bucket.
//     Lets us see if `fresh_fit` actually converts vs `best_fit`.
//
//   byPhotographer: per-photographer funnel for the top 50 shown over
//     the last 30 days. Surfaces who's getting impressions but no
//     clicks, who's converting, and who's never shown at all.
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const byStrategy = await query<{
      strategy: string;
      traffic_segment: string | null;
      shown: number;
      clicked: number;
      booked: number;
      paid: number;
    }>(
      `SELECT strategy, traffic_segment,
              COUNT(*)::int AS shown,
              COUNT(*) FILTER (WHERE clicked_profile_at IS NOT NULL)::int AS clicked,
              COUNT(*) FILTER (WHERE booking_created_at IS NOT NULL)::int AS booked,
              COUNT(*) FILTER (WHERE paid_at IS NOT NULL)::int AS paid
         FROM concierge_recommendation_events
        WHERE shown_at >= NOW() - INTERVAL '30 days'
        GROUP BY strategy, traffic_segment
        ORDER BY shown DESC`
    );

    const byPhotographer = await query<{
      photographer_id: string;
      name: string;
      slug: string;
      session_count: number;
      shown: number;
      clicked: number;
      booked: number;
      last_shown_at: string;
    }>(
      `SELECT pp.id AS photographer_id, u.name, pp.slug, COALESCE(pp.session_count, 0) AS session_count,
              COUNT(r.*)::int AS shown,
              COUNT(*) FILTER (WHERE r.clicked_profile_at IS NOT NULL)::int AS clicked,
              COUNT(*) FILTER (WHERE r.booking_created_at IS NOT NULL)::int AS booked,
              MAX(r.shown_at)::text AS last_shown_at
         FROM concierge_recommendation_events r
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         JOIN users u ON u.id = pp.user_id
        WHERE r.shown_at >= NOW() - INTERVAL '30 days'
        GROUP BY pp.id, u.name, pp.slug, pp.session_count
        ORDER BY shown DESC LIMIT 50`
    );

    // Photographers who NEVER appeared in concierge recommendations in
    // the last 30 days — the discovery debt we're trying to eliminate.
    const neverShown = await query<{ slug: string; name: string; session_count: number; review_count: number }>(
      `SELECT pp.slug, u.name, COALESCE(pp.session_count, 0) AS session_count,
              COALESCE(pp.review_count, 0) AS review_count
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
        WHERE pp.is_approved = TRUE
          AND COALESCE(u.is_banned, FALSE) = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM concierge_recommendation_events r
             WHERE r.photographer_id = pp.id AND r.shown_at >= NOW() - INTERVAL '30 days'
          )
        ORDER BY pp.created_at DESC`
    );

    // LLM-vs-ranker disagreement rate. For each chat that produced
    // recommendations, the ranker's "winner" (highest fit_score) and
    // the LLM's "winner" (rank=0 in the show_matches response) should
    // usually agree. When they don't, the LLM is overriding our
    // scoring — useful to see how often, and whether it correlates
    // with conversion.
    const disagreement = await query<{
      total_chats: string;
      disagreed_chats: string;
      disagreement_pct: string;
    }>(
      `WITH per_chat AS (
         SELECT chat_id,
                MAX(fit_score) FILTER (WHERE rank = 0) AS llm_top_score,
                MAX(fit_score) AS ranker_top_score
           FROM concierge_recommendation_events
          WHERE shown_at >= NOW() - INTERVAL '30 days'
            AND fit_score IS NOT NULL
          GROUP BY chat_id
       )
       SELECT COUNT(*)::text AS total_chats,
              COUNT(*) FILTER (WHERE llm_top_score < ranker_top_score - 0.01)::text AS disagreed_chats,
              CASE WHEN COUNT(*) > 0
                   THEN ROUND(100.0 * COUNT(*) FILTER (WHERE llm_top_score < ranker_top_score - 0.01) / COUNT(*), 1)::text
                   ELSE '0' END AS disagreement_pct
         FROM per_chat`
    );

    return NextResponse.json({ byStrategy, byPhotographer, neverShown, disagreement: disagreement[0] || null });
  } catch (err) {
    console.error("[admin/concierge/recommendation-stats] error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
