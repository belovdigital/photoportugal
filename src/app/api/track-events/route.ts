import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isBotUserAgent } from "@/lib/bot-detect";

export const dynamic = "force-dynamic";

/**
 * Batched ingest for photographer-analytics events (see
 * src/lib/track-events.ts). Writes raw rows into photographer_events;
 * the nightly rollup (/api/cron/photographer-stats) turns them into
 * photographer_daily_stats and prunes this table.
 *
 * The visitor comes from the `vid` cookie — no identifiers in the
 * payload. Cards only know the photographer's slug, so slugs are
 * resolved to ids here; events for unknown slugs are dropped.
 */

const EVENT_TYPES = new Set(["card_impression", "card_click", "photo_open", "book_open"]);
const MAX_EVENTS_PER_REQUEST = 40;
const MAX_EVENTS_PER_VISITOR_PER_HOUR = 600;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SURFACE_RE = /^[a-z_]{1,30}$/;

// Single pm2 fork instance → an in-process hourly counter is enough to
// stop a stuck client or a crude scraper from flooding the table.
const hourlyCounts = new Map<string, { count: number; resetAt: number }>();

function underRateLimit(visitorId: string, added: number): boolean {
  const now = Date.now();
  if (hourlyCounts.size > 10_000) hourlyCounts.clear();
  const entry = hourlyCounts.get(visitorId);
  if (!entry || entry.resetAt < now) {
    hourlyCounts.set(visitorId, { count: added, resetAt: now + 3_600_000 });
    return true;
  }
  entry.count += added;
  return entry.count <= MAX_EVENTS_PER_VISITOR_PER_HOUR;
}

interface IncomingEvent {
  t?: unknown;
  slug?: unknown;
  surface?: unknown;
  item_id?: unknown;
  pos?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (isBotUserAgent(ua)) return new NextResponse(null, { status: 204 });

    const visitorId = req.cookies.get("vid")?.value;
    if (!visitorId || !UUID_RE.test(visitorId)) return new NextResponse(null, { status: 204 });

    const body = await req.json().catch(() => null);
    const rawEvents: IncomingEvent[] = Array.isArray(body?.events) ? body.events : [];
    if (rawEvents.length === 0) return new NextResponse(null, { status: 204 });

    const events = rawEvents
      .slice(0, MAX_EVENTS_PER_REQUEST)
      .filter(
        (e): e is { t: string; slug: string; surface?: string; item_id?: string; pos?: number } =>
          typeof e?.t === "string" &&
          EVENT_TYPES.has(e.t) &&
          typeof e?.slug === "string" &&
          SLUG_RE.test(e.slug) &&
          (e.surface === undefined || (typeof e.surface === "string" && SURFACE_RE.test(e.surface))) &&
          (e.item_id === undefined || (typeof e.item_id === "string" && UUID_RE.test(e.item_id))) &&
          (e.pos === undefined || (typeof e.pos === "number" && Number.isInteger(e.pos) && e.pos >= 0 && e.pos <= 500)),
      );
    if (events.length === 0) return new NextResponse(null, { status: 204 });

    if (!underRateLimit(visitorId, events.length)) return new NextResponse(null, { status: 204 });

    const slugs = [...new Set(events.map((e) => e.slug))];
    const photographers = await query<{ id: string; slug: string }>(
      "SELECT id, slug FROM photographer_profiles WHERE slug = ANY($1)",
      [slugs],
    );
    const idBySlug = new Map(photographers.map((p) => [p.slug, p.id]));

    const resolved = events.filter((e) => idBySlug.has(e.slug));
    if (resolved.length === 0) return new NextResponse(null, { status: 204 });

    await query(
      `INSERT INTO photographer_events (photographer_id, visitor_id, event_type, surface, item_id, position)
       SELECT * FROM UNNEST($1::uuid[], $2::varchar[], $3::varchar[], $4::varchar[], $5::uuid[], $6::smallint[])`,
      [
        resolved.map((e) => idBySlug.get(e.slug)),
        resolved.map(() => visitorId),
        resolved.map((e) => e.t),
        resolved.map((e) => e.surface || null),
        resolved.map((e) => e.item_id || null),
        resolved.map((e) => (typeof e.pos === "number" ? e.pos : null)),
      ],
    );

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[track-events]", e);
    return new NextResponse(null, { status: 204 });
  }
}
