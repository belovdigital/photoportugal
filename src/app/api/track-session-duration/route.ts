import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isNoTrackRequest } from "@/lib/no-track";

export async function POST(req: NextRequest) {
  try {
    if (isNoTrackRequest(req)) return NextResponse.json({ ok: true });

    const { session_id, duration_ms } = await req.json();
    if (!session_id || !duration_ms) return NextResponse.json({ ok: true });

    // Update duration_ms of the last pageview in the array
    await query(
      `UPDATE visitor_sessions
       SET pageviews = jsonb_set(
         pageviews,
         ARRAY[(jsonb_array_length(pageviews) - 1)::text, 'duration_ms'],
         $1::jsonb
       ),
       last_activity_at = NOW()
       WHERE id = $2::uuid AND jsonb_array_length(pageviews) > 0`,
      [JSON.stringify(duration_ms), session_id]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
