import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendEmail, emailLayout, emailButton } from "@/lib/email";

// One-shot cron — fires 2026-06-19 09:00 UTC (crontab `0 9 19 6 *`).
//
// HYBRID rollout of the €299 floor (decided 2026-06-18, replacing the
// original "hide everything below floor" behaviour, which would have made
// ~8 live photographers vanish entirely):
//   1. RAISE every public, sub-€299 package with a >=45-min duration up to
//      the €299 floor — the package stays live and bookable, just repriced.
//   2. HIDE the discontinued 15/30-min packages (re-listable at 45min+).
//   3. Email each affected photographer exactly what changed.
//
// Scoped to approved + non-banned photographers — that's the audience the
// June 18 reminder warned, and the only packages that are actually public.
// Unapproved drafts are left untouched; the floor is enforced for them at
// publish/approval time.
//
// Hard date guard below stops an accidental annual re-fire. `?force=1`
// bypasses it for testing, `?dryrun=1` reports the plan without changing
// anything, `?only=email` limits, `?redirect_to=addr` previews emails.

const FIRE_DATE_UTC = "2026-06-19";
const FLOOR_EUR = 299;
const DISCONTINUED_DURATIONS = [15, 30] as const;
const DUR_ARR = [...DISCONTINUED_DURATIONS];

interface PkgRow { id: string; name: string; price: number; duration_minutes: number; action: "raised" | "hidden" }
interface AffectedRow { photographer_id: string; email: string; name: string; packages: PkgRow[] }

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const dryrun = req.nextUrl.searchParams.get("dryrun") === "1";
  const only = req.nextUrl.searchParams.get("only");
  const redirectTo = req.nextUrl.searchParams.get("redirect_to");

  const today = new Date().toISOString().slice(0, 10);
  if (!force && today !== FIRE_DATE_UTC) {
    return NextResponse.json({
      skipped: true,
      reason: `Not fire date (today ${today}, fire date ${FIRE_DATE_UTC}). Pass ?force=1 to override.`,
    });
  }

  // Capture the affected packages (grouped by photographer, with the action
  // we're about to take) BEFORE mutating, so the emails are accurate.
  const rows = await query<AffectedRow>(
    `SELECT pp.id AS photographer_id, u.email, u.name,
            json_agg(json_build_object(
              'id', pkg.id, 'name', pkg.name, 'price', pkg.price::int,
              'duration_minutes', pkg.duration_minutes,
              'action', CASE WHEN pkg.duration_minutes = ANY($2) THEN 'hidden' ELSE 'raised' END
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
     GROUP BY pp.id, u.email, u.name
     ORDER BY u.name`,
    only ? [FLOOR_EUR, DISCONTINUED_DURATIONS, only] : [FLOOR_EUR, DISCONTINUED_DURATIONS]
  );

  if (dryrun) {
    return NextResponse.json({
      dryrun: true, fire_date: FIRE_DATE_UTC, today,
      photographers: rows.length,
      to_raise: rows.flatMap((r) => r.packages).filter((p) => p.action === "raised").length,
      to_hide: rows.flatMap((r) => r.packages).filter((p) => p.action === "hidden").length,
      detail: rows,
    });
  }

  // 1. Raise sub-floor real-session packages up to the floor.
  const raised = await query<{ id: string }>(
    `UPDATE packages pkg SET price = $1
     FROM photographer_profiles pp, users u
     WHERE pkg.photographer_id = pp.id AND pp.user_id = u.id
       AND pkg.tier IS NULL
       AND COALESCE(pkg.is_public, true) = true
       AND pp.is_approved = true AND COALESCE(u.is_banned, false) = false
       AND pkg.price < $1
       AND pkg.duration_minutes <> ALL($2::int[])
       ${only ? "AND u.email = $3" : ""}
     RETURNING pkg.id`,
    only ? [FLOOR_EUR, DUR_ARR, only] : [FLOOR_EUR, DUR_ARR]
  );

  // 2. Hide the discontinued 15/30-min packages.
  const hidden = await query<{ id: string }>(
    `UPDATE packages pkg SET is_public = false
     FROM photographer_profiles pp, users u
     WHERE pkg.photographer_id = pp.id AND pp.user_id = u.id
       AND pkg.tier IS NULL
       AND COALESCE(pkg.is_public, true) = true
       AND pp.is_approved = true AND COALESCE(u.is_banned, false) = false
       AND pkg.duration_minutes = ANY($1::int[])
       ${only ? "AND u.email = $2" : ""}
     RETURNING pkg.id`,
    only ? [DUR_ARR, only] : [DUR_ARR]
  );

  // 3. Tell each affected photographer what changed.
  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      const firstName = (row.name || "").trim().split(/\s+/)[0] || "there";
      const html = renderEmail(firstName, row.packages);
      const subject = "Your packages stay live — now at the €299 minimum";
      await sendEmail(redirectTo || row.email, `${redirectTo ? `[preview for ${row.email}] ` : ""}${subject}`, html);
      sent++;
    } catch (err) {
      console.error("[cron/pricing-floor-disable] email failed:", row.email, err);
      failed++;
    }
  }

  // Heads-up to the admin so we know it ran.
  try {
    const { sendTelegram } = await import("@/lib/telegram");
    await sendTelegram(`💶 <b>€299 floor applied</b>\nRaised: ${raised.length} · Hidden (15/30min): ${hidden.length} · Emailed: ${sent}${failed ? ` (failed ${failed})` : ""}`, "stripe");
  } catch {}

  return NextResponse.json({
    fire_date: FIRE_DATE_UTC, today, forced: force,
    raised_count: raised.length, hidden_count: hidden.length,
    emailed: sent, email_failed: failed,
  });
}

function renderEmail(firstName: string, packages: PkgRow[]): string {
  const safeFirst = escapeHtml(firstName);
  const raised = packages.filter((p) => p.action === "raised");
  const hidden = packages.filter((p) => p.action === "hidden");
  const durLabel = (d: number) => (d < 60 ? `${d} min` : d === 60 ? "1 hour" : `${d / 60} hours`);

  const pkgTable = (items: PkgRow[], rightLabel: string, rightCell: (p: PkgRow) => string) => `
    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#FAFAF8;border-radius:10px;overflow:hidden;margin:0 0 22px 0;">
      <thead><tr style="background:#F3EDE6;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#7a6f63;">Package</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#7a6f63;">${rightLabel}</th>
      </tr></thead>
      <tbody>${items.map((p) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F3EDE6;font-size:14px;color:#1F1F1F;">
          <strong>${escapeHtml(p.name)}</strong><br/><span style="color:#7a6f63;font-size:12px;">${durLabel(p.duration_minutes)}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #F3EDE6;font-size:13px;color:#1F1F1F;">${rightCell(p)}</td>
      </tr>`).join("")}</tbody>
    </table>`;

  const raisedBlock = raised.length ? `
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 10px 0;">
      <strong>Updated to €${FLOOR_EUR} — still live and bookable:</strong>
    </p>
    ${pkgTable(raised, "New price", (p) => `<span style="color:#7a6f63;text-decoration:line-through;">€${p.price}</span> &rarr; <strong style="color:#166534;">€${FLOOR_EUR}</strong>`)}` : "";

  const hiddenBlock = hidden.length ? `
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 10px 0;">
      These were on the 15/30-minute durations we've now retired, so they're hidden for now.
      To bring them back, just re-add them at <strong>45 minutes or longer</strong>:
    </p>
    ${pkgTable(hidden, "Status", () => `<span style="color:#A9372A;">Hidden</span>`)}` : "";

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1F1F1F;margin:0 0 14px 0;line-height:1.3;">
      Hi ${safeFirst} — good news, nothing disappeared.
    </h1>
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 18px 0;">
      Quick follow-up to yesterday's note about the new <strong>€${FLOOR_EUR} minimum per package</strong>.
      Rather than hiding your packages that were priced below it, we've simply set them to €${FLOOR_EUR}
      so they <strong>stay live and bookable</strong>.
    </p>
    ${raisedBlock}
    ${hiddenBlock}
    <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 18px 0;">
      You can fine-tune the price, duration or details of any package anytime in your dashboard.
    </p>
    ${emailButton("https://photoportugal.com/dashboard/photographer", "Open my dashboard")}
    <p style="font-size:14px;line-height:1.7;color:#5c5247;margin:22px 0 0 0;">
      Questions? Just reply to this email or ping us on WhatsApp.<br/><br/>
      Thank you for being part of Photo Portugal.<br/>— The team
    </p>`;

  return emailLayout(body, "en");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
