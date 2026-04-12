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
    // Fetch directly from Twilio API
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const messages = await client.messages.list({ limit: 100 });
      return NextResponse.json(messages.map(m => ({
        id: m.sid,
        channel: "sms",
        recipient: m.to,
        event: m.body?.slice(0, 100) || "",
        status: m.status,
        error_code: m.errorCode ? String(m.errorCode) : null,
        error_message: m.errorMessage || null,
        from: m.from,
        created_at: m.dateCreated?.toISOString() || "",
        price: m.price,
        direction: m.direction,
      })));
    } catch (err) {
      console.error("[notification-logs] Twilio error:", err);
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
