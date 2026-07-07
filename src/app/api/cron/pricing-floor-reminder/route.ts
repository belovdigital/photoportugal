import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendEmail, emailLayout, emailButton } from "@/lib/email";

// One-shot cron: fires the day BEFORE the new pricing floor + 15/30-min
// removal takes effect (announced for Friday 2026-06-19). Goal: a
// polite per-photographer email listing exactly which of their packages
// will go private tomorrow, with a one-click link to fix.
//
// Schedule: `0 7 18 6 *` (07:00 UTC on June 18 every year). The hard
// date guard below ensures it can't accidentally re-fire in 2027.
// `?force=1` bypasses the date guard for testing — keep it gated to
// CRON_SECRET so it isn't a spam vector.
//
// To trigger manually:
//   curl "https://photoportugal.com/api/cron/pricing-floor-reminder?secret=...&force=1&only=a@lob.lol"

const FIRE_DATE_UTC = "2026-06-18";
const NEW_FLOOR_EUR = 299;
const DISCONTINUED_DURATIONS = [15, 30] as const;

interface AffectedRow {
  email: string;
  name: string;
  packages: Array<{ id: string; name: string; price: number; duration_minutes: number }>;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const only = req.nextUrl.searchParams.get("only"); // limit to a single email (for testing)
  const dryrun = req.nextUrl.searchParams.get("dryrun") === "1"; // build + count recipients, don't send
  const redirectTo = req.nextUrl.searchParams.get("redirect_to"); // send all to one address (preview content)

  // Hard date guard — only fires on the announced day. Crontab also
  // schedules it only on June 18 of each year, but defence in depth is
  // free here and the consequences of an accidental re-fire (37 people
  // getting a stale reminder) are bad enough to justify the belt + braces.
  const today = new Date().toISOString().slice(0, 10);
  if (!force && today !== FIRE_DATE_UTC) {
    return NextResponse.json({
      skipped: true,
      reason: `Not fire date (today ${today}, fire date ${FIRE_DATE_UTC}). Pass ?force=1 to override.`,
    });
  }

  // Pull affected packages grouped by photographer. tier IS NULL skips
  // platform-owned gift-card packages (priced by the platform, above the
  // floor, and photographers can't change them anyway).
  const rows = await query<AffectedRow>(
    `SELECT u.email, u.name,
            json_agg(json_build_object(
              'id', pkg.id,
              'name', pkg.name,
              'price', pkg.price::int,
              'duration_minutes', pkg.duration_minutes
            ) ORDER BY pkg.price, pkg.duration_minutes) AS packages
     FROM packages pkg
     JOIN photographer_profiles pp ON pp.id = pkg.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE pkg.tier IS NULL
       AND COALESCE(pkg.is_public, true) = true
       AND pp.is_approved = true
       AND COALESCE(u.is_banned, false) = false
       AND (pkg.price < $1 OR pkg.duration_minutes = ANY($2))
       ${only ? "AND u.email = $3" : ""}
     GROUP BY u.email, u.name
     ORDER BY u.name`,
    only ? [NEW_FLOOR_EUR, DISCONTINUED_DURATIONS, only] : [NEW_FLOOR_EUR, DISCONTINUED_DURATIONS]
  );

  let sent = 0;
  let failed = 0;
  const results: Array<{ email: string; status: "sent" | "failed" | "dryrun"; pkgCount: number }> = [];

  for (const row of rows) {
    try {
      const firstName = (row.name || "").trim().split(/\s+/)[0] || row.name || "there";
      const subject = "Reminder: tomorrow some of your packages will be hidden";
      const html = renderEmail(firstName, row.packages);
      if (dryrun) {
        results.push({ email: row.email, status: "dryrun", pkgCount: row.packages.length });
        continue;
      }
      // redirect_to: useful for sending a real test of one photographer's
      // personalised content to a CEO inbox without spamming the actual user.
      const targetEmail = redirectTo || row.email;
      await sendEmail(targetEmail, `${redirectTo ? `[preview for ${row.email}] ` : ""}${subject}`, html);
      sent++;
      results.push({ email: row.email, status: "sent", pkgCount: row.packages.length });
    } catch (err) {
      console.error("[cron/pricing-floor-reminder] send failed:", row.email, err);
      failed++;
      results.push({ email: row.email, status: "failed", pkgCount: row.packages.length });
    }
  }

  return NextResponse.json({
    fire_date: FIRE_DATE_UTC,
    today,
    forced: force,
    only: only || null,
    total_recipients: rows.length,
    sent,
    failed,
    results,
  });
}

function renderEmail(
  firstName: string,
  packages: AffectedRow["packages"]
): string {
  const safeFirst = escapeHtml(firstName);

  const rows = packages
    .map((p) => {
      const reasons: string[] = [];
      if (p.price < NEW_FLOOR_EUR) reasons.push(`price €${p.price} — below new €${NEW_FLOOR_EUR} floor`);
      if (DISCONTINUED_DURATIONS.includes(p.duration_minutes as 15 | 30))
        reasons.push(`${p.duration_minutes}-min duration discontinued`);
      const why = reasons.join("; ");
      const durLabel =
        p.duration_minutes < 60
          ? `${p.duration_minutes} min`
          : p.duration_minutes === 60
          ? "1 hour"
          : `${p.duration_minutes / 60} hours`;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F3EDE6;font-size:14px;color:#1F1F1F;">
          <strong>${escapeHtml(p.name)}</strong><br/>
          <span style="color:#7a6f63;font-size:12px;">${durLabel} · €${p.price}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #F3EDE6;font-size:12px;color:#A9372A;">${escapeHtml(why)}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1F1F1F;margin:0 0 14px 0;line-height:1.3;">
      Hi ${safeFirst} — a quick heads-up for tomorrow.
    </h1>
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 14px 0;">
      As we mentioned earlier this week, the platform is moving to a <strong>€${NEW_FLOOR_EUR} minimum per package</strong>,
      and we're <strong>removing 15-min and 30-min duration slots</strong> entirely. The change goes live
      <strong>tomorrow, Friday June 19</strong>.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 18px 0;">
      We wanted to flag the packages on your profile that fall under the change. <strong>If you don't update them by tomorrow,
      they'll be temporarily hidden from your public profile</strong> and clients won't be able to book them. They're
      <em>not deleted</em> — just hidden until you re-price or change the duration:
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#FAFAF8;border-radius:10px;overflow:hidden;margin:0 0 22px 0;">
      <thead>
        <tr style="background:#F3EDE6;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#7a6f63;">Package</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#7a6f63;">Why it will be hidden</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 18px 0;">
      Fixing it takes a couple of minutes. Open your dashboard, edit each package — bump the price to €${NEW_FLOOR_EUR}+ and/or
      change the duration to 45 min / 1 hour / longer — and save. The package stays exactly where it was, just at the new
      price/duration.
    </p>
    ${emailButton("https://photoportugal.com/dashboard/photographer", "Open my dashboard")}
    <p style="font-size:14px;line-height:1.7;color:#5c5247;margin:22px 0 0 0;">
      If anything's unclear — just reply to this email or ping us on WhatsApp. We're here.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#5c5247;margin:14px 0 0 0;">
      Thank you for being part of Photo Portugal.<br/>
      — The team
    </p>
  `;

  return emailLayout(body, "en");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
