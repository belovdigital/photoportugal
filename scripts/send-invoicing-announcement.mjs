/**
 * One-off: the invoicing announcement, sent as Kate to the photographer roster.
 *
 *   node scripts/send-invoicing-announcement.mjs            # dry run, prints the list
 *   node scripts/send-invoicing-announcement.mjs --send     # actually sends
 *
 * Runs ON THE PROD BOX (needs .env for SMTP + DB). Sends from the CEO mailbox
 * so "reply to this email and it comes straight to me" is literally true.
 *
 * Recipients: approved + not banned + not test, PLUS anyone hidden for missing
 * Stripe (stripe_hidden_at set) — they are still on the roster and the change
 * applies to them. Kate's own photographer account is excluded; so is anyone
 * who never finished onboarding (no stripe_hidden_at, never approved).
 *
 * Idempotent by file: every send is appended to sent-invoicing-announcement.log
 * next to this script, and addresses already in it are skipped on re-run.
 */
import { readFileSync, appendFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = "/var/www/photoportugal";
const LOG = join(HERE, "sent-invoicing-announcement.log");
const SEND = process.argv.includes("--send");

const env = Object.fromEntries(
  readFileSync(`${APP_DIR}/.env`, "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; })
);

const SUBJECT = "A change on our side — and what it means for your invoicing";
const KATE_ACCOUNT = "ekaterinabranco@gmail.com"; // her own photographer profile

const p = (s) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#4A4A4A;">${s}</p>`;
const b = (s) => `<strong style="color:#1F1F1F;">${s}</strong>`;

function body(firstName) {
  return `
    ${p(`Hi ${firstName},`)}
    ${p(`First, what does ${b("not")} change: your prices, your payouts, your Stripe account, and the way bookings reach you. Nothing about the money is different.`)}
    ${p(`${b("What changed on our side.")} Photo Portugal now operates as a registered Portuguese business (sole trader — Empresária em Nome Individual), with activity from 1 August 2026.`)}
    ${p(`${b("What that means for you.")} It puts on paper something that was already true: you are the one selling the photoshoot. We introduce you to the client, collect and hold their payment, and support you both — but the photography is sold by you, to them. So the invoice for a shoot goes from you to the client. It does not come from us, and it does not go to us.`)}
    ${p(`Three things that are ours to state, so you can rely on them:`)}
    <div style="margin:0 0 14px;padding:14px 16px;background:#F7F4F0;border-radius:10px;">
      ${p(`${b("1. The amount to invoice is your payout")} — the green figure on the booking card (&ldquo;O seu pagamento&rdquo; / &ldquo;Tu pago&rdquo; / &ldquo;Il tuo compenso&rdquo;). Not the client's total, not your package price. If your package is &euro;300, the client pays &euro;345 all-in and your payout is what you invoice.`)}
      ${p(`${b("2. We never invoice you.")} No commission invoice, no monthly bill, nothing to pay us separately. Your plan commission (Free 20% / Pro 15% / Premium 10%) is already reflected in the payout you receive.`)}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A;">${b("3. The &euro;345 the client sees is your price plus our 15% booking fee.")} We charge that fee to the client and invoice them for it ourselves. It is never deducted from your side, and it is separate from your plan commission.</p>
    </div>
    ${p(`${b("What is yours to confirm, not ours.")} We are not your accountant, and nothing in this email is tax advice. Two things in particular depend on your own situation and your own tax regime, so please settle them once with a contabilista (PT) / gestor (ES) / commercialista (IT):`)}
    <ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.65;color:#4A4A4A;">
      <li style="margin-bottom:8px;">${b("When the document is due.")} What starts the clock is the day of the shoot, not the day the money reaches you — your payout arrives after the client accepts the delivery, which is usually later. The exact deadline follows your regime.</li>
      <li>${b("Which document to issue.")} In Portugal a fatura-recibo is invoice and receipt in one and assumes you have already been paid, while a fatura on its own documents the service with a recibo later. Which one fits depends on that timing.</li>
    </ul>
    ${p(`You will also need an open activity with your tax office to invoice at all — início de atividade / recibos verdes (PT), alta de actividad (ES), partita IVA (IT). And one thing worth knowing: a VAT exemption, if you have one, is about VAT only. Income is declared for income tax either way, exactly as it always was — that has not changed here.`)}
    ${p(`${b("Everything else is on one page")}, written for your country, with the screens to click:`)}
    <div style="margin:0 0 18px;text-align:center;">
      <a href="https://photoportugal.com/dashboard/invoicing" style="display:inline-block;padding:12px 26px;background:#C94536;color:#ffffff;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">Read how invoicing works</a>
    </div>
    ${p(`If you have shot with us since 1 August, those sessions need documenting too — worth starting there.`)}
    ${p(`Extras bought from your gallery work the same way, for the amount you receive. Tips go to you in full, and being a gratuity they generally need no invoice.`)}
    ${p(`Two of you have already found things we had written badly, and we have corrected them — please keep doing that. We would much rather be told than have anyone guess. Reply to this email and it comes straight to me.`)}
    <p style="margin:22px 0 0;font-size:15px;line-height:1.5;color:#1F1F1F;font-weight:600;">Kate (Ekaterina Belova)</p>
    <p style="margin:0;font-size:13px;line-height:1.4;color:#9B8E82;">Founder &middot; Photo Portugal</p>
  `;
}

const html = (firstName) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF8F4;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border:1px solid #F0E9E1;border-radius:14px;padding:26px 24px;">${body(firstName)}</div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#B5A99C;">Photo Portugal &middot; <a href="https://photoportugal.com/support" style="color:#B5A99C;">Help</a></p>
  </div>
</body></html>`;

const firstNameOf = (n) => (n || "").trim().split(/\s+/)[0] || "there";

const { Client } = pg;
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(`
  SELECT u.name, u.email, pp.is_approved, (pp.stripe_hidden_at IS NOT NULL) AS hidden
    FROM photographer_profiles pp
    JOIN users u ON u.id = pp.user_id
   WHERE NOT COALESCE(u.is_banned, false)
     AND NOT COALESCE(pp.is_test, false)
     AND u.email IS NOT NULL
     AND u.email NOT LIKE 'deleted_%'
     AND (pp.is_approved OR pp.stripe_hidden_at IS NOT NULL)
     AND u.email <> $1
   ORDER BY pp.is_approved DESC, u.name`, [KATE_ACCOUNT]);
await db.end();

const already = existsSync(LOG)
  ? new Set(readFileSync(LOG, "utf-8").split("\n").map((l) => l.split("\t")[1]).filter(Boolean))
  : new Set();
const todo = rows.filter((r) => !already.has(r.email));

console.log(`recipients: ${rows.length} (approved ${rows.filter((r) => r.is_approved).length}, hidden-no-stripe ${rows.filter((r) => r.hidden).length})`);
console.log(`already sent: ${already.size} · to send now: ${todo.length}`);
for (const r of todo) console.log(`  ${r.is_approved ? "active" : "hidden"}  ${firstNameOf(r.name).padEnd(12)} ${r.email}`);

if (!SEND) {
  console.log(`\nDRY RUN. Sample render for ${firstNameOf(todo[0]?.name)} is ${html(firstNameOf(todo[0]?.name)).length} bytes.`);
  console.log(`Re-run with --send to deliver.`);
  process.exit(0);
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.migadu.com",
  port: parseInt(env.SMTP_PORT || "587"),
  secure: parseInt(env.SMTP_PORT || "587") === 465,
  auth: { user: env.SMTP_CEO_USER, pass: env.SMTP_CEO_PASS },
});
await transporter.verify();
console.log("SMTP (CEO mailbox) verified. Sending…\n");

let ok = 0, failed = 0;
for (const r of todo) {
  const first = firstNameOf(r.name);
  try {
    await transporter.sendMail({
      from: `Kate Belova <${env.SMTP_CEO_USER}>`,
      to: r.email,
      replyTo: env.SMTP_CEO_USER,
      subject: SUBJECT,
      html: html(first),
    });
    appendFileSync(LOG, `${new Date().toISOString()}\t${r.email}\t${r.name}\tsent\n`);
    ok++;
    console.log(`  ✓ ${r.email}`);
  } catch (err) {
    appendFileSync(LOG, `${new Date().toISOString()}\t${r.email}\t${r.name}\tFAILED\t${String(err).slice(0, 200)}\n`);
    failed++;
    console.error(`  ✗ ${r.email} — ${err}`);
  }
  await new Promise((res) => setTimeout(res, 1200)); // be gentle with the relay
}
console.log(`\ndone: ${ok} sent, ${failed} failed. Log: ${LOG}`);
