import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { isInternalAccount } from "@/lib/internal-accounts";
import { isNoTrackRequest } from "@/lib/no-track";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

    // An admin browser, most likely mid-impersonation: the session is a
    // real one belonging to someone else, and linking it here is what
    // used to brand this browser as that photographer forever. The
    // internal-accounts check below can't catch it — the identity in
    // play is theirs, not ours. See lib/no-track.ts.
    if (isNoTrackRequest(req)) {
      return NextResponse.json({ ok: true, skipped: "no-track" });
    }

    const { visitor_id } = await req.json();
    if (!visitor_id) return NextResponse.json({ ok: true });

    // Our own accounts never get attached to their browsing. Every admin
    // visit was landing in Recent Visitors as a named photographer, which
    // is both noise and a wrong number in every visitor count derived from
    // it. Their sessions still exist, just anonymous like any other.
    if (isInternalAccount(session.user.email)) {
      return NextResponse.json({ ok: true, skipped: "internal" });
    }

    // Link visitor_id to user (only if not already linked)
    await query("UPDATE users SET visitor_id = $1 WHERE id = $2 AND visitor_id IS NULL", [visitor_id, session.user.id]);

    // Backfill unlinked sessions for this visitor, bounded by the same
    // 90-day attribution window the tracker keeps UTMs for. A login should
    // adopt the browsing that led to it, not every session the machine has
    // ever had — on a shared or long-lived browser that rewrote months of
    // history under one name.
    await query(
      `UPDATE visitor_sessions SET user_id = $1
        WHERE visitor_id = $2 AND user_id IS NULL
          AND started_at > NOW() - INTERVAL '90 days'`,
      [session.user.id, visitor_id]
    );

    // Backfill UTM attribution on users from the earliest visitor_session.
    // Derive utm_source='google' / utm_medium='cpc' from gclid when explicit UTMs missing.
    await query(
      `UPDATE users u SET
         utm_source   = COALESCE(u.utm_source,   src.utm_source),
         utm_medium   = COALESCE(u.utm_medium,   src.utm_medium),
         utm_campaign = COALESCE(u.utm_campaign, src.utm_campaign),
         utm_term     = COALESCE(u.utm_term,     src.utm_term)
       FROM (
         SELECT
           COALESCE(vs.utm_source,   CASE WHEN vs.gclid IS NOT NULL OR vs.referrer ILIKE '%gclid=%' THEN 'google' END) AS utm_source,
           COALESCE(vs.utm_medium,   CASE WHEN vs.gclid IS NOT NULL OR vs.referrer ILIKE '%gclid=%' THEN 'cpc'    END) AS utm_medium,
           vs.utm_campaign,
           vs.utm_term
         FROM visitor_sessions vs
         WHERE vs.visitor_id = $2
         ORDER BY vs.started_at ASC
         LIMIT 1
       ) src
       WHERE u.id = $1
         AND (u.utm_source IS NULL OR u.utm_medium IS NULL OR u.utm_campaign IS NULL OR u.utm_term IS NULL)`,
      [session.user.id, visitor_id]
    );

    // Backfill concierge chats: link visitor's chat to the user
    await query(
      "UPDATE concierge_chats SET user_id = $1 WHERE visitor_id = $2 AND user_id IS NULL",
      [session.user.id, visitor_id]
    ).catch(() => {});

    // Backfill user.locale from earliest visitor_session if not set yet.
    // Captures DE / PT / FR / ES users who logged in via Google (no locale at INSERT).
    await query(
      `UPDATE users u SET locale = src.lang
       FROM (
         SELECT SUBSTRING(language FROM '^([a-z]{2})') AS lang
         FROM visitor_sessions
         WHERE visitor_id = $2 AND language IS NOT NULL
         ORDER BY started_at ASC
         LIMIT 1
       ) src
       WHERE u.id = $1 AND u.locale IS NULL AND src.lang IN ('en','pt','de')`,
      [session.user.id, visitor_id]
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[link-visitor]", e);
    return NextResponse.json({ ok: true });
  }
}
