import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { session_id, path, prev_duration_ms } = await req.json();
    if (!session_id || !path) return NextResponse.json({ ok: true });

    const pageview = JSON.stringify({ path, ts: new Date().toISOString(), duration_ms: prev_duration_ms || null });

    await queryOne(
      `UPDATE visitor_sessions
       SET pageviews = CASE WHEN jsonb_array_length(pageviews) < 50 THEN pageviews || $1::jsonb ELSE pageviews END,
           pageview_count = pageview_count + 1,
           last_activity_at = NOW()
       WHERE id = $2::uuid`,
      [pageview, session_id]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[track-pageview]", e);
    return NextResponse.json({ ok: true });
  }
}
