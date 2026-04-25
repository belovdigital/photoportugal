import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Admin-only
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const filter = req.nextUrl.searchParams.get("filter") || "all";
  const where: string[] = ["1=1"];
  if (filter === "with_email") where.push("email IS NOT NULL");
  if (filter === "matched") where.push("outcome = 'show_matches'");
  if (filter === "handoff") where.push("outcome = 'human_handoff'");

  const chats = await query<{
    id: string; visitor_id: string | null; user_id: string | null;
    email: string | null; first_name: string | null; outcome: string | null;
    language: string | null; source: string | null; page_context: string | null;
    utm_source: string | null; utm_term: string | null; country: string | null;
    total_tokens: number; total_cost_usd: string;
    matched_photographer_ids: string[] | null; archived: boolean;
    messages: unknown; created_at: string; updated_at: string;
    user_name: string | null; user_email: string | null;
  }>(
    `SELECT c.id, c.visitor_id, c.user_id, c.email, c.first_name, c.outcome,
            c.language, c.source, c.page_context, c.utm_source, c.utm_term, c.country,
            c.total_tokens, COALESCE(c.total_cost_usd, 0)::text AS total_cost_usd,
            c.matched_photographer_ids, COALESCE(c.archived, FALSE) AS archived,
            c.messages, c.created_at, c.updated_at,
            u.name AS user_name, u.email AS user_email
     FROM concierge_chats c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.created_at DESC LIMIT 100`
  ).catch(() => []);

  // Stats — aggregate over the last 90 days for relevance
  const stats = await queryOne<{
    total_chats: number; today_chats: number; week_chats: number;
    emails_captured: number; handoffs: number; matched: number;
    total_cost_usd: string; total_tokens: number;
  }>(
    `SELECT
       COUNT(*)::int AS total_chats,
       COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today_chats,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS week_chats,
       COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS emails_captured,
       COUNT(*) FILTER (WHERE outcome = 'human_handoff')::int AS handoffs,
       COUNT(*) FILTER (WHERE outcome = 'show_matches')::int AS matched,
       COALESCE(SUM(total_cost_usd), 0)::text AS total_cost_usd,
       COALESCE(SUM(total_tokens), 0)::int AS total_tokens
     FROM concierge_chats
     WHERE created_at > NOW() - INTERVAL '90 days'`
  ).catch(() => null);

  // Top photographers (by matched count)
  const topPhotogs = await query<{ name: string; slug: string; count: number }>(
    `SELECT u.name, pp.slug, COUNT(*)::int AS count
     FROM concierge_chats c, UNNEST(c.matched_photographer_ids) AS m_id
     JOIN photographer_profiles pp ON pp.id = m_id
     JOIN users u ON u.id = pp.user_id
     WHERE c.created_at > NOW() - INTERVAL '90 days'
       AND c.matched_photographer_ids IS NOT NULL
       AND array_length(c.matched_photographer_ids, 1) > 0
     GROUP BY u.name, pp.slug
     ORDER BY count DESC LIMIT 10`
  ).catch(() => []);

  // Top locations from page_context (best effort: extract last word) — skip for v1
  // We'll instead extract from messages in a separate query or accept manual review
  return NextResponse.json({
    chats,
    stats: stats ? {
      ...stats,
      by_language: [],
      by_source: [],
      top_locations: [],
      top_photographers: topPhotogs,
    } : null,
  });
}
