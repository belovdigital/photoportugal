import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

function getSecret(): string {
  return process.env.CRON_SECRET || "";
}

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return s;
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

    // Handle /start TOKEN — connect Telegram
    if (text.startsWith("/start ")) {
      const token = text.replace("/start ", "").trim();
      if (!token) {
        await replyToChat(chatId, "Invalid link. Please use the connect button from your Photo Portugal dashboard.");
        return NextResponse.json({ ok: true });
      }

      try {
        const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; type: string };
        if (decoded.type !== "telegram_connect") {
          await replyToChat(chatId, "Invalid token. Please try again from your dashboard.");
          return NextResponse.json({ ok: true });
        }

        // Verify user exists and is a photographer
        const user = await queryOne<{ id: string; role: string }>(
          "SELECT id, role FROM users WHERE id = $1",
          [decoded.userId]
        );
        if (!user || user.role !== "photographer") {
          await replyToChat(chatId, "This feature is only available for photographers.");
          return NextResponse.json({ ok: true });
        }

        // Update photographer profile with chat_id
        await queryOne(
          "UPDATE photographer_profiles SET telegram_chat_id = $1 WHERE user_id = $2 RETURNING id",
          [chatId, decoded.userId]
        );

        // Enable telegram notifications
        await queryOne(
          `INSERT INTO notification_preferences (user_id, telegram_enabled)
           VALUES ($1, TRUE)
           ON CONFLICT (user_id) DO UPDATE SET telegram_enabled = TRUE, updated_at = NOW()`,
          [decoded.userId]
        );

        await replyToChat(chatId, "Connected! You'll receive booking notifications, messages, and payment alerts here.\n\nSend /stop to disconnect at any time.");
      } catch (err) {
        const isExpired = err instanceof jwt.TokenExpiredError;
        await replyToChat(chatId, isExpired
          ? "This link has expired. Please generate a new one from your dashboard."
          : "Invalid or expired link. Please try again from your dashboard."
        );
      }

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
