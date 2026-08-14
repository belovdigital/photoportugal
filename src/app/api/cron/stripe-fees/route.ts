import { NextRequest, NextResponse } from "next/server";
import { requireStripe } from "@/lib/stripe";
import { sweepStripeFees } from "@/lib/stripe-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Fill in what Stripe charged us for each payment, so revenue can be reported
 * net of it.
 *
 * The webhook already writes the fee the moment a payment succeeds, which
 * covers the ordinary case within seconds. This exists for the cases it cannot
 * cover: a blind booking authorised on Monday and captured on Thursday has no
 * fee until Thursday, and a webhook that was dropped or arrived while the app
 * was restarting leaves a hole nothing else would ever notice.
 *
 * Runs daily rather than hourly on purpose. Rows that are authorised but not
 * yet captured are re-read on every pass — they have no fee to find — so a
 * tighter schedule would just spend Stripe calls on the same handful of blind
 * bookings all day for a number nobody reads more than once a day.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = requireStripe();
  const result = await sweepStripeFees(stripe);

  if (result.errors.length > 0) {
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      await sendTelegram(
        `💳 <b>Stripe fee sweep: ${result.errors.length} error(s)</b>\n\n${result.errors.slice(0, 5).join("\n")}`
      );
    } catch {}
  }

  return NextResponse.json(result);
}
