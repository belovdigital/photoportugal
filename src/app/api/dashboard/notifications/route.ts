import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  try {
    const prefs = await queryOne<{ email_bookings: boolean; email_messages: boolean; email_reviews: boolean; sms_bookings: boolean; telegram_enabled: boolean }>(
      "SELECT email_bookings, email_messages, email_reviews, sms_bookings, telegram_enabled FROM notification_preferences WHERE user_id = $1",
      [userId]
    );
    return NextResponse.json(prefs || { email_bookings: true, email_messages: true, email_reviews: true, sms_bookings: true, telegram_enabled: false });
  } catch {
    return NextResponse.json({ email_bookings: true, email_messages: true, email_reviews: true, sms_bookings: true, telegram_enabled: false });
  }
}

export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  try {
    const { email_bookings, email_messages, email_reviews, sms_bookings } = await req.json();
    await queryOne(
      `INSERT INTO notification_preferences (user_id, email_bookings, email_messages, email_reviews, sms_bookings, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET email_bookings = $2, email_messages = $3, email_reviews = $4, sms_bookings = $5, updated_at = NOW()`,
      [userId, email_bookings ?? true, email_messages ?? true, email_reviews ?? true, sms_bookings ?? true]
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
