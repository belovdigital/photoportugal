const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export type TelegramTopic = "clients" | "match_requests" | "bookings" | "photographers" | "daily_digest" | "messages" | "alerts" | "stripe" | "concierge";

// Forum topic thread IDs for the PhotoPT Admins group. Each market has its own
// group with its own topics, so these numbers are NOT portable: posting thread
// 220 into the Spanish group fails with "message thread not found" and the
// notification is lost silently. TELEGRAM_TOPIC_IDS overrides the whole map per
// deployment; Portugal keeps these values because its .env does not set it.
const PT_TOPIC_THREAD_IDS: Record<TelegramTopic, number> = {
  clients: 9,
  match_requests: 8,
  bookings: 2,
  photographers: 5,
  daily_digest: 4,
  messages: 21,
  alerts: 220,
  stripe: 361,
  concierge: 442,
};

const TOPIC_THREAD_IDS: Record<TelegramTopic, number> = (() => {
  const raw = process.env.TELEGRAM_TOPIC_IDS;
  if (!raw) return PT_TOPIC_THREAD_IDS;
  try {
    return { ...PT_TOPIC_THREAD_IDS, ...JSON.parse(raw) };
  } catch {
    console.error("[telegram] TELEGRAM_TOPIC_IDS is not valid JSON — falling back to defaults");
    return PT_TOPIC_THREAD_IDS;
  }
})();

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
    if (!res.ok) {
      // Say WHY, loudly. Two failures here are silent and self-inflicted, and
      // both have happened: converting the group to a forum migrates it to a new
      // supergroup id and every later send 400s, and a thread id from another
      // market's group does not exist in this one. A bare "HTTP 400" in the
      // notification log gave no clue which it was.
      const detail = await res.json().catch(() => null);
      const description: string = detail?.description || `HTTP ${res.status}`;
      const migrated = detail?.parameters?.migrate_to_chat_id;
      if (migrated) {
        console.error(
          `[telegram] CHAT MIGRATED — the group became a supergroup. Set TELEGRAM_CHAT_ID=${migrated} in .env; every notification fails until you do.`
        );
      } else if (/thread not found/i.test(description)) {
        console.error(
          `[telegram] Topic "${topic}" (thread ${TOPIC_THREAD_IDS[topic!]}) does not exist in this group. Fix TELEGRAM_TOPIC_IDS in .env.`
        );
      } else {
        console.error(`[telegram] send failed: ${description}`);
      }
      logTelegram(recipient, preview, "failed", description);
      return false;
    }
    logTelegram(recipient, preview, "sent");
    return true;
  } catch (err) {
    console.error("[telegram] send threw:", err);
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
