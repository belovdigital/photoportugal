import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = req.nextUrl.searchParams.get("channel") || "email";

  if (channel === "sms") {
    // Twilio holds ONE account for all three markets, so messages.list()
    // returns Portugal's, Spain's and Italy's together — the Italian admin was
    // reading Portuguese SMS. Twilio has no field to tell them apart, so the
    // market's own notification_logs decides which messages are ours (that
    // table lives in this market's database) and Twilio only supplies the
    // delivery status, error and price for the ones we already own.
    try {
      const mine = await query<{
        id: string; recipient: string; event: string; status: string;
        error_code: string | null; error_message: string | null; created_at: string;
      }>(
        `SELECT id, recipient, event, status, error_code, error_message,
                created_at::text AS created_at
           FROM notification_logs
          WHERE channel = 'sms'
          ORDER BY created_at DESC
          LIMIT 100`
      );

      // Nothing to enrich — a market that has not sent an SMS yet shows an
      // empty list rather than another market's traffic.
      if (mine.length === 0) return NextResponse.json([]);

      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // Reach back to the oldest row we are showing, with a day of slack for
      // clock skew between the app and Twilio.
      const oldest = new Date(mine[mine.length - 1].created_at);
      oldest.setDate(oldest.getDate() - 1);
      const messages = await client.messages.list({ limit: 400, dateSentAfter: oldest });

      // Key on recipient + the stored prefix: notification_logs keeps the
      // first 100 characters of the body, which is what we can compare.
      const byKey = new Map<string, (typeof messages)[number]>();
      for (const m of messages) {
        byKey.set(`${m.to}|${(m.body || "").slice(0, 100)}`, m);
      }

      return NextResponse.json(mine.map((row) => {
        const m = byKey.get(`${row.recipient}|${row.event}`);
        return {
          id: m?.sid || row.id,
          channel: "sms",
          recipient: row.recipient,
          event: row.event,
          // Twilio knows whether it actually arrived; our own row only knows
          // whether we handed it over.
          status: m?.status || row.status,
          error_code: m?.errorCode ? String(m.errorCode) : row.error_code,
          error_message: m?.errorMessage || row.error_message,
          from: m?.from || null,
          created_at: m?.dateCreated?.toISOString() || new Date(row.created_at).toISOString(),
          price: m?.price ?? null,
          direction: m?.direction || "outbound-api",
        };
      }));
    } catch (err) {
      console.error("[notification-logs] Twilio error:", err);
      try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/admin/notification-logs", method: req.method, statusCode: 500 }); } catch {}
      return NextResponse.json({ error: "Failed to fetch Twilio logs" }, { status: 500 });
    }
  }

  // Email logs from DB
  const logs = await query<{
    id: string; channel: string; recipient: string; event: string;
    status: string; error_code: string | null; created_at: string;
  }>(
    `SELECT id, channel, recipient, event, status, error_code, created_at
     FROM notification_logs
     WHERE channel = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [channel]
  );

  return NextResponse.json(logs);
}
