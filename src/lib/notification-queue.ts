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

import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import { parsePhone } from "@/lib/phone-codes";
import { sendSMS } from "@/lib/sms";
import { country } from "@/lib/country";
import type { EmailSendResult } from "@/lib/email";

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
  return COUNTRY_CODE_TO_TIMEZONE[code] || country.timezone;
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
  const timezone = phone ? getTimezoneForPhone(phone) : country.timezone;

  if (isWithinSendingHours(timezone)) {
    // Send immediately — insert temporarily for dedup, delete after success.
    //
    // `send_after` is parked an hour out ON PURPOSE. With `NOW()` the row
    // satisfied processNotificationQueue's `status='pending' AND
    // send_after <= NOW()` from the instant this INSERT committed
    // (db.ts query() autocommits), so the every-minute queue cron could
    // pick up the row and send it a SECOND time while this send was still
    // in flight — the whole SMTP/Twilio round-trip was an open race window.
    // Parking it means the row exists for dedup but is invisible to the
    // processor until we DELETE it below. If the process dies mid-send the
    // row falls due in an hour and gets delivered, instead of vanishing.
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO notification_queue (channel, recipient, subject, body, dedup_key, recipient_timezone, send_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour', 'pending')
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
        // The catch below was always written for this and never got to run:
        // sendEmail swallowed its own failures, so a refused message was
        // DELETEd as if delivered. Now the verdict comes back and the row
        // we parked above becomes the retry.
        const res = await sendQueuedEmail(opts);
        if (!res.ok) throw new Error(res.error || "email send failed");
      }
      // Success — remove from queue (logs are in notification_logs via sendSMS/sendEmail)
      await queryOne("DELETE FROM notification_queue WHERE id = $1", [inserted.id]);
    } catch (err) {
      console.error(`[notification-queue] Immediate send failed for ${opts.dedupKey}:`, err);
      // Keep as pending so queue processor retries — and pull send_after
      // back to now, otherwise the row we parked above sits idle for an
      // hour before anyone retries it.
      await queryOne(
        "UPDATE notification_queue SET last_error = $1, send_after = NOW() WHERE id = $2",
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

// ── Delayed-with-cancel for new-message email/SMS ──────────────────
//
// Pattern: when a new chat message arrives, instead of firing
// email/SMS immediately, we drop a row with event_kind='new_message'
// and `send_after = NOW() + 3 min`. The processor below re-checks
// before sending whether the recipient has read / replied / is online
// / has the mobile app — and cancels if so. Telegram-style: silent
// when the other side is engaged, loud only when they actually missed
// it.
//
// Push notifications stay IMMEDIATE (firing in api/messages/route.ts)
// — they're cheap, lightweight, and don't have the spam problem.

const NEW_MESSAGE_DELAY_SEC = 3 * 60;
const ONLINE_WINDOW_SEC = 60;

interface EnqueueNewMessageOpts {
  recipientId: string;
  recipient: string;        // email or phone (matches the channel)
  messageId: string;
  bookingId: string;
  channel: "email" | "sms";
  body: string;
  subject?: string;
  delaySec?: number;
}

/**
 * Enqueue a delayed new-message notification, coalescing duplicates.
 * If there's already a pending row for the same (recipientId, channel,
 * bookingId), we skip — the next message in the same chat just rides
 * along with the existing one rather than triggering a second notif.
 */
export async function enqueueNewMessageNotif(opts: EnqueueNewMessageOpts): Promise<void> {
  if (!opts.recipient) return;

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM notification_queue
      WHERE status = 'pending'
        AND event_kind = 'new_message'
        AND recipient_id = $1
        AND channel = $2
        AND booking_id = $3
      LIMIT 1`,
    [opts.recipientId, opts.channel, opts.bookingId]
  );
  if (existing) return; // coalesce

  const delay = opts.delaySec ?? NEW_MESSAGE_DELAY_SEC;
  const sendAfter = new Date(Date.now() + delay * 1000).toISOString();
  const dedupKey = `nm:${opts.messageId}:${opts.channel}`;
  const tz = opts.channel === "sms" ? getTimezoneForPhone(opts.recipient) : country.timezone;

  await queryOne(
    `INSERT INTO notification_queue
       (recipient_id, recipient, message_id, booking_id, channel, event_kind,
        subject, body, send_after, recipient_timezone, dedup_key, status)
     VALUES ($1, $2, $3, $4, $5, 'new_message', $6, $7, $8, $9, $10, 'pending')
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING id`,
    [
      opts.recipientId,
      opts.recipient,
      opts.messageId,
      opts.bookingId,
      opts.channel,
      opts.subject || `New message — ${country.brand}`,
      opts.body,
      sendAfter,
      tz,
      dedupKey,
    ]
  );
}

// ── Client welcome, held back until the role settles ───────────────
//
// Signing up as a photographer starts as a client: the account is created
// first, and applyUserRole flips the role seconds later. Sending the client
// welcome on the spot meant one person got two welcome emails seven seconds
// apart (Nina bulusan, 2026-08-04 — "Welcome to Photo Spain!" at 11:34:10 and
// "Let's get you started!" at 11:34:17).
//
// Ten minutes is well past the window that matters: applyUserRole only
// converts an account created in the last five minutes, or an empty one.
//
// The row's `body` holds the recipient's NAME rather than HTML, because the
// client welcome is localized and worth rendering at send time — if they pick
// a language in those ten minutes, they get that one.
const CLIENT_WELCOME_DELAY_MIN = 10;

export async function enqueueClientWelcome(userId: string, email: string, name: string): Promise<void> {
  if (!userId || !email) return;
  try {
    await queryOne(
      `INSERT INTO notification_queue
         (recipient_id, recipient, channel, event_kind, body, send_after, recipient_timezone, dedup_key, status)
       VALUES ($1, $2, 'email', 'welcome_client', $3,
               NOW() + INTERVAL '${CLIENT_WELCOME_DELAY_MIN} minutes', $4, $5, 'pending')
       ON CONFLICT (dedup_key) DO NOTHING
       RETURNING id`,
      [userId, email, name || "there", country.timezone, `welcome:${userId}`]
    );
  } catch (err) {
    // A welcome email is not worth failing a signup over.
    console.error("[notification-queue] enqueueClientWelcome failed:", err);
  }
}

/**
 * Cancel-conditions check for a queued new-message notification.
 * Returns a string reason to cancel, or null to proceed with delivery.
 */
async function shouldCancelNewMessage(row: {
  id: string;
  recipient_id: string | null;
  message_id: string | null;
  booking_id: string | null;
  channel: string;
}): Promise<string | null> {
  if (!row.recipient_id || !row.message_id || !row.booking_id) return null;

  const msg = await queryOne<{ read_at: string | null; created_at: string }>(
    "SELECT read_at, created_at FROM messages WHERE id = $1",
    [row.message_id]
  );
  if (!msg) return "missing_message";
  if (msg.read_at) return "read";

  // Recipient sent any message in this booking after the trigger arrived
  // — they're already actively engaged, no notification needed.
  const reply = await queryOne(
    `SELECT id FROM messages
      WHERE booking_id = $1 AND sender_id = $2 AND created_at > $3
      LIMIT 1`,
    [row.booking_id, row.recipient_id, msg.created_at]
  );
  if (reply) return "replied";

  // Currently online (active session in last ONLINE_WINDOW_SEC).
  const presence = await queryOne<{ last_seen_at: string | null }>(
    "SELECT last_seen_at FROM users WHERE id = $1",
    [row.recipient_id]
  );
  const lastSeen = presence?.last_seen_at ? new Date(presence.last_seen_at).getTime() : 0;
  if (Date.now() - lastSeen < ONLINE_WINDOW_SEC * 1000) return "online";

  // SMS-specific: skip if recipient has the mobile app installed (push
  // already covered them; double-notifying with both push + SMS is the
  // exact spam problem we're trying to fix).
  if (row.channel === "sms") {
    const tokenRow = await queryOne<{ push_token: string | null }>(
      "SELECT push_token FROM users WHERE id = $1",
      [row.recipient_id]
    );
    if (tokenRow?.push_token) return "has_app";
  }

  return null;
}

// ── Queue processor (called from cron) ─────────────────────────────

const MAX_PER_RUN = 50;
const MAX_ATTEMPTS = 3;

// Two ladders on purpose. MAX_ATTEMPTS above still means "handling this
// row blew up" — a DB hiccup, a bad dynamic import — and three tries a
// minute apart is right for that. An SMTP rejection is a different
// animal: Migadu deferred a real message with 451 for about two hours on
// 2026-08-11, and a three-tries-in-three-minutes ladder declares that
// dead before the provider has even changed its mind.
const EMAIL_BACKOFF_MIN = [2, 5, 15, 45, 120, 240, 480, 480]; // ~23h of rungs
// Measured from created_at, which for a night-queued row is hours before
// the first attempt — hence 36 rather than 24, so the ladder is what
// decides, and this is only the backstop against an immortal row.
const EMAIL_GIVE_UP_HOURS = 36;
/**
 * Stop starting new items after a minute. The claim holds a 10-minute
 * lease, so anything not reached simply falls due again with its lease
 * intact; the point is only to keep a slow pass from running into the
 * next one's lease and letting two passes send the same row.
 */
const RUN_DEADLINE_MS = 60_000;

export async function processNotificationQueue(): Promise<number> {
  const pending = await query<{
    id: string;
    channel: string;
    recipient: string;
    subject: string | null;
    body: string;
    dedup_key: string;
    attempts: number;
    event_kind: string | null;
    recipient_id: string | null;
    message_id: string | null;
    booking_id: string | null;
    created_at: Date;
    reply_to: string | null;
  }>(
    // Claim rows by LEASE, in a single statement.
    //
    // The old form was a bare `SELECT ... FOR UPDATE SKIP LOCKED`. That
    // lock was useless here: db.ts query() is a lone pool.query(), so the
    // implicit transaction commits — and releases every row lock — the
    // moment the SELECT returns, long before the send loop below runs.
    // Nothing marked the rows as taken either; they stayed 'pending' from
    // SELECT until the DELETE after sending. Two overlapping runs of this
    // cron (it fires every minute, a drain of 50 can outlast that) both
    // saw the same rows and both sent them.
    //
    // Wrapping the same SELECT inside an UPDATE makes SKIP LOCKED do real
    // work: lock and state change happen in one statement, which is what
    // autocommit can express. Concurrent drains now get disjoint sets.
    // Pushing send_after out by 10 minutes is the lease — it self-expires,
    // so a crashed run needs no reaper, the rows simply fall due again.
    `UPDATE notification_queue q
        SET send_after = NOW() + INTERVAL '10 minutes',
            attempts   = q.attempts + 1
       FROM (SELECT id FROM notification_queue
              WHERE status = 'pending' AND send_after <= NOW()
              ORDER BY send_after ASC
              LIMIT $1
              FOR UPDATE SKIP LOCKED) s
      WHERE q.id = s.id
     RETURNING q.id, q.channel, q.recipient, q.subject, q.body, q.dedup_key,
               q.attempts, q.event_kind, q.recipient_id, q.message_id, q.booking_id,
               q.created_at, q.reply_to`,
    [MAX_PER_RUN]
  );

  let processed = 0;
  const runStartedAt = Date.now();

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    if (Date.now() - runStartedAt > RUN_DEADLINE_MS) {
      console.warn(`[notification-queue] Pass hit ${RUN_DEADLINE_MS / 1000}s deadline, leaving ${pending.length - i} rows for the next one`);
      break;
    }
    try {
      // For new-message notifs, re-check cancel conditions just before
      // sending. If the recipient already saw the message / replied /
      // is online / has the app — skip the email or SMS entirely.
      if (item.event_kind === "new_message") {
        const reason = await shouldCancelNewMessage({
          id: item.id,
          recipient_id: item.recipient_id,
          message_id: item.message_id,
          booking_id: item.booking_id,
          channel: item.channel,
        });
        if (reason) {
          await queryOne(
            `UPDATE notification_queue
                SET status = 'cancelled', cancel_reason = $2, sent_at = NOW()
              WHERE id = $1 RETURNING id`,
            [item.id, reason]
          );
          continue;
        }
      }

      // The whole point of the delay: if they turned out to be a
      // photographer, that welcome has already gone out and this one is the
      // duplicate we were waiting to avoid.
      if (item.event_kind === "welcome_client") {
        const u = await queryOne<{ role: string | null }>(
          "SELECT role FROM users WHERE id = $1",
          [item.recipient_id]
        );
        if (!u || u.role === "photographer") {
          await queryOne(
            `UPDATE notification_queue
                SET status = 'cancelled', cancel_reason = $2, sent_at = NOW()
              WHERE id = $1 RETURNING id`,
            [item.id, u ? "became_photographer" : "user_gone"]
          );
          continue;
        }
        const { sendWelcomeEmail } = await import("@/lib/email");
        await sendWelcomeEmail(item.recipient, item.body, "client");
        await queryOne("DELETE FROM notification_queue WHERE id = $1", [item.id]);
        processed++;
        continue;
      }

      if (item.channel === "email") {
        // For queued emails, body contains the pre-rendered HTML.
        const { sendEmailWithResult } = await import("@/lib/email");
        const res = await sendEmailWithResult(item.recipient, item.subject || country.brand, item.body, {
          replyTo: item.reply_to || undefined,
          park: false, // we ARE the parking lot
        });
        if (res.ok) {
          await queryOne("DELETE FROM notification_queue WHERE id = $1", [item.id]);
          processed++;
          continue;
        }
        // This is the bug the whole change exists for: a refused email
        // used to be DELETEd here exactly like a delivered one, which is
        // why prod had zero failed rows and max(attempts)=1 since May.
        await scheduleEmailRetry(item, res.error || "send failed");
        continue;
      }

      // SMS still swallows its own failures (sms.ts returns false rather
      // than throwing), so a bounced SMS is still deleted as if sent. Same
      // bug, deliberately out of scope here — fixing it means deciding
      // whether an invalid-number 21211 should page, which is its own call.
      await sendSMS(item.recipient, item.body);

      // Success — remove from queue (logs are in notification_logs via sendSMS)
      await queryOne("DELETE FROM notification_queue WHERE id = $1", [item.id]);
      processed++;
    } catch (err) {
      // An email row that blew up on the DB/import side still has good
      // rungs left on its own ladder; the three-strike rule below would
      // kill it at attempt 3 of 8.
      if (item.channel === "email") {
        await scheduleEmailRetry(item, String(err));
        continue;
      }
      // The claim above already bumped `attempts`, so item.attempts is the
      // post-increment value — don't add to it again or every failure
      // would burn two of the three allowed tries.
      const attempts = item.attempts;
      if (attempts >= MAX_ATTEMPTS) {
        await queryOne(
          "UPDATE notification_queue SET status = 'failed', last_error = $1 WHERE id = $2",
          [String(err), item.id]
        );
        console.error(`[notification-queue] Permanently failed after ${MAX_ATTEMPTS} attempts: ${item.dedup_key}`);
      } else {
        // Release the lease early so the retry doesn't wait out the full
        // 10 minutes — a failed send should come back on the next tick.
        await queryOne(
          "UPDATE notification_queue SET send_after = NOW(), last_error = $1 WHERE id = $2",
          [String(err), item.id]
        );
        console.warn(`[notification-queue] Attempt ${attempts} failed for ${item.dedup_key}: ${err}`);
      }
    }
  }

  // Unconditional: a message can also be marked dead outside a pass (the
  // inline path in queueNotification), and gating this on "did anything
  // die in THIS pass" is how a death goes unreported until the 7-day
  // sweep deletes the evidence.
  await alertDeadEmails();

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

async function sendQueuedEmail(opts: QueueOptions): Promise<EmailSendResult> {
  const { sendEmailWithResult } = await import("@/lib/email");
  // park:false — the row the caller just inserted IS the parking spot;
  // parking again would leave two rows for one message.
  return sendEmailWithResult(opts.recipient, opts.subject || country.brand, opts.body, { park: false });
}

// ── Retry ladder for refused email ─────────────────────────────────

/**
 * Park a message that sendEmail could not deliver, so the every-minute
 * cron can keep trying for the next day instead of the message simply
 * ceasing to exist. Called from sendEmail's failure path for all ~85
 * direct call sites; the queue processor passes `park: false` and uses
 * scheduleEmailRetry on its own row instead.
 */
export async function parkFailedEmail(opts: {
  recipient: string;
  subject: string;
  html: string;
  replyTo?: string;
  lastError: string;
}): Promise<void> {
  // dedup_key is UNIQUE across the whole table and every other writer
  // uses it to coalesce; here there is nothing to coalesce with, so it
  // gets a fresh id. A shared key would only create a way for one dead
  // row to silently swallow the next failure of the same message.
  await queryOne(
    `INSERT INTO notification_queue
       (channel, recipient, subject, body, reply_to, dedup_key, recipient_timezone,
        send_after, status, attempts, last_error, event_kind)
     VALUES ('email', $1, $2, $3, $4, $5, $6, NOW() + INTERVAL '2 minutes', 'pending', 1, $7, 'retry_email')
     RETURNING id`,
    [
      opts.recipient,
      opts.subject.slice(0, 500),
      opts.html,
      opts.replyTo || null,
      `retry:${randomUUID()}`,
      country.timezone,
      opts.lastError,
    ]
  );
}

/**
 * Move a refused queue row along its ladder, or declare it dead.
 * Returns "dead" when the message will never be tried again.
 */
async function scheduleEmailRetry(
  item: { id: string; attempts: number; created_at: Date; dedup_key: string },
  error: string
): Promise<"retried" | "dead"> {
  // The claim already incremented attempts, so this is the number of
  // tries spent, and it indexes the rung to wait before the next one.
  const spent = item.attempts;
  const tooOld = Date.now() - new Date(item.created_at).getTime() > EMAIL_GIVE_UP_HOURS * 3_600_000;

  if (spent > EMAIL_BACKOFF_MIN.length || tooOld) {
    await queryOne(
      "UPDATE notification_queue SET status = 'failed', last_error = $2 WHERE id = $1",
      [item.id, error]
    );
    console.error(`[notification-queue] Email gave up after ${spent} tries: ${item.dedup_key} — ${error}`);
    return "dead";
  }

  // ±20% jitter so an outage that killed the whole backlog does not
  // release all of it in the same second when it clears.
  const baseSec = EMAIL_BACKOFF_MIN[Math.max(spent, 1) - 1] * 60;
  const secs = Math.round(baseSec * (0.8 + Math.random() * 0.4));
  await queryOne(
    `UPDATE notification_queue
        SET send_after = NOW() + make_interval(secs => $2), last_error = $3
      WHERE id = $1`,
    [item.id, secs, error]
  );
  console.warn(`[notification-queue] Email retry ${spent}/${EMAIL_BACKOFF_MIN.length} in ${Math.round(secs / 60)}min: ${item.dedup_key}`);
  return "retried";
}

/**
 * Page Telegram about messages that ran out of ladder.
 *
 * Out-of-band on purpose: an alert about email that cannot send must not
 * go by email. The claim-and-page is a single UPDATE so two overlapping
 * drains cannot both report the same death.
 */
async function alertDeadEmails(): Promise<void> {
  const dead = await query<{
    id: string; recipient: string; subject: string | null;
    attempts: number; last_error: string | null; created_at: Date;
  }>(
    `UPDATE notification_queue q
        SET alerted_at = NOW()
       FROM (SELECT id FROM notification_queue
              WHERE status = 'failed' AND channel = 'email' AND alerted_at IS NULL
              ORDER BY created_at LIMIT 20) s
      WHERE q.id = s.id
     RETURNING q.id, q.recipient, q.subject, q.attempts, q.last_error, q.created_at`
  );
  if (dead.length === 0) return;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = dead.slice(0, 5).map(d => {
    const hours = Math.max(1, Math.round((Date.now() - new Date(d.created_at).getTime()) / 3_600_000));
    return [
      `<b>To:</b> ${esc(d.recipient)}`,
      `<b>Subject:</b> ${esc(d.subject || "(none)")}`,
      `<b>Tries:</b> ${d.attempts} over ${hours}h`,
      `<b>Last:</b> <code>${esc((d.last_error || "").slice(0, 180))}</code>`,
    ].join("\n");
  });
  const more = dead.length > 5 ? `\n\n…and ${dead.length - 5} more` : "";
  const message =
    `🔴 <b>[${country.code.toUpperCase()}] Email gave up — ${dead.length} message${dead.length === 1 ? "" : "s"} died</b>\n\n` +
    lines.join("\n\n") + more;

  const { sendTelegram } = await import("@/lib/telegram");
  const ok = await sendTelegram(message, "alerts");
  if (!ok) {
    // sendTelegram returns false instead of throwing. Roll the marker
    // back, or a death nobody heard about is never mentioned again.
    await query("UPDATE notification_queue SET alerted_at = NULL WHERE id = ANY($1::uuid[])", [dead.map(d => d.id)]);
  }
}
