import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { pickT, normalizeLocale } from "@/lib/email-locale";
import { signGiftToken } from "@/lib/gift-token";

const BASE_URL = "https://photoportugal.com";

export type GiftRevealPayload = {
  recipientUserId: string;
  bookingId: string;
  recipientName: string;
  buyerName: string;
  photographerName: string;
  photographerSlug: string;
  packageName: string | null;
  shootDate: string | null;       // ISO date or null (flexible)
  shootTime: string | null;       // e.g. "morning" / "16:00" / null
  locationLabel: string | null;   // human-readable
  locale: string;
  /** Personal note from buyer (booking.message), if any. */
  buyerMessage: string | null;
};

/**
 * Sends the gift-reveal email to the recipient with a /gift/claim magic
 * link. Locale-aware (uses recipient's locale, which defaults to buyer's
 * at booking time).
 */
export async function sendGiftRevealEmail(toEmail: string, p: GiftRevealPayload): Promise<void> {
  const loc = normalizeLocale(p.locale);
  const token = signGiftToken(p.recipientUserId, p.bookingId);
  const claimUrl = `${BASE_URL}/gift/claim?token=${token}`;

  const T = pickT({
    en: {
      subject: `🎁 ${p.buyerName} sent you a photo session`,
      h1: `${p.buyerName} just gifted you a photo session 🎁`,
      intro: `Hi ${p.recipientName.split(" ")[0]} —`,
      body: `${p.buyerName} booked a photoshoot for you on Photo Portugal. Here are the details:`,
      who: "Photographer",
      pkg: "Package",
      when: "Date",
      where: "Location",
      note: "Note from the giver",
      cta: "Open your gift",
      footer: "Click the button to set up your access and see your shoot details. The link is unique to you — don't share it.",
    },
    pt: {
      subject: `🎁 ${p.buyerName} ofereceu-lhe uma sessão fotográfica`,
      h1: `${p.buyerName} ofereceu-lhe uma sessão fotográfica 🎁`,
      intro: `Olá ${p.recipientName.split(" ")[0]} —`,
      body: `${p.buyerName} reservou uma sessão fotográfica para si na Photo Portugal. Detalhes:`,
      who: "Fotógrafo",
      pkg: "Pacote",
      when: "Data",
      where: "Local",
      note: "Mensagem de quem ofereceu",
      cta: "Abrir o seu presente",
      footer: "Clique no botão para configurar o seu acesso e ver os detalhes da sessão. O link é único — não o partilhe.",
    },
    de: {
      subject: `🎁 ${p.buyerName} hat Ihnen ein Fotoshooting geschenkt`,
      h1: `${p.buyerName} hat Ihnen ein Fotoshooting geschenkt 🎁`,
      intro: `Hallo ${p.recipientName.split(" ")[0]} —`,
      body: `${p.buyerName} hat für Sie auf Photo Portugal ein Fotoshooting gebucht. Details:`,
      who: "Fotograf",
      pkg: "Paket",
      when: "Datum",
      where: "Ort",
      note: "Nachricht vom Schenker",
      cta: "Geschenk öffnen",
      footer: "Klicken Sie auf den Button, um Ihren Zugang einzurichten und die Details zu sehen. Der Link ist einzigartig — bitte nicht weitergeben.",
    },
    es: {
      subject: `🎁 ${p.buyerName} le ha regalado una sesión fotográfica`,
      h1: `${p.buyerName} le ha regalado una sesión fotográfica 🎁`,
      intro: `Hola ${p.recipientName.split(" ")[0]} —`,
      body: `${p.buyerName} reservó una sesión fotográfica para usted en Photo Portugal. Detalles:`,
      who: "Fotógrafo",
      pkg: "Paquete",
      when: "Fecha",
      where: "Lugar",
      note: "Mensaje de quien regala",
      cta: "Abrir su regalo",
      footer: "Pulse el botón para configurar su acceso y ver los detalles. El enlace es único — no lo comparta.",
    },
    fr: {
      subject: `🎁 ${p.buyerName} vous a offert une séance photo`,
      h1: `${p.buyerName} vous a offert une séance photo 🎁`,
      intro: `Bonjour ${p.recipientName.split(" ")[0]} —`,
      body: `${p.buyerName} a réservé pour vous une séance photo sur Photo Portugal. Détails :`,
      who: "Photographe",
      pkg: "Forfait",
      when: "Date",
      where: "Lieu",
      note: "Message de la part de l'offrant",
      cta: "Ouvrir votre cadeau",
      footer: "Cliquez sur le bouton pour configurer votre accès et voir les détails. Le lien est unique — ne le partagez pas.",
    },
  }, loc);

  // Date formatting in recipient's locale. Falls back to "Flexible" copy
  // when the buyer left the date open.
  const dateLabel = p.shootDate
    ? new Date(p.shootDate).toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : (loc === "pt" ? "Data flexível" : loc === "de" ? "Flexibles Datum" : loc === "es" ? "Fecha flexible" : loc === "fr" ? "Date flexible" : "Flexible");
  const timeLabel = p.shootTime ? ` · ${p.shootTime}` : "";

  const row = (label: string, value: string | null) => value
    ? `<tr><td style="padding:6px 0;font-size:14px;color:#9B8E82;width:35%;">${label}</td><td style="padding:6px 0;font-size:14px;color:#1F1F1F;font-weight:500;">${escapeHtml(value)}</td></tr>`
    : "";

  const noteBlock = p.buyerMessage && p.buyerMessage.trim()
    ? `<div style="margin:20px 0;padding:16px;background:#FAF6F0;border-left:3px solid #C94536;border-radius:8px;">
         <p style="margin:0 0 6px;font-size:12px;color:#9B8E82;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${T.note}</p>
         <p style="margin:0;font-size:14px;line-height:1.6;color:#4A4A4A;font-style:italic;">"${escapeHtml(p.buyerMessage.trim())}"</p>
       </div>`
    : "";

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1F1F1F;">${escapeHtml(T.h1)}</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#1F1F1F;">${escapeHtml(T.intro)}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4A4A;">${escapeHtml(T.body)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F3EDE6;border-bottom:1px solid #F3EDE6;margin:16px 0;">
      ${row(T.who, p.photographerName)}
      ${row(T.pkg, p.packageName)}
      ${row(T.when, `${dateLabel}${timeLabel}`)}
      ${row(T.where, p.locationLabel)}
    </table>
    ${noteBlock}
    ${emailButton(claimUrl, T.cta)}
    <p style="margin:16px 0 0;font-size:13px;color:#9B8E82;">${escapeHtml(T.footer)}</p>
  `;

  await sendEmail(toEmail, T.subject, emailLayout(body, loc));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
