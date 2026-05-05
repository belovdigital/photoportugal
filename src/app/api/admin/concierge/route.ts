import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { computeLeadScore } from "@/lib/concierge/lead-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? !!verifyToken(token) : false;
}

export async function GET(req: NextRequest) {
  // Admin-only — uses HMAC `admin_token` cookie (set by /api/admin/login),
  // matching the convention used by every other /api/admin/* route.
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filter = req.nextUrl.searchParams.get("filter") || "all";
  const where: string[] = ["1=1"];
  if (filter === "with_email") where.push("(email IS NOT NULL OR phone IS NOT NULL)");
  // After Phase A outcome normalisation we standardised on "matched" for
  // show_matches; keep the legacy "show_matches" string as a fallback so
  // older rows still match the filter.
  if (filter === "matched") where.push("outcome IN ('matched', 'show_matches')");
  if (filter === "handoff") where.push("outcome = 'human_handoff'");
  // "hot" is computed AFTER fetching (lead score is heuristic, not a
  // column) — we just don't restrict here and post-filter by heat below.
  const wantHot = filter === "hot";

  const chats = await query<{
    id: string; visitor_id: string | null; user_id: string | null;
    email: string | null; phone: string | null; first_name: string | null; outcome: string | null;
    language: string | null; source: string | null; page_context: string | null;
    utm_source: string | null; utm_term: string | null; gclid: string | null; country: string | null;
    total_tokens: number; total_cost_usd: string;
    matched_photographer_ids: string[] | null;
    inquiry_booking_ids: string[] | null;
    archived: boolean;
    messages: { role: string; content: string; action?: { type?: string; data?: { matches?: { slug: string; reasoning?: string; style_label?: string }[]; locations?: { slug: string }[] } } | null }[];
    created_at: string; updated_at: string;
    user_name: string | null; user_email: string | null;
  }>(
    `SELECT c.id, c.visitor_id, c.user_id, c.email, c.phone, c.first_name, c.outcome,
            c.language, c.source, c.page_context, c.utm_source, c.utm_term, c.gclid, c.country,
            c.total_tokens, COALESCE(c.total_cost_usd, 0)::text AS total_cost_usd,
            c.matched_photographer_ids, c.inquiry_booking_ids,
            COALESCE(c.archived, FALSE) AS archived,
            c.messages, c.created_at, c.updated_at,
            u.name AS user_name, u.email AS user_email
     FROM concierge_chats c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.created_at DESC LIMIT 200`
  ).catch(() => []);

  // Resolve photographer names so the admin sees "Aleksandra (almare)"
  // not just a UUID. Pull all photographers referenced once, build a map.
  const allPhotogIds = Array.from(new Set(
    chats.flatMap((c) => c.matched_photographer_ids || [])
  ));
  const photogRows = allPhotogIds.length
    ? await query<{ id: string; slug: string; name: string }>(
        `SELECT pp.id, pp.slug, u.name FROM photographer_profiles pp
           JOIN users u ON u.id = pp.user_id
          WHERE pp.id = ANY($1::uuid[])`,
        [allPhotogIds]
      ).catch(() => [])
    : [];
  const photogById = new Map(photogRows.map((p) => [p.id, p]));

  // Score every chat and (optionally) filter to hot leads only.
  const scored = chats.map((c) => {
    const ls = computeLeadScore({
      email: c.email,
      phone: c.phone,
      gclid: c.gclid,
      utm_source: c.utm_source,
      outcome: c.outcome,
      matched_photographer_ids: c.matched_photographer_ids,
      inquiry_booking_ids: c.inquiry_booking_ids,
      messages: c.messages || [],
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
    const matched_photographers = (c.matched_photographer_ids || [])
      .map((id) => photogById.get(id))
      .filter(Boolean)
      .map((p) => ({ id: p!.id, slug: p!.slug, name: p!.name }));
    return { ...c, lead_score: ls.score, lead_heat: ls.heat, matched_photographers };
  });
  const filteredChats = wantHot ? scored.filter((c) => c.lead_heat === "hot") : scored;

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

  // Top chips — which Lens pre-prompt chips actually convert to chats
  // and matches. Lets us prune dead chips and amplify the high-converting
  // ones over time. Conversion = matched / used.
  const topChips = await query<{ chip: string; used: number; matched: number }>(
    `SELECT source_chip AS chip,
            COUNT(*)::int AS used,
            COUNT(*) FILTER (WHERE outcome IN ('matched','show_matches'))::int AS matched
       FROM concierge_chats
      WHERE source_chip IS NOT NULL
        AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY source_chip
      ORDER BY used DESC LIMIT 10`
  ).catch(() => []);

  // Hot lead count for the filter bar
  const hotCount = scored.filter((c) => c.lead_heat === "hot").length;

  return NextResponse.json({
    chats: filteredChats,
    stats: stats ? {
      ...stats,
      by_language: [],
      by_source: [],
      top_locations: [],
      top_photographers: topPhotogs,
      top_chips: topChips,
      hot_leads: hotCount,
    } : null,
  });
}
