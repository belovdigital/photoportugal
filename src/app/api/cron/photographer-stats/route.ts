import { NextRequest, NextResponse } from "next/server";
import { rollupPhotographerStats, pullGscProfileStats } from "@/lib/photographer-stats-rollup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Photographer-stats rollup cron.
 *
 * Default run (no params) recomputes a trailing 35-day window — wide on
 * purpose so cohort paid_bookings, late bot flags and late GSC data all
 * self-heal — and prunes raw events. Suggested schedule: every 3 hours
 *   15 *\/3 * * * curl -s "https://photoportugal.com/api/cron/photographer-stats?secret=$CRON_SECRET" > /dev/null
 *
 * Backfill: ?from=2026-01-01&to=2026-02-01 (≤400 days per call, run
 * sequential calls for more; pass gsc=0 to skip Search Console, e.g.
 * when backfilling ranges older than GSC retention).
 */

const DAY_MS = 86_400_000;
// MUST stay below the visitor_sessions retention (the reminders cron
// deletes sessions older than 30 days). The rollup zeroes-then-recomputes
// its whole range, so a window wider than retention would permanently
// zero out view stats for days whose raw sessions are already pruned.
const DEFAULT_WINDOW_DAYS = 27;
const MAX_RANGE_DAYS = 400;
// GSC reliably has data up to ~2 days ago; asking for fresher dates
// returns zeros that would overwrite good rows on the next recompute.
const GSC_LAG_DAYS = 2;

function lisbonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

function shiftDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const explicitRange = Boolean(params.get("from") || params.get("to"));
  const to = params.get("to") || lisbonToday();
  const from = params.get("from") || shiftDays(to, -DEFAULT_WINDOW_DAYS);
  const withGsc = params.get("gsc") !== "0";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return NextResponse.json({ error: "Invalid from/to" }, { status: 400 });
  }
  const rangeDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range too large (max ${MAX_RANGE_DAYS} days per call)` }, { status: 400 });
  }

  // Dates older than the session retention hold IMPORTED history (Drive
  // backups / local dump / GA4). Recomputing them against the pruned live
  // table would zero the view columns. Require an explicit force=1 so
  // that only intentional repair runs (with sessions staged back into
  // the table first) can touch the archive.
  const retentionFloor = shiftDays(lisbonToday(), -DEFAULT_WINDOW_DAYS);
  if (from < retentionFloor && params.get("force") !== "1") {
    return NextResponse.json(
      { error: `from=${from} is older than the session retention floor (${retentionFloor}); view stats there are imported archive. Pass force=1 only if sessions for that range are present.` },
      { status: 400 },
    );
  }

  try {
    // Prune raw events only on the scheduled (default-window) runs, so
    // an old-range backfill can never eat events the daily rollup still
    // needs.
    const summary = await rollupPhotographerStats({ from, to, prune: !explicitRange });

    let gsc: { rows: number; days: number } | { skipped: string } = { skipped: "gsc=0" };
    if (withGsc) {
      const gscTo = shiftDays(lisbonToday(), -GSC_LAG_DAYS);
      const gscEnd = to < gscTo ? to : gscTo;
      if (from <= gscEnd) {
        try {
          gsc = await pullGscProfileStats(from, gscEnd);
        } catch (e) {
          // GSC being down must not fail the rollup — views/funnel data
          // is already committed at this point.
          console.error("[photographer-stats cron] GSC pull failed:", e);
          gsc = { skipped: "gsc_error" };
        }
      } else {
        gsc = { skipped: "range_too_fresh" };
      }
    }

    return NextResponse.json({ ok: true, ...summary, gsc });
  } catch (e) {
    console.error("[photographer-stats cron]", e);
    return NextResponse.json({ error: "Rollup failed" }, { status: 500 });
  }
}
