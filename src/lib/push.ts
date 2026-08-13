import { queryOne } from "@/lib/db";
import { country } from "@/lib/country";

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
  /**
   * Number on the app icon. iOS only — Expo drops it on the FCM leg, so
   * Android's badge is set from inside the app (`setBadgeCountAsync`) and,
   * on launchers that count notifications themselves, by the notification.
   */
  badge?: number;
  /** Expo categoryId — matches mobile-side Notifications.setNotificationCategoryAsync. */
  categoryId?: string;
}

/**
 * Unread chat messages for a user — the number the app icon badge shows.
 *
 * Deliberately the same definition the in-app tab badge uses (see
 * /api/messages/conversations, `unread_count`): messages in this user's
 * conversations that somebody else sent and they have not opened. The two
 * badges disagreeing would be worse than either being slightly wrong.
 *
 * Messages are conversation-scoped, not per-booking, so the client side keys
 * on `client_id` (a user id) and the photographer side on `photographer_id`
 * (a photographer_profiles id) — they are not interchangeable.
 */
export async function unreadMessageCount(
  userId: string,
  role: string | null
): Promise<number> {
  if (role === "photographer") {
    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );
    if (!profile) return 0;
    // ::int matters — COUNT(*) is bigint and node-postgres hands those back
    // as strings, which would reach Expo as "3" and be rejected.
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM messages
        WHERE photographer_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
      [profile.id, userId]
    );
    return row?.n ?? 0;
  }

  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM messages
      WHERE client_id = $1 AND sender_id <> $1 AND read_at IS NULL`,
    [userId]
  );
  return row?.n ?? 0;
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
    const user = await queryOne<{ push_token: string | null; role: string | null }>(
      "SELECT push_token, role FROM users WHERE id = $1",
      [userId]
    );

    if (!user?.push_token) return;

    // Icon badge. Sent on EVERY push, not only chat ones, because the number
    // is absolute rather than a delta: a booking notification arriving while
    // three messages sit unread must carry `3`, or iOS would overwrite the
    // badge with whatever the last push happened to say. A failure here must
    // not cost the notification itself — the badge is the lesser payload.
    let badge: number | undefined;
    try {
      badge = await unreadMessageCount(userId, user.role);
    } catch (err) {
      console.error("[push] badge count failed:", err);
    }

    // Peel the routing hints off `data` so the rest becomes the payload
    // the mobile app reads on tap.
    const threadId = data?.threadId;
    const channelId = data?.channelId || "default";
    const categoryId = data?.categoryId;
    const payload: Record<string, string> = { ...(data || {}) };
    delete payload.threadId;
    delete payload.channelId;
    delete payload.categoryId;
    // Which country sent this. A client can now hold a session in more than
    // one, and every id in the payload is a UUID that exists in exactly one
    // database — without this the app routes a tap into whichever country
    // happens to be active and finds nothing. Stamped here rather than at the
    // sixteen call sites so it cannot be forgotten by a new one.
    payload.country = country.code;

    const message: ExpoPushMessage = {
      to: user.push_token,
      title,
      body,
      data: payload,
      sound: "default",
      ...(badge !== undefined ? { badge } : {}),
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
