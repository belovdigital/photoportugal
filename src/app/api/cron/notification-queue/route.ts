import { NextRequest, NextResponse } from "next/server";
import { processNotificationQueue } from "@/lib/notification-queue";

export const dynamic = "force-dynamic";

// Drains the notification_queue: delivers due rows, cancels rows whose
// recipient already saw the message / replied / is online / has the
// app. Run frequently (every minute) so the 3-minute delay-and-cancel
// window stays tight.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  const processed = await processNotificationQueue();
  return NextResponse.json({ processed, ms: Date.now() - t0 });
}
