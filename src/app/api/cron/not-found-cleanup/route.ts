import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Daily cleanup for the 404 aggregate table. Retention = 30 days for
// everything that isn't admin-pinned. Anything older than that is
// dropped regardless of hits count — by the time a 404 hasn't been hit
// in a month it's either a one-off typo, an already-fixed link, or a
// long-dead bot probe.
//
// `ignored=TRUE` rows are kept indefinitely — admin explicitly opted to
// keep them out of the top list while preserving the hit count.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pruned = await query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM not_found_paths
          WHERE NOT ignored
            AND last_seen_at < NOW() - INTERVAL '30 days'
          RETURNING 1
       )
       SELECT COUNT(*)::text AS count FROM deleted`
    );

    const remaining = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM not_found_paths`
    );

    return NextResponse.json({
      ok: true,
      pruned: Number(pruned[0]?.count || 0),
      remaining: Number(remaining[0]?.count || 0),
    });
  } catch (error) {
    console.error("[cron/not-found-cleanup] error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
