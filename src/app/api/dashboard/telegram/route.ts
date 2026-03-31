import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import crypto from "crypto";

// GET — check connection status
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await queryOne<{ telegram_chat_id: string | null }>(
      "SELECT telegram_chat_id FROM photographer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

    const prefs = await queryOne<{ telegram_enabled: boolean }>(
      "SELECT telegram_enabled FROM notification_preferences WHERE user_id = $1",
      [user.id]
    );

    return NextResponse.json({
      connected: !!profile.telegram_chat_id,
      enabled: prefs?.telegram_enabled ?? false,
    });
  } catch {
    return NextResponse.json({ connected: false, enabled: false });
  }
}

// POST — generate connect link
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

    // Generate short code (Telegram /start param limited to 64 chars)
    const code = crypto.randomBytes(16).toString("hex"); // 32 chars
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Store code in DB
    await queryOne(
      `INSERT INTO platform_settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [`tg_connect:${code}`, JSON.stringify({ userId: user.id, expiresAt: expiresAt.toISOString() })]
    );

    return NextResponse.json({
      url: `https://t.me/photopt_bot?start=${code}`,
    });
  } catch (err) {
    console.error("[dashboard/telegram] POST error:", err);
    return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
  }
}

// DELETE — disconnect telegram
export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await queryOne(
      "UPDATE photographer_profiles SET telegram_chat_id = NULL WHERE user_id = $1",
      [user.id]
    );
    await queryOne(
      "UPDATE notification_preferences SET telegram_enabled = FALSE, updated_at = NOW() WHERE user_id = $1",
      [user.id]
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}

// PATCH — toggle telegram_enabled
export async function PATCH(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { enabled } = await req.json();

    // Only allow enabling if telegram_chat_id is set
    if (enabled) {
      const profile = await queryOne<{ telegram_chat_id: string | null }>(
        "SELECT telegram_chat_id FROM photographer_profiles WHERE user_id = $1",
        [user.id]
      );
      if (!profile?.telegram_chat_id) {
        return NextResponse.json({ error: "Connect Telegram first" }, { status: 400 });
      }
    }

    await queryOne(
      `INSERT INTO notification_preferences (user_id, telegram_enabled)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET telegram_enabled = $2, updated_at = NOW()`,
      [user.id, !!enabled]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
