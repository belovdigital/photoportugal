// One-shot preview: builds the "Can we share your photos?" email Kate
// wants to send to clients ~48h after they approve their delivery, then
// fires a test copy to alex@belov.pt. Two variants — EN + PT — in a
// single MIME multipart so the recipient sees both side by side.

import nodemailer from "nodemailer";

const TO = "alex@belov.pt";

const transporter = nodemailer.createTransport({
  host: "smtp.migadu.com",
  port: 587,
  secure: false,
  auth: { user: "ceo@photoportugal.com", pass: "Diaspora06#" },
});

// Mimics the production /lib/email.ts emailLayout(body, locale) — kept
// inline so this preview script doesn't depend on the Next build.
function layout(body, locale = "en") {
  const labels = {
    en: { help: "Help", privacy: "Privacy", helpUrl: "/support", privacyUrl: "/privacy" },
    pt: { help: "Ajuda", privacy: "Privacidade", helpUrl: "/pt/support", privacyUrl: "/pt/privacy" },
  };
  const L = labels[locale] || labels.en;
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
              <a href="https://photoportugal.com${L.helpUrl}" style="color:#C4B8AD;text-decoration:none;">${L.help}</a>
              <span style="margin:0 6px;">·</span>
              <a href="https://photoportugal.com${L.privacyUrl}" style="color:#C4B8AD;text-decoration:none;">${L.privacy}</a>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Personal-feeling body — keeps the brand shell but drops the
// transactional vibe. No CTA button: the whole point is "reply yes/no".
function body(firstName, photographerName, location, locale) {
  const t = locale === "pt" ? {
    greeting: `Olá ${firstName},`,
    intro: `Sou a Kate, fundadora da Photo Portugal. Espero que estejas a aproveitar as fotos da sessão com <strong>${photographerName}</strong>${location ? ` em <strong>${location}</strong>` : ""} ✨`,
    ask: `Escrevo pessoalmente porque adoraríamos a tua autorização para destacar <strong>algumas das tuas fotos</strong> nas redes sociais da Photo Portugal (Instagram e site).`,
    promise: `Escolheríamos com muito cuidado — só as mais naturais e tranquilas, nada demasiado pessoal. Verias exatamente quais antes de qualquer publicação.`,
    cta: `Se estiveres de acordo, basta responder <strong>"sim"</strong> a este email e enviamos-te as fotos candidatas para aprovação. Se preferes que não, sem stress — responde com <strong>"não"</strong> e o assunto fica fechado.`,
    closing: `Em qualquer caso, obrigada por nos teres escolhido — saber que os nossos fotógrafos tornaram a vossa viagem mais memorável é, honestamente, a melhor parte deste projeto.`,
    signoff: "Com carinho,",
    signature: "Kate",
    title: "Fundadora · Photo Portugal",
  } : {
    greeting: `Hi ${firstName},`,
    intro: `It's Kate, founder of Photo Portugal. I hope you've been enjoying the photos from your session with <strong>${photographerName}</strong>${location ? ` in <strong>${location}</strong>` : ""} ✨`,
    ask: `I'm writing personally because we'd love your permission to feature <strong>a few of your photos</strong> on Photo Portugal's social media (Instagram and our website).`,
    promise: `We'd choose carefully — only the most natural, tasteful shots, nothing too personal or revealing. You'd see exactly which ones before anything goes live.`,
    cta: `If that sounds OK, just reply <strong>"yes"</strong> to this email and we'll send you the candidate photos for approval. If not, no problem at all — just reply <strong>"no thanks"</strong> and that's the end of it.`,
    closing: `Either way, thank you for choosing us — hearing that our photographers made your trip a little more memorable is honestly the best part of running this thing.`,
    signoff: "Warmly,",
    signature: "Kate",
    title: "Founder · Photo Portugal",
  };

  return `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#1F1F1F;">${t.greeting}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">${t.intro}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">${t.ask}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">${t.promise}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">${t.cta}</p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#2A2A2A;">${t.closing}</p>
    <p style="margin:0;font-size:15px;line-height:1.55;color:#2A2A2A;">${t.signoff}</p>
    <p style="margin:4px 0 2px;font-size:15px;line-height:1.4;color:#1F1F1F;font-weight:600;">${t.signature}</p>
    <p style="margin:0;font-size:13px;line-height:1.4;color:#9B8E82;">${t.title}</p>
  `;
}

// Send two variants (EN + PT) so reviewer can compare in one inbox view.
const variants = [
  { locale: "en", subject: "Could we share one of your photos? 🌸",
    fn: "Alex", photog: "Maria Silva", location: "Comporta" },
  { locale: "pt", subject: "Podemos partilhar uma das tuas fotos? 🌸",
    fn: "Alex", photog: "Maria Silva", location: "Comporta" },
];

for (const v of variants) {
  const html = layout(body(v.fn, v.photog, v.location, v.locale), v.locale);
  await transporter.sendMail({
    from: "Kate Belova <ceo@photoportugal.com>",
    to: TO,
    subject: `[PREVIEW ${v.locale.toUpperCase()}] ${v.subject}`,
    html,
    replyTo: "ceo@photoportugal.com",
  });
  console.log(`✓ Sent ${v.locale.toUpperCase()} preview → ${TO}`);
}
