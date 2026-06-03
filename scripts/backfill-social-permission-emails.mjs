// One-off backfill — sends Kate's social-permission email to every
// client whose delivery has already been accepted but who hasn't received
// this email yet. Reuses the prod sendSocialPermissionEmail helper so
// every email is identical to the regular cron-driven send (same template,
// same ceo@ sender, same flag update). Logs each send, skips on error.

import fs from "node:fs";
import pg from "pg";
import nodemailer from "nodemailer";

const env = Object.fromEntries(
  fs
    .readFileSync("/var/www/photoportugal/.env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    })
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.migadu.com",
  port: parseInt(env.SMTP_PORT || "587"),
  secure: false,
  auth: { user: env.SMTP_CEO_USER || "ceo@photoportugal.com", pass: env.SMTP_CEO_PASS },
});

// Mirror of the emailLayout + body from lib/email.ts — kept identical
// so backfilled emails are pixel-equal to the cron-driven ones.
function layout(body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #F3EDE6;">
          <a href="https://photoportugal.com" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
            <img src="https://photoportugal.com/logo-icon.png" width="28" height="28" alt="" style="border-radius:6px;">
            <span style="font-size:17px;font-weight:700;color:#1F1F1F;letter-spacing:-0.3px;">Photo Portugal</span>
          </a>
        </td></tr>
        <tr><td style="padding:28px 32px 32px;">${body}</td></tr>
        <tr><td style="padding:20px 32px;background:#FAFAF8;border-top:1px solid #F3EDE6;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;color:#9B8E82;">
              <a href="https://photoportugal.com" style="color:#9B8E82;text-decoration:none;font-weight:500;">photoportugal.com</a>
            </td>
            <td align="right" style="font-size:13px;color:#C4B8AD;">
              <a href="https://photoportugal.com/support" style="color:#C4B8AD;text-decoration:none;">Help</a>
              <span style="margin:0 6px;">·</span>
              <a href="https://photoportugal.com/privacy" style="color:#C4B8AD;text-decoration:none;">Privacy</a>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function body(firstName, photographerName, location) {
  const locationPhrase = location ? ` in <strong>${location}</strong>` : "";
  return `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#1F1F1F;">Hi ${firstName},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">It's Kate, founder of Photo Portugal. I hope you've been enjoying the photos from your session with <strong>${photographerName}</strong>${locationPhrase} ✨</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">I'm writing personally because we'd love your permission to feature <strong>a few of your photos</strong> on Photo Portugal's social media (Instagram and our website).</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">We'd choose carefully — only the most natural, tasteful shots, nothing too personal or revealing. You'd see exactly which ones before anything goes live.</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">If that sounds OK, just reply <strong>"yes"</strong> to this email and we'll send you the candidate photos for approval. If not, no problem at all — just reply <strong>"no thanks"</strong> and that's the end of it.</p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#2A2A2A;">Either way, thank you for choosing us — hearing that our photographers made your trip a little more memorable is honestly the best part of running this thing.</p>
    <p style="margin:0;font-size:15px;line-height:1.55;color:#2A2A2A;">Warmly,</p>
    <p style="margin:4px 0 2px;font-size:15px;line-height:1.4;color:#1F1F1F;font-weight:600;">Kate</p>
    <p style="margin:0;font-size:13px;line-height:1.4;color:#9B8E82;">Founder · Photo Portugal</p>
  `;
}

const candidates = (await pool.query(
  `SELECT b.id, cu.email AS client_email, cu.name AS client_name,
          pu.name AS photographer_name, b.location_slug
   FROM bookings b
   JOIN users cu ON cu.id = b.client_id
   JOIN photographer_profiles pp ON pp.id = b.photographer_id
   JOIN users pu ON pu.id = pp.user_id
   WHERE b.delivery_accepted = TRUE
     AND b.social_permission_email_sent_at IS NULL
     AND cu.email IS NOT NULL
   ORDER BY b.delivery_accepted_at DESC`
)).rows;

console.log(`Backfilling ${candidates.length} clients…\n`);

let sent = 0;
let failed = 0;
for (const c of candidates) {
  const firstName = (c.client_name || "").split(" ")[0] || "there";
  const location = c.location_slug
    ? c.location_slug.charAt(0).toUpperCase() + c.location_slug.slice(1).replace(/-/g, " ")
    : null;
  try {
    await transporter.sendMail({
      from: "Kate Belova <ceo@photoportugal.com>",
      to: c.client_email,
      subject: "Could we share one of your photos? 🌸",
      html: layout(body(firstName, c.photographer_name, location)),
      replyTo: "ceo@photoportugal.com",
    });
    await pool.query("UPDATE bookings SET social_permission_email_sent_at = NOW() WHERE id = $1", [c.id]);
    sent++;
    console.log(`✓ ${firstName.padEnd(14)} · ${c.client_email.padEnd(34)} · photog: ${c.photographer_name}`);
  } catch (err) {
    failed++;
    console.log(`✗ ${firstName} · ${c.client_email} — ${err.message?.slice(0, 100)}`);
  }
}

console.log(`\nDone: ${sent} sent, ${failed} failed.`);
await pool.end();
