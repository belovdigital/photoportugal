import { queryOne } from "@/lib/db";

interface ExpoPushMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
}

/**
 * Send a push notification to a user via Expo Push Service.
 * Free, no Firebase needed.
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

    const message: ExpoPushMessage = {
      to: user.push_token,
      title,
      body,
      data,
      sound: "default",
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
        m.logNotification("push" as "sms", userId, `${title}: ${body}`.slice(0, 100), "sent")
      ).catch(() => {});
    }
  } catch (err) {
    console.error("[push] error:", err);
  }
}
