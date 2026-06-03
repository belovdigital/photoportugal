import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
