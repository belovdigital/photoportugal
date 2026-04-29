import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const ALLOWED_EVENTS = new Set(["shown", "submitted", "dismissed", "browse_clicked"]);

/**
 * Lightweight beacon endpoint that records exit-intent popup interactions.
 * Funnel events: `shown` (popup rendered), `submitted` (visitor typed +
 * pressed Find), `dismissed` (X / overlay click), `browse_clicked` (the
 * fallback "Or browse" link). Admin reads aggregate counts to gauge how
 * the popup is performing.
 *
 * Visitor id comes from the `vid` cookie set by VisitorTracker; it's not
 * required (anon sessions still log) but lets us de-dupe in queries.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const eventType = String(body.event_type || "").toLowerCase();
    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    }
    const pagePath = typeof body.page_path === "string" ? body.page_path.slice(0, 500) : null;
    const cookieVid = req.cookies.get("vid")?.value || null;
    const visitorId = cookieVid ? cookieVid.slice(0, 36) : null;

    await query(
      `INSERT INTO popup_events (visitor_id, event_type, page_path)
       VALUES ($1, $2, $3)`,
      [visitorId, eventType, pagePath],
    );
    return NextResponse.json({ ok: true });
  } catch {
    // Beacon — never block the page on failure.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
