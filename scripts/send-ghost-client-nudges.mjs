// One-shot nudge emails to clients who went silent after photographer reply.
// Run on server where SMTP creds are configured.
//
// Usage: DRY=1 node scripts/send-ghost-client-nudges.mjs   # preview
//        node scripts/send-ghost-client-nudges.mjs         # send

import nodemailer from "nodemailer";
import pg from "pg";

const DRY = process.env.DRY === "1";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const FROM = process.env.SMTP_FROM || "Photo Portugal <info@photoportugal.com>";
const MSGS_URL = "https://photoportugal.com/dashboard/messages";

function layout(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:32px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #F3EDE6;">
<a href="https://photoportugal.com" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
<img src="https://photoportugal.com/logo-icon.png" width="28" height="28" alt="" style="border-radius:6px;">
<span style="font-size:17px;font-weight:700;color:#1F1F1F;letter-spacing:-0.3px;">Photo Portugal</span></a>
</td></tr>
<tr><td style="padding:28px 32px 32px;font-size:15px;line-height:1.6;color:#333;">${body}</td></tr>
<tr><td style="padding:20px 32px;background:#FAFAF8;border-top:1px solid #F3EDE6;font-size:13px;color:#9B8E82;">
<a href="https://photoportugal.com" style="color:#9B8E82;text-decoration:none;font-weight:500;">photoportugal.com</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function button(url, label) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#C94536;border-radius:10px;">
<a href="${url}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>
</td></tr></table>`;
}

// Nudge recipients — explicitly listed (no dynamic scan to avoid accidentally
// nudging Colin Pender whose session is already done).
const NUDGES = [
  {
    email: "ancuta_selena@yahoo.com",
    firstName: "Anca",
    subject: "Cindy confirmed your session — check your messages",
    body: `<p>Hi Anca,</p>
<p>Good news — <strong>Cindy</strong> just confirmed your booking (€195) and replied to your chat 2 days ago, but it looks like you haven't seen her message yet.</p>
<p>She's excited to shoot with you and just needs a quick reply to finalize the details.</p>
${button(MSGS_URL, "Reply to Cindy")}
<p>If anything's changed or you have questions, just reply to this email — we're happy to help.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "soysusommeliergt@gmail.com",
    firstName: "Anneliese",
    subject: "3 photographers replied — ready to pick one?",
    body: `<p>Hi Anneliese,</p>
<p>Three of our photographers — <strong>Giovana</strong>, <strong>Jennifer</strong>, and <strong>Pedro</strong> — have all replied to your inquiry about your personal branding shoot in Portugal.</p>
<p>Take a look at their responses and see whose vibe matches yours best. Whenever you're ready to move forward, just let them know through the platform.</p>
${button(MSGS_URL, "Review responses")}
<p>If you'd like help deciding between them, reply to this email and I'll share some thoughts.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "shangrist98@gmail.com",
    firstName: "Shannon",
    subject: "Cindy is holding May 27 for you",
    body: `<p>Hi Shannon,</p>
<p>Just checking in — <strong>Cindy</strong> is holding <strong>May 27</strong> for your family photoshoot and sent you a message 2 days ago asking about the children's ages so she can plan the session.</p>
${button(MSGS_URL, "Reply to Cindy")}
<p>If you've changed your plans, no problem — just let us know so Cindy can free up the date. Have questions? Reply to this email.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "joel.quiroztello@gmail.com",
    firstName: "Joel",
    subject: "Monica is waiting to hear about your proposal",
    body: `<p>Hi Joel,</p>
<p>Congrats again on the upcoming proposal! <strong>Monica Rodrigues</strong> replied to your inquiry a couple of days ago — she's incredibly excited to help capture this moment.</p>
${button(MSGS_URL, "Reply to Monica")}
<p>She'll want to coordinate location, timing, and how to stay hidden so the surprise is perfect. Whenever you're ready to chat, just reply on the platform. Questions? Hit reply.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "ravisg@hotmail.co.uk",
    firstName: "Ravi",
    subject: "Giovana and Chris both replied — any thoughts?",
    body: `<p>Hi Ravi,</p>
<p>Both <strong>Giovana Sioli</strong> and <strong>Chris Batista</strong> have replied to your inquiry about a photoshoot in Portugal — Giovana shared her Instagram and Chris offered details on locations outside Porto.</p>
${button(MSGS_URL, "See their responses")}
<p>Happy to help you pick if you want — just reply to this email.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "aleksander.m.tangen@gmail.com",
    firstName: "Aleksander",
    subject: "Still thinking about a second session?",
    body: `<p>Hi Aleksander,</p>
<p>Hope your confirmed session with <strong>Cindy</strong> went well! You'd also sent a second inquiry that Cindy replied to — just wanted to check if you're still considering another shoot.</p>
${button(MSGS_URL, "Open chat")}
<p>If plans have changed, no worries — just wanted to make sure you weren't waiting on us. Questions? Reply here.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "gerenhan123@gmail.com",
    firstName: "Gerco",
    subject: "Cindy is holding May 4 for your shoot",
    body: `<p>Hoi Gerco,</p>
<p><strong>Cindy</strong> is holding <strong>May 4</strong> for your photoshoot and sent you a message 10 days ago to coordinate — it looks like things went quiet on our end.</p>
${button(MSGS_URL, "Reply to Cindy")}
<p>If your plans have changed, just let us know so Cindy can free up the date. Have questions? Reply to this email in any language — we'll figure it out.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "SBlackburn98@hotmail.com",
    firstName: "Simon",
    subject: "Cindy has some Lagos ideas for you",
    body: `<p>Hi Simon,</p>
<p><strong>Cindy</strong> replied to your inquiry about a shoot in the Algarve a couple of weeks ago — she lives in the Lagos area and shared some amazing spots she had in mind for you.</p>
${button(MSGS_URL, "See Cindy's message")}
<p>If it's still on your list, give her a shout whenever you're ready. If plans have changed, no worries — just let us know.</p>
<p>— Photo Portugal team</p>`,
  },
  {
    email: "Jackdrouin4@gmail.com",
    firstName: "Jack",
    subject: "Still interested in a Portugal photoshoot?",
    body: `<p>Hi Jack,</p>
<p>Circling back — <strong>Cindy</strong> and <strong>Jonathan Rens</strong> both replied to your inquiries a couple of weeks ago and haven't heard back. We know the booking step hit a snag last time you tried, and we want to make sure you're not stuck on our end.</p>
${button(MSGS_URL, "Open chat")}
<p>If you're still thinking about a shoot, just reply to either photographer or to this email and we'll personally make sure the booking goes through smoothly this time.</p>
<p>— Photo Portugal team</p>`,
  },
];

async function logNotification(client, email, event) {
  try {
    await client.query(
      `INSERT INTO notification_logs (channel, recipient, event, status, created_at)
       VALUES ('email', $1, $2, 'sent', NOW())`,
      [email, event]
    );
  } catch (e) {
    console.error("  [log warn]", e.message);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log(`Sending ${NUDGES.length} nudge emails${DRY ? " (DRY RUN)" : ""}...\n`);
    let sent = 0;
    for (const n of NUDGES) {
      const event = `ghost_client_nudge: ${n.subject}`.slice(0, 100);
      // Dedup: if we already sent same subject to this email in last 30 days, skip
      const dup = await client.query(
        `SELECT 1 FROM notification_logs WHERE recipient = $1 AND event = $2 AND created_at > NOW() - INTERVAL '30 days' LIMIT 1`,
        [n.email, event]
      );
      if (dup.rows.length) {
        console.log(`[skip dup] ${n.email} — ${n.subject}`);
        continue;
      }
      if (DRY) {
        console.log(`[dry] → ${n.email}: ${n.subject}`);
        continue;
      }
      try {
        await transporter.sendMail({
          from: FROM,
          to: n.email,
          subject: n.subject,
          html: layout(n.body),
        });
        await logNotification(client, n.email, event);
        console.log(`[sent] → ${n.email}: ${n.subject}`);
        sent++;
      } catch (e) {
        console.error(`[fail] → ${n.email}: ${e.message}`);
      }
    }
    console.log(`\nDone. ${sent}/${NUDGES.length} sent.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
