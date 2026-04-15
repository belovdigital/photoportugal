const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Forum topic thread IDs for PhotoPT Admins group
export type TelegramTopic = "clients" | "match_requests" | "bookings" | "photographers" | "daily_digest";

const TOPIC_THREAD_IDS: Record<TelegramTopic, number> = {
  clients: 9,
  match_requests: 8,
  bookings: 2,
  photographers: 5,
  daily_digest: 4,
};

function logTelegram(recipient: string, event: string, status: "sent" | "failed", error?: string) {
  import("@/lib/notification-log").then(m => m.logNotification("telegram", recipient, event.slice(0, 100), status, undefined, error)).catch(() => {});
}

export async function sendTelegram(message: string, topic?: TelegramTopic): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  const recipient = topic ? `admin:${topic}` : "admin:general";
  const preview = message.replace(/<[^>]*>/g, "").slice(0, 100);
  try {
    const body: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (topic && TOPIC_THREAD_IDS[topic]) {
      body.message_thread_id = TOPIC_THREAD_IDS[topic];
    }
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    logTelegram(recipient, preview, res.ok ? "sent" : "failed", res.ok ? undefined : `HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    logTelegram(recipient, preview, "failed", String(err));
    return false;
  }
}

/** Send a Telegram message to a specific user chat (for photographer notifications) */
export async function sendTelegramToUser(chatId: string, message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return false;
  const preview = message.replace(/<[^>]*>/g, "").slice(0, 100);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          disable_web_page_preview: true,
        }),
      }
    );
    logTelegram(`user:${chatId}`, preview, res.ok ? "sent" : "failed", res.ok ? undefined : `HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    logTelegram(`user:${chatId}`, preview, "failed", String(err));
    return false;
  }
}
