import { queryOne } from "@/lib/db";

/**
 * Send a Telegram notification to a photographer (by photographer_profiles.id).
 * Non-blocking — call with .catch(() => {}) from notification points.
 */
export async function notifyPhotographerViaTelegram(photographerProfileId: string, message: string) {
  try {
    const row = await queryOne<{ telegram_enabled: boolean; telegram_chat_id: string | null }>(
      `SELECT np.telegram_enabled, pp.telegram_chat_id
       FROM photographer_profiles pp
       LEFT JOIN notification_preferences np ON np.user_id = pp.user_id
       WHERE pp.id = $1`,
      [photographerProfileId]
    );
    if (!row?.telegram_enabled || !row.telegram_chat_id) return;

    const { sendTelegramToUser } = await import("@/lib/telegram");
    await sendTelegramToUser(row.telegram_chat_id, message);
  } catch (err) {
    console.error("[telegram] notify photographer error:", err);
  }
}
