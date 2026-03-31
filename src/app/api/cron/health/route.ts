import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.AUTH_URL || "https://photoportugal.com";

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
    });

    if (res.status >= 500) {
      // Site is down — send Telegram alert
      const { sendTelegram } = await import("@/lib/telegram");
      await sendTelegram(`🔴 <b>SITE DOWN!</b>\n\n${url} returned HTTP ${res.status}\n\nCheck server immediately!`);
      return NextResponse.json({ status: "down", code: res.status });
    }

    return NextResponse.json({ status: "ok", code: res.status });
  } catch (err) {
    const { sendTelegram } = await import("@/lib/telegram");
    await sendTelegram(`🔴 <b>SITE UNREACHABLE!</b>\n\n${url} - connection failed\n\nError: ${(err as Error).message}`);
    return NextResponse.json({ status: "error", message: (err as Error).message });
  }
}
