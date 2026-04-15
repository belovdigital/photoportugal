import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = await cookies();
  const token = c.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await query<{
    id: string;
    channel: string;
    recipient: string;
    subject: string | null;
    body: string;
    dedup_key: string;
    recipient_timezone: string;
    send_after: string;
    status: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
  }>(
    `SELECT id, channel, recipient, subject, LEFT(body, 200) as body, dedup_key, recipient_timezone, send_after, status, attempts, last_error, created_at, sent_at
     FROM notification_queue
     ORDER BY created_at DESC
     LIMIT 100`
  );

  const stats = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM notification_queue GROUP BY status`
  );

  return NextResponse.json({ items, stats });
}
