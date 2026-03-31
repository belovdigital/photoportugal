import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return s;
}

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

    const token = jwt.sign(
      { userId: user.id, type: "telegram_connect" },
      getJwtSecret(),
      { expiresIn: "10m" }
    );

    // Telegram deep link: t.me/BOT_USERNAME?start=TOKEN
    // The bot username is derived from the bot token via Telegram API at setup time.
    // We use a generic format that works with any bot username.
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return NextResponse.json({ error: "Telegram not configured" }, { status: 500 });

    // Fetch bot username from Telegram API
    const botInfo = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botData = await botInfo.json();
    const botUsername = botData?.result?.username;
    if (!botUsername) return NextResponse.json({ error: "Could not fetch bot info" }, { status: 500 });

    return NextResponse.json({
      url: `https://t.me/${botUsername}?start=${token}`,
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
