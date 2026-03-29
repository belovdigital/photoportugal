import { queryOne } from "@/lib/db";

export async function logNotification(
  channel: "email" | "sms" | "whatsapp",
  recipient: string,
  event: string,
  status: "sent" | "failed" | "fallback",
  errorCode?: string,
  errorMessage?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await queryOne(
      `INSERT INTO notification_logs (channel, recipient, event, status, error_code, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [channel, recipient, event, status, errorCode || null, errorMessage || null, metadata ? JSON.stringify(metadata) : "{}"]
    );
  } catch (err) {
    console.error("[notification-log] failed to log:", err);
  }
}

/** Clean up logs older than 30 days */
export async function cleanOldNotificationLogs() {
  try {
    await queryOne("DELETE FROM notification_logs WHERE created_at < NOW() - INTERVAL '30 days'");
  } catch {}
}
