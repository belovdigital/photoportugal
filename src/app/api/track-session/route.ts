import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

function getDeviceType(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|iphone|android.*mobile/i.test(ua)) return "mobile";
  return "desktop";
}

function isBot(ua: string): boolean {
  return /bot|crawler|spider|googlebot|bingbot|yandex|baidu|duckduck/i.test(ua);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { visitor_id, session_id, referrer, utm_source, utm_medium, utm_campaign, utm_term, gclid, landing_page, screen_width, language, ab_hero } = body;

    if (!visitor_id || !session_id) return NextResponse.json({ ok: true });

    const ua = req.headers.get("user-agent") || "";
    if (isBot(ua)) return NextResponse.json({ ok: true });

    // Rate limit: skip if this visitor created 5+ sessions in last hour (bot/scraper)
    const recentSessions = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM visitor_sessions WHERE visitor_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [visitor_id]
    );
    if (parseInt(recentSessions?.count || "0") >= 5) return NextResponse.json({ ok: true });

    const deviceType = getDeviceType(ua);
    const country = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || null;
    const acceptLang = language || req.headers.get("accept-language")?.split(",")[0]?.split(";")[0] || null;

    const initialPageview = JSON.stringify([{ path: landing_page || "/", ts: new Date().toISOString() }]);

    const abHero = ab_hero === "A" || ab_hero === "B" ? ab_hero : null;
    await queryOne(
      `INSERT INTO visitor_sessions (id, visitor_id, referrer, utm_source, utm_medium, utm_campaign, utm_term, gclid, landing_page, user_agent, device_type, country, language, screen_width, pageviews, pageview_count, ab_hero)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, 1, $16)
       ON CONFLICT (id) DO NOTHING`,
      [session_id, visitor_id, referrer || null, utm_source || null, utm_medium || null, utm_campaign || null, utm_term || null, gclid || null, landing_page || null, ua.slice(0, 500), deviceType, country, acceptLang, screen_width || null, initialPageview, abHero]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[track-session]", e);
    return NextResponse.json({ ok: true });
  }
}
