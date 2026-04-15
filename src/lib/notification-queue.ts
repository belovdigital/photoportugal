/**
 * Timezone-aware notification queue for SMS and email.
 *
 * Scheduled reminders (from cron) go through queueNotification() which checks
 * recipient's local time. If 9:00-21:00 → sends immediately; otherwise → queues
 * for next 9:00 AM local time. Real-time notifications (new booking, new message,
 * payment received) bypass this and call sendSMS/sendEmail directly.
 *
 * Dedup: UNIQUE constraint on dedup_key prevents any possibility of duplicates.
 */

import { query, queryOne } from "@/lib/db";
import { parsePhone } from "@/lib/phone-codes";
import { sendSMS } from "@/lib/sms";

// ── Timezone mapping ───────────────────────────────────────────────

const COUNTRY_CODE_TO_TIMEZONE: Record<string, string> = {
  "+1":   "America/New_York",
  "+7":   "Europe/Moscow",
  "+27":  "Africa/Johannesburg",
  "+30":  "Europe/Athens",
  "+31":  "Europe/Amsterdam",
  "+32":  "Europe/Brussels",
  "+33":  "Europe/Paris",
  "+34":  "Europe/Madrid",
  "+39":  "Europe/Rome",
  "+41":  "Europe/Zurich",
  "+43":  "Europe/Vienna",
  "+44":  "Europe/London",
  "+45":  "Europe/Copenhagen",
  "+46":  "Europe/Stockholm",
  "+47":  "Europe/Oslo",
  "+48":  "Europe/Warsaw",
  "+49":  "Europe/Berlin",
  "+52":  "America/Mexico_City",
  "+55":  "America/Sao_Paulo",
  "+60":  "Asia/Kuala_Lumpur",
  "+61":  "Australia/Sydney",
  "+64":  "Pacific/Auckland",
  "+65":  "Asia/Singapore",
  "+66":  "Asia/Bangkok",
  "+81":  "Asia/Tokyo",
  "+82":  "Asia/Seoul",
  "+86":  "Asia/Shanghai",
  "+90":  "Europe/Istanbul",
  "+91":  "Asia/Kolkata",
  "+351": "Europe/Lisbon",
  "+353": "Europe/Dublin",
  "+380": "Europe/Kyiv",
  "+966": "Asia/Riyadh",
  "+971": "Asia/Dubai",
  "+972": "Asia/Jerusalem",
};

const SEND_HOUR_START = 9;  // 09:00 local
const SEND_HOUR_END = 21;   // 21:00 local

export function getTimezoneForPhone(phone: string): string {
  const { code } = parsePhone(phone);
  return COUNTRY_CODE_TO_TIMEZONE[code] || "Europe/Lisbon";
}

/** Get current hour (0-23) in a given IANA timezone */
function getLocalHour(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

/** Check if current time is within sending hours in the given timezone */
export function isWithinSendingHours(timezone: string): boolean {
  const hour = getLocalHour(timezone);
  return hour >= SEND_HOUR_START && hour < SEND_HOUR_END;
}

/** Compute next 9:00 AM in the given timezone as a UTC Date */
function nextSendTime(timezone: string): Date {
  const now = new Date();

  // Get full local date/time parts in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
  const localHour = get("hour");
  const localYear = get("year");
  const localMonth = get("month");
  const localDay = get("day");

  // If before 9am local, target is today 9:00; otherwise tomorrow 9:00
  let targetDate: Date;
  if (localHour < SEND_HOUR_START) {
    targetDate = new Date(`${localYear}-${String(localMonth).padStart(2, "0")}-${String(localDay).padStart(2, "0")}T09:00:00`);
  } else {
    // Tomorrow
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tmParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(tomorrow);
    const tGet = (type: string) => parseInt(tmParts.find(p => p.type === type)?.value || "0", 10);
    targetDate = new Date(`${tGet("year")}-${String(tGet("month")).padStart(2, "0")}-${String(tGet("day")).padStart(2, "0")}T09:00:00`);
  }

  // Convert the "wall clock 9:00 in target tz" to UTC
  // Use Intl to find the offset
  const probe = new Date(targetDate.toISOString().replace("Z", ""));
  const utcStr = probe.toLocaleString("en-US", { timeZone: "UTC" });
  const localStr = probe.toLocaleString("en-US", { timeZone: timezone });
  const offsetMs = new Date(utcStr).getTime() - new Date(localStr).getTime();

  return new Date(targetDate.getTime() + offsetMs);
}

// ── Queue operations ───────────────────────────────────────────────

interface QueueOptions {
  channel: "sms" | "email";
  recipient: string;            // phone number or email
  subject?: string;             // for email
  body: string;                 // SMS text or email HTML
  emailTemplate?: string;       // email template function name
  emailParams?: Record<string, unknown>; // params for the template
  dedupKey: string;             // e.g. "payment_reminder_sms:booking-uuid"
  recipientPhone?: string;      // phone for timezone detection (for email, pass user's phone)
}

interface QueueResult {
  queued: boolean;
  immediate: boolean;
  skippedDuplicate: boolean;
}

/**
 * Queue a notification with timezone awareness.
 * - If within sending hours → sends immediately
 * - If outside hours → stores in DB for later processing
 * - Dedup via UNIQUE constraint on dedup_key
 */
export async function queueNotification(opts: QueueOptions): Promise<QueueResult> {
  const phone = opts.channel === "sms" ? opts.recipient : opts.recipientPhone;
  const timezone = phone ? getTimezoneForPhone(phone) : "Europe/Lisbon";

  if (isWithinSendingHours(timezone)) {
    // Send immediately — insert temporarily for dedup, delete after success
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO notification_queue (channel, recipient, subject, body, dedup_key, recipient_timezone, send_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'pending')
       ON CONFLICT (dedup_key) DO NOTHING
       RETURNING id`,
      [opts.channel, opts.recipient, opts.subject || null, opts.body, opts.dedupKey, timezone]
    );

    if (!inserted) {
      return { queued: false, immediate: false, skippedDuplicate: true };
    }

    // Actually send
    try {
      if (opts.channel === "sms") {
        await sendSMS(opts.recipient, opts.body);
      } else {
        await sendQueuedEmail(opts);
      }
      // Success — remove from queue (logs are in notification_logs via sendSMS/sendEmail)
      await queryOne("DELETE FROM notification_queue WHERE id = $1", [inserted.id]);
    } catch (err) {
      console.error(`[notification-queue] Immediate send failed for ${opts.dedupKey}:`, err);
      // Keep as pending so queue processor retries
      await queryOne(
        "UPDATE notification_queue SET last_error = $1 WHERE id = $2",
        [String(err), inserted.id]
      );
      return { queued: true, immediate: false, skippedDuplicate: false };
    }

    return { queued: false, immediate: true, skippedDuplicate: false };
  }

  // Outside sending hours — queue for next 9:00 AM local
  const sendAfter = nextSendTime(timezone);
  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO notification_queue (channel, recipient, subject, body, dedup_key, recipient_timezone, send_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING id`,
    [opts.channel, opts.recipient, opts.subject || null, opts.body, opts.dedupKey, timezone, sendAfter.toISOString()]
  );

  if (!inserted) {
    return { queued: false, immediate: false, skippedDuplicate: true };
  }

  console.log(`[notification-queue] Queued ${opts.channel} for ${opts.recipient} (${timezone}), send after ${sendAfter.toISOString()}`);
  return { queued: true, immediate: false, skippedDuplicate: false };
}

// ── Queue processor (called from cron) ─────────────────────────────

const MAX_PER_RUN = 50;
const MAX_ATTEMPTS = 3;

export async function processNotificationQueue(): Promise<number> {
  const pending = await query<{
    id: string;
    channel: string;
    recipient: string;
    subject: string | null;
    body: string;
    dedup_key: string;
    attempts: number;
  }>(
    `SELECT id, channel, recipient, subject, body, dedup_key, attempts
     FROM notification_queue
     WHERE status = 'pending' AND send_after <= NOW()
     ORDER BY send_after ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [MAX_PER_RUN]
  );

  let processed = 0;

  for (const item of pending) {
    try {
      if (item.channel === "sms") {
        await sendSMS(item.recipient, item.body);
      } else {
        // For queued emails, body contains the pre-rendered HTML
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(item.recipient, item.subject || "Photo Portugal", item.body);
      }

      // Success — remove from queue (logs are in notification_logs via sendSMS/sendEmail)
      await queryOne("DELETE FROM notification_queue WHERE id = $1", [item.id]);
      processed++;
    } catch (err) {
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await queryOne(
          "UPDATE notification_queue SET status = 'failed', attempts = $1, last_error = $2 WHERE id = $3",
          [attempts, String(err), item.id]
        );
        console.error(`[notification-queue] Permanently failed after ${MAX_ATTEMPTS} attempts: ${item.dedup_key}`);
      } else {
        await queryOne(
          "UPDATE notification_queue SET attempts = $1, last_error = $2 WHERE id = $3",
          [attempts, String(err), item.id]
        );
        console.warn(`[notification-queue] Attempt ${attempts} failed for ${item.dedup_key}: ${err}`);
      }
    }
  }

  // Cleanup old failed entries (> 7 days)
  await queryOne(
    "DELETE FROM notification_queue WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days'"
  );

  if (processed > 0) {
    console.log(`[notification-queue] Processed ${processed} queued notifications`);
  }

  return processed;
}

// ── Email helper ───────────────────────────────────────────────────

async function sendQueuedEmail(opts: QueueOptions): Promise<void> {
  const { sendEmail } = await import("@/lib/email");
  await sendEmail(opts.recipient, opts.subject || "Photo Portugal", opts.body);
}
