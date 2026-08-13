import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendEmailWithResult } from "@/lib/email";
import { buildPitch, outreachHeaders, pitchLanguage, type OutreachPartner } from "@/lib/partner-outreach-pitch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily drip for partner outreach. Takes the oldest `queued` rows, mails each
// one its segment's pitch, and marks the row in the same breath.
//
// The cap is the point. A thousand-row list mailed in one night is a spam
// complaint per hour against the same mailbox that sends booking
// confirmations, so this sends 50 a day and the list drains over weeks.
//
// Sends are spaced by SEND_GAP_MS. Migadu throttles bursts, and a rejected
// burst looks exactly like a dead address from here.
const DEFAULT_CAP = 50;
const SEND_GAP_MS = 2_000;

interface PartnerRow extends OutreachPartner {
  id: string;
  email: string;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const requested = parseInt(req.nextUrl.searchParams.get("limit") || "", 10);
  const cap = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : Number(process.env.OUTREACH_DAILY_CAP || DEFAULT_CAP),
    200
  );

  try {
    // A row with no address can never be sent and would otherwise sit at the
    // head of the queue forever, eating a slot a day.
    const partners = await query<PartnerRow>(
      `SELECT id, company_name, contact_name, region, segment, language, email
         FROM partner_outreach
        WHERE status = 'queued' AND email IS NOT NULL
        ORDER BY created_at
        LIMIT $1`,
      [cap]
    );

    // Read once per run, not per letter: it is the same number for all of them
    // and it is the only claim in the copy that can go stale.
    const roster = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM photographer_profiles WHERE is_approved = TRUE`
    );
    const pitchOptions = { photographerCount: Number(roster?.count || 0) };

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        cap,
        photographers: pitchOptions.photographerCount,
        would_send: partners.length,
        preview: partners.slice(0, 5).map((p) => {
          const pitch = buildPitch(p, pitchOptions);
          return {
            to: p.email,
            company: p.company_name,
            segment: p.segment,
            language: pitchLanguage(p),
            subject: pitch.subject,
            text: pitch.text,
          };
        }),
      });
    }

    let sent = 0;
    const failed: { company: string; error: string }[] = [];

    for (const [i, p] of partners.entries()) {
      const pitch = buildPitch(p, pitchOptions);
      // park:false — the queue exists to keep a booking confirmation alive for
      // a day. A cold lead with a dead mailbox is not worth 24h of retries.
      const result = await sendEmailWithResult(p.email, pitch.subject, pitch.html, {
        text: pitch.text,
        headers: outreachHeaders(),
        park: false,
      });

      if (result.ok) {
        await queryOne(
          `UPDATE partner_outreach
              SET status = 'contacted',
                  last_contacted_at = NOW(),
                  contact_count = contact_count + 1,
                  updated_at = NOW()
            WHERE id = $1 RETURNING id`,
          [p.id]
        );
        sent++;
      } else {
        // 'failed' rather than back to 'queued': a bad address retried daily
        // would block a slot forever and never improve.
        await queryOne(
          `UPDATE partner_outreach
              SET status = 'failed',
                  notes = COALESCE(notes || E'\\n', '') || $2,
                  updated_at = NOW()
            WHERE id = $1 RETURNING id`,
          [p.id, `[auto] send failed: ${(result.error || "unknown").slice(0, 200)}`]
        );
        failed.push({ company: p.company_name, error: result.error || "unknown" });
      }

      if (i < partners.length - 1) await new Promise((r) => setTimeout(r, SEND_GAP_MS));
    }

    const remaining = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM partner_outreach WHERE status = 'queued' AND email IS NOT NULL`
    );

    console.log(`[cron/partner-outreach] sent ${sent}, failed ${failed.length}, ${remaining?.count} still queued`);
    return NextResponse.json({ ok: true, sent, failed, queued_remaining: Number(remaining?.count || 0) });
  } catch (error) {
    console.error("[cron/partner-outreach] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
