import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

function getSecret(): string {
  return process.env.CRON_SECRET || "";
}

export async function POST(req: NextRequest) {
  // Verify the secret in the URL to ensure the request comes from Telegram
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== getSecret()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const update = await req.json();
    const message = update?.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Handle /start — connect Telegram (or bare /start)
    if (text === "/start") {
      await replyToChat(chatId, "Welcome to Photo Portugal notifications!\n\nTo connect your account, use the \"Connect Telegram\" button in your dashboard settings at photoportugal.com/dashboard/settings");
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/start ")) {
      const code = text.replace("/start ", "").trim();
      if (!code) {
        await replyToChat(chatId, "Invalid link. Please use the connect button from your Photo Portugal dashboard.");
        return NextResponse.json({ ok: true });
      }

      // Look up the connect code
      const setting = await queryOne<{ value: string }>(
        "SELECT value FROM platform_settings WHERE key = $1",
        [`tg_connect:${code}`]
      );

      if (!setting) {
        await replyToChat(chatId, "Invalid or expired link. Please generate a new one from your dashboard.");
        return NextResponse.json({ ok: true });
      }

      const data = JSON.parse(setting.value) as { userId: string; expiresAt: string };

      // Check expiration
      if (new Date(data.expiresAt) < new Date()) {
        await queryOne("DELETE FROM platform_settings WHERE key = $1", [`tg_connect:${code}`]);
        await replyToChat(chatId, "This link has expired. Please generate a new one from your dashboard.");
        return NextResponse.json({ ok: true });
      }

      // Delete the code (one-time use)
      await queryOne("DELETE FROM platform_settings WHERE key = $1", [`tg_connect:${code}`]);

      // Verify user exists and is a photographer
      const user = await queryOne<{ id: string; role: string }>(
        "SELECT id, role FROM users WHERE id = $1",
        [data.userId]
      );
      if (!user || user.role !== "photographer") {
        await replyToChat(chatId, "This feature is only available for photographers.");
        return NextResponse.json({ ok: true });
      }

      // Update photographer profile with chat_id
      await queryOne(
        "UPDATE photographer_profiles SET telegram_chat_id = $1 WHERE user_id = $2 RETURNING id",
        [chatId, data.userId]
      );

      // Enable telegram notifications
      await queryOne(
        `INSERT INTO notification_preferences (user_id, telegram_enabled)
         VALUES ($1, TRUE)
         ON CONFLICT (user_id) DO UPDATE SET telegram_enabled = TRUE, updated_at = NOW()`,
        [data.userId]
      );

      await replyToChat(chatId, "✅ Connected! You'll receive booking notifications, messages, and payment alerts here.\n\nSend /stop to disconnect at any time.");
      return NextResponse.json({ ok: true });
    }

    // Handle /stop — disconnect Telegram
    if (text === "/stop") {
      const profile = await queryOne<{ user_id: string }>(
        "SELECT user_id FROM photographer_profiles WHERE telegram_chat_id = $1",
        [chatId]
      );

      if (profile) {
        await queryOne(
          "UPDATE photographer_profiles SET telegram_chat_id = NULL WHERE user_id = $1",
          [profile.user_id]
        );
        await queryOne(
          "UPDATE notification_preferences SET telegram_enabled = FALSE, updated_at = NOW() WHERE user_id = $1",
          [profile.user_id]
        );
        await replyToChat(chatId, "Disconnected. You will no longer receive notifications here.\n\nTo reconnect, use the button in your Photo Portugal dashboard.");
      } else {
        await replyToChat(chatId, "No account is linked to this chat.");
      }

      return NextResponse.json({ ok: true });
    }

    // Unknown command
    if (text.startsWith("/")) {
      await replyToChat(chatId, "Available commands:\n/stop — Disconnect notifications");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram/webhook] error:", err);
    return NextResponse.json({ ok: true });
  }
}

async function replyToChat(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("[telegram/webhook] reply error:", err);
  }
}
