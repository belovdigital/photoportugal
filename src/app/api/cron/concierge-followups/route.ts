// Phase D — concierge follow-up email cron.
//
// Two stages, both gated on `email IS NOT NULL` and `outcome = 'matched'`
// so we never spam visitors who haven't opted in or who skipped past the
// match step:
//   - 30min: 30-180 minutes after creation, no '30min' stamp yet
//   - 24h:   24-48 hours after creation, no '24h' stamp yet
//
// We stamp `followups_sent` BEFORE attempting the send so a failure
// (SMTP outage etc.) doesn't double-send on the next cron tick. If the
// send actually throws, the visitor just doesn't get the email — better
// than two copies. The cron is idempotent and safe to re-run.
//
// Hits at the same /api/cron/reminders cadence — call externally via
// `curl https://photoportugal.com/api/cron/concierge-followups?secret=...`.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import {
  sendConciergeFollowup30min,
  sendConciergeFollowup24h,
  extractMatchesFromChat,
} from "@/lib/concierge/followup-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRow {
  id: string;
  email: string;
  first_name: string | null;
  language: string | null;
  messages: { role: string; action?: { type?: string; data?: { matches?: unknown[] } } | null }[];
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Advisory lock — same pattern as /api/cron/reminders
  try {
    const lock = await queryOne<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(987654321) as acquired"
    );
    if (!lock?.acquired) {
      return NextResponse.json({ skipped: true, reason: "already_running" });
    }
  } catch {}

  const result = { sent_30min: 0, sent_24h: 0, errors: [] as string[] };

  try {
    // === 30-minute nudge ===
    // Window: 30 min ≤ age ≤ 3 h. The upper bound is generous so a
    // backed-up cron still catches recent chats; subsequent runs skip
    // them via the followups_sent stamp.
    const window30 = await query<ChatRow>(
      `SELECT id, email, first_name, language, messages
         FROM concierge_chats
        WHERE email IS NOT NULL
          AND outcome = 'matched'
          AND COALESCE(archived, FALSE) = FALSE
          AND created_at < NOW() - INTERVAL '30 minutes'
          AND created_at > NOW() - INTERVAL '3 hours'
          AND (followups_sent->>'30min') IS NULL`
    ).catch((e) => { result.errors.push(`30min query: ${e}`); return [] as ChatRow[]; });

    for (const chat of window30) {
      // Stamp first to prevent re-send if SMTP throws
      await queryOne(
        `UPDATE concierge_chats
            SET followups_sent = followups_sent || jsonb_build_object('30min', NOW()::text)
          WHERE id = $1 RETURNING id`,
        [chat.id]
      ).catch(() => null);
      try {
        const matches = extractMatchesFromChat(chat.messages || []);
        if (matches.length === 0) continue;
        await sendConciergeFollowup30min({
          to: chat.email,
          firstName: chat.first_name,
          locale: chat.language,
          matches,
        });
        result.sent_30min++;
      } catch (e) {
        result.errors.push(`30min send for ${chat.id}: ${e}`);
      }
    }

    // === 24-hour follow-up ===
    // Window: 24 h ≤ age ≤ 48 h. Last touch — after this we stop.
    const window24 = await query<ChatRow>(
      `SELECT id, email, first_name, language, messages
         FROM concierge_chats
        WHERE email IS NOT NULL
          AND outcome = 'matched'
          AND COALESCE(archived, FALSE) = FALSE
          AND created_at < NOW() - INTERVAL '24 hours'
          AND created_at > NOW() - INTERVAL '48 hours'
          AND (followups_sent->>'24h') IS NULL`
    ).catch((e) => { result.errors.push(`24h query: ${e}`); return [] as ChatRow[]; });

    for (const chat of window24) {
      await queryOne(
        `UPDATE concierge_chats
            SET followups_sent = followups_sent || jsonb_build_object('24h', NOW()::text)
          WHERE id = $1 RETURNING id`,
        [chat.id]
      ).catch(() => null);
      try {
        const matches = extractMatchesFromChat(chat.messages || []);
        if (matches.length === 0) continue;
        await sendConciergeFollowup24h({
          to: chat.email,
          firstName: chat.first_name,
          locale: chat.language,
          matches,
        });
        result.sent_24h++;
      } catch (e) {
        result.errors.push(`24h send for ${chat.id}: ${e}`);
      }
    }
  } finally {
    try { await queryOne("SELECT pg_advisory_unlock(987654321)"); } catch {}
  }

  return NextResponse.json(result);
}
