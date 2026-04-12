import twilio from "twilio";
import { queryOne } from "@/lib/db";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const US_TOLL_FREE = "+18559462221";

// Countries that don't support alphanumeric sender ID — need a phone number
const NUMERIC_ONLY_COUNTRIES = ["+1", "+55", "+86"]; // US/Canada, Brazil, China

function getSender(to: string): string {
  for (const prefix of NUMERIC_ONLY_COUNTRIES) {
    if (to.startsWith(prefix)) return US_TOLL_FREE;
  }
  return phoneNumber || "PHOTO PT";
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!accountSid || !authToken) {
    console.warn("[sms] Twilio not configured — missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    return false;
  }

  const sender = getSender(to);

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: message,
      from: sender,
      to,
    });
    console.log(`[sms] Sent SMS to ${to}`);
    import("@/lib/notification-log").then(m => m.logNotification("sms", to, message.slice(0, 100), "sent")).catch(() => {});
    return true;
  } catch (error: unknown) {
    const twilioError = error as { code?: number; status?: number; message?: string };
    if (twilioError.code === 21211) {
      console.warn(`[sms] Invalid phone number "${to}" — Twilio error 21211. Message not sent.`);
    } else if (twilioError.code === 21614) {
      console.warn(`[sms] Phone "${to}" is not SMS-capable — Twilio error 21614. Message not sent.`);
    } else if (twilioError.status === 429) {
      console.error(`[sms] CRITICAL: Twilio rate limit hit (429) sending to "${to}". Check usage and limits.`);
    } else {
      console.error(`[sms] Failed to send SMS to "${to}":`, twilioError.code || "", twilioError.message || error);
    }
    import("@/lib/notification-log").then(m => m.logNotification("sms", to, message.slice(0, 100), "failed", String(twilioError.code || ""), twilioError.message || "")).catch(() => {});
    return false;
  }
}

export async function getAdminPhones(): Promise<string[]> {
  try {
    const setting = await queryOne<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'admin_notification_phone'"
    );
    if (setting?.value) return setting.value.split(",").map(p => p.trim()).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

export async function sendAdminSMS(message: string) {
  const phones = await getAdminPhones();
  for (const phone of phones) {
    sendSMS(phone, message).catch(err => console.error("[admin-sms] error:", err));
  }
}
