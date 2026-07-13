import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Photographer-stats freshness watchdog. The rollup cron runs every 3h;
 * if the newest computed_at is older than 6h the pipeline is stuck and
 * photographers are looking at stale numbers — alert once per 12h
 * (dedup via platform_settings) instead of every health tick.
 */
async function checkPhotographerStatsFreshness(): Promise<void> {
  try {
    const { queryOne, query } = await import("@/lib/db");
    const row = await queryOne<{ newest: string | null }>(
      "SELECT MAX(computed_at)::text AS newest FROM photographer_daily_stats",
    );
    if (!row?.newest) return; // table empty (pre-launch) — nothing to watch
    const ageMs = Date.now() - new Date(row.newest).getTime();
    if (ageMs < 6 * 3_600_000) return;

    const last = await queryOne<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'photographer_stats_stale_alerted_at'",
    );
    if (last?.value && Date.now() - new Date(last.value).getTime() < 12 * 3_600_000) return;

    const { sendTelegram } = await import("@/lib/telegram");
    const hours = Math.round(ageMs / 3_600_000);
    await sendTelegram(
      `⚠️ <b>Photographer stats are stale</b>\n\nLast rollup: ${hours}h ago (expected every 3h).\nCheck /api/cron/photographer-stats and /var/log/photoportugal-cron-api.log`,
      "alerts",
    );
    await query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('photographer_stats_stale_alerted_at', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [new Date().toISOString()],
    );
  } catch (e) {
    console.error("[health] stats freshness check failed:", e);
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await checkPhotographerStatsFreshness();

  // Hit the local Next.js port directly instead of going server →
  // Cloudflare → server. Previously this fetched the public photoportugal.com
  // URL, which fires false "SITE UNREACHABLE" alerts whenever the server's
  // outbound network to CF has a transient blip (real-world visitors are
  // unaffected). Same-process self-fetch via localhost tests "can my own
  // Next.js still serve requests" without CF as a dependency.
  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}/`;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
    });

    if (res.status >= 500) {
      // Site is down — alert into Alerts topic
      const { sendTelegram } = await import("@/lib/telegram");
      await sendTelegram(`🔴 <b>SITE DOWN!</b>\n\nLocal port ${port} returned HTTP ${res.status}\n\nCheck server immediately!`, "alerts");
      return NextResponse.json({ status: "down", code: res.status });
    }

    return NextResponse.json({ status: "ok", code: res.status });
  } catch (err) {
    const { sendTelegram } = await import("@/lib/telegram");
    await sendTelegram(`🔴 <b>SITE UNREACHABLE!</b>\n\nLocal port ${port} - connection failed\n\nError: ${(err as Error).message}`, "alerts");
    return NextResponse.json({ status: "error", message: (err as Error).message });
  }
}
