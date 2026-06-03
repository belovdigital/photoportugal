import { queryOne } from "@/lib/db";

interface ExpoPushMessage {
  to: string;
  title?: string;
  subtitle?: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
  /** iOS: groups notifications under the same thread (e.g. one chat). */
  threadId?: string;
  /** Android: which channel to use (configured in the mobile app). */
  channelId?: string;
  /** Android: badge count delta. */
  badge?: number;
  /** Expo categoryId — matches mobile-side Notifications.setNotificationCategoryAsync. */
  categoryId?: string;
}

/**
 * Send a push notification to a user via Expo Push Service.
 *
 * `data` may include the special keys `threadId` (string) and `channelId`
 * (string) — they're lifted to the top level of the Expo payload so iOS
 * groups the notification and Android routes it to the right channel.
 * Everything else in `data` is passed through to the mobile app for
 * deep-linking.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    const user = await queryOne<{ push_token: string | null }>(
      "SELECT push_token FROM users WHERE id = $1",
      [userId]
    );

    if (!user?.push_token) return;

    // Peel the routing hints off `data` so the rest becomes the payload
    // the mobile app reads on tap.
    const threadId = data?.threadId;
    const channelId = data?.channelId || "default";
    const categoryId = data?.categoryId;
    const payload: Record<string, string> = { ...(data || {}) };
    delete payload.threadId;
    delete payload.channelId;
    delete payload.categoryId;

    const message: ExpoPushMessage = {
      to: user.push_token,
      title,
      body,
      data: payload,
      sound: "default",
      ...(threadId ? { threadId } : {}),
      ...(channelId ? { channelId } : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.error("[push] Expo push failed:", await res.text());
    } else {
      console.log(`[push] Sent to ${userId}: ${title}`);
      import("@/lib/notification-log").then(m =>
        m.logNotification("push", userId, `${title}: ${body}`.slice(0, 100), "sent")
      ).catch(() => {});
    }
  } catch (err) {
    console.error("[push] error:", err);
  }
}
