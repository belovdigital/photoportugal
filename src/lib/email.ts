import nodemailer from "nodemailer";
import { type Locale } from "@/lib/email-locale";
import { queryOne } from "@/lib/db";
import { formatShootDate } from "@/lib/format-shoot-date";
import { maskSurname } from "@/lib/photographer-name";
import { clientPriceWithFee } from "@/lib/service-fee";
import { country } from "@/lib/country";
import { locations } from "@/lib/locations-data";

// Default to 587 + STARTTLS — Hetzner blocks the implicit-TLS port 465
// outbound by default (their anti-abuse policy), so we use the submission
// port. `secure` is derived from the port: 465 → implicit TLS, anything
// else → STARTTLS (which nodemailer auto-upgrades).
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.migadu.com",
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SMTP_USER || country.supportEmail,
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = country.emailFrom;
const BASE_URL = process.env.AUTH_URL || country.baseUrl;

// Kate's personal-tone emails (e.g. social-permission ask after delivery)
// send from ceo@photoportugal.com so replies come back to her directly.
// Separate transporter because it authenticates against a different
// mailbox than the platform's info@ account.
const ceoTransporter = process.env.SMTP_CEO_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.migadu.com",
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: process.env.SMTP_CEO_USER || `ceo@${country.host}`,
        pass: process.env.SMTP_CEO_PASS,
      },
    })
  : null;

// Named from this market's own catalogue rather than a literal list: the
// welcome email told Spanish clients to "find your style in Lisbon, Porto,
// Algarve". The per-language location counts also disagreed with each other
// (20 in English, 40 in German), so they are gone rather than reconciled.
const TOP_CITIES = locations.slice(0, 3).map((l) => l.name).join(", ");

export async function getAdminEmail(): Promise<string> {
  try {
    const setting = await queryOne<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'admin_notification_email'"
    );
    return setting?.value || "";
  } catch {
    return "";
  }
}

/**
 * Sanitise a user-supplied address before it becomes a Reply-To header.
 *
 * Anchored on purpose: `a@b.com, attacker@evil.com` is a single valid-looking
 * string that would put two addresses in Reply-To, so a staff Reply-All would
 * also write to whoever asked for it. The anchors reject anything with a comma
 * or whitespace. Returns undefined for junk, which drops the header entirely
 * rather than shipping a broken one — the body still prints the address.
 *
 * (Newline injection is separately impossible: nodemailer collapses CR/LF in
 * header values. This guards the multi-address case, which it does not.)
 */
export function replyToAddress(raw?: string | null): string | undefined {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed.length > 254) return undefined;
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(trimmed) ? trimmed : undefined;
}

export async function sendEmail(to: string, subject: string, html: string, options?: { replyTo?: string }) {
  if (!process.env.SMTP_PASS) {
    console.log(`[email] SMTP not configured, skipping: ${subject} → ${to}`);
    return;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, html, ...(options?.replyTo ? { replyTo: options.replyTo } : {}) });
    console.log(`[email] Sent: ${subject} → ${to}`);
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject.slice(0, 100), "sent")).catch(() => {});
  } catch (error) {
    console.error(`[email] Failed: ${subject} → ${to}`, error);
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject.slice(0, 100), "failed", undefined, String(error))).catch(() => {});
  }
}

// === Email template wrapper ===
export function emailLayout(body: string, locale: Locale = "en"): string {
  const labels: Record<string, { help: string; privacy: string; helpUrl: string; privacyUrl: string }> = {
    en: { help: "Help", privacy: "Privacy", helpUrl: "/support", privacyUrl: "/privacy" },
    pt: { help: "Ajuda", privacy: "Privacidade", helpUrl: "/pt/support", privacyUrl: "/pt/privacy" },
    de: { help: "Hilfe", privacy: "Datenschutz", helpUrl: "/de/support", privacyUrl: "/de/privacy" },
    es: { help: "Ayuda", privacy: "Privacidad", helpUrl: "/es/support", privacyUrl: "/es/privacy" },
    fr: { help: "Aide", privacy: "Confidentialité", helpUrl: "/fr/support", privacyUrl: "/fr/privacy" },
    it: { help: "Aiuto", privacy: "Privacy", helpUrl: "/it/support", privacyUrl: "/it/privacy" },
  };
  const L = labels[locale] || labels.en;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #F3EDE6;">
          <a href="${country.baseUrl}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
            <img src="${country.baseUrl}/logo-icon.png" width="28" height="28" alt="" style="border-radius:6px;">
            <span style="font-size:17px;font-weight:700;color:#1F1F1F;letter-spacing:-0.3px;">${country.brand}</span>
          </a>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px 32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#FAFAF8;border-top:1px solid #F3EDE6;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#9B8E82;">
                <a href="${country.baseUrl}" style="color:#9B8E82;text-decoration:none;font-weight:500;">${country.host}</a>
              </td>
              <td align="right" style="font-size:13px;color:#C4B8AD;">
                <a href="${country.baseUrl}${L.helpUrl}" style="color:#C4B8AD;text-decoration:none;">${L.help}</a>
                <span style="margin:0 6px;">·</span>
                <a href="${country.baseUrl}${L.privacyUrl}" style="color:#C4B8AD;text-decoration:none;">${L.privacy}</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string, color: string = "#C94536"): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center">
    <a href="${href}" style="display:inline-block;background:${color};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>
  </td></tr></table>`;
}

export async function sendSaveForLaterEmail(
  to: string,
  photographer: { slug: string; name: string; tagline: string | null; cover_url: string | null; min_price: number | null },
  locale: string
): Promise<void> {
  const { pickT, localizedUrl, normalizeLocale } = await import("@/lib/email-locale");
  const loc = normalizeLocale(locale);
  const profileUrl = localizedUrl(`/photographers/${photographer.slug}`, loc, BASE_URL);

  const T = pickT({
    en: { subject: `Your link to ${photographer.name}`, h2: "Here's your link", body: "Thanks for saving this photographer. You can come back any time to view the portfolio and book.", from: "From", cta: "View Profile", footer: "Questions? Just reply to this email — our team is here to help." },
    pt: { subject: `A sua ligação para ${photographer.name}`, h2: "Aqui está a sua ligação", body: "Obrigado por guardar este fotógrafo. Pode voltar a qualquer altura para ver o portefólio e reservar.", from: "A partir de", cta: "Ver Perfil", footer: "Se tiver dúvidas, responda a este email — a nossa equipa está aqui para ajudar." },
    de: { subject: `Ihr Link zu ${photographer.name}`, h2: "Hier ist Ihr Link", body: "Danke, dass Sie diesen Fotografen gespeichert haben. Sie können jederzeit zurückkehren, um das Portfolio anzusehen und zu buchen.", from: "Ab", cta: "Profil ansehen", footer: "Fragen? Antworten Sie einfach auf diese E-Mail — unser Team ist für Sie da." },
    es: { subject: `Su enlace a ${photographer.name}`, h2: "Aquí tiene su enlace", body: "Gracias por guardar a este fotógrafo. Puede volver cuando quiera para ver el portafolio y reservar.", from: "Desde", cta: "Ver perfil", footer: "¿Preguntas? Responda a este correo — nuestro equipo está aquí para ayudar." },
    fr: { subject: `Votre lien vers ${photographer.name}`, h2: "Voici votre lien", body: "Merci d'avoir enregistré ce photographe. Vous pouvez revenir quand vous voulez pour voir le portfolio et réserver.", from: "À partir de", cta: "Voir le profil", footer: "Des questions ? Répondez simplement à cet e-mail — notre équipe est là pour vous aider." },
    it: { subject: `Il tuo link a ${photographer.name}`, h2: "Ecco il tuo link", body: "Grazie per aver salvato questo fotografo. Puoi tornare quando vuoi per vedere il portfolio e prenotare.", from: "Da", cta: "Vedi il profilo", footer: "Domande? Rispondi a questa email — il nostro team è qui per aiutarti." },
  }, loc);

  const cover = photographer.cover_url
    ? `<img src="${photographer.cover_url}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin-bottom:16px;" />`
    : "";

  const priceLine = photographer.min_price
    ? `<p style="margin:4px 0 0;font-size:14px;color:#4A4A4A;">${T.from} <strong>€${clientPriceWithFee(Number(photographer.min_price))}</strong></p>`
    : "";

  const tagline = photographer.tagline
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6B6055;">${photographer.tagline}</p>`
    : "";

  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
    ${cover}
    <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1F1F1F;">${photographer.name}</p>
    ${priceLine}
    ${tagline}
    ${emailButton(profileUrl, T.cta)}
    <p style="margin:16px 0 0;font-size:13px;color:#9B8E82;">${T.footer}</p>
  `;

  await sendEmail(to, T.subject, emailLayout(body, loc));
}

/**
 * Small social-proof block with a real review + "Join N+ travelers" line.
 * Returns ready-made HTML fragment (empty string if DB is empty).
 */
export async function emailSocialProof(): Promise<string> {
  try {
    const { queryOne } = await import("@/lib/db");
    const row = await queryOne<{ text: string; client_name_override: string | null; photographer_slug: string; photographer_name: string; review_count: string }>(
      `WITH top_review AS (
         SELECT r.text, r.client_name_override, pp.slug as photographer_slug, pu.name as photographer_name
         FROM reviews r
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         WHERE r.is_approved = TRUE AND pp.is_approved = TRUE
           AND r.text IS NOT NULL AND LENGTH(r.text) BETWEEN 60 AND 220
         ORDER BY RANDOM()
         LIMIT 1
       ),
       total AS (SELECT COUNT(*)::text as review_count FROM reviews WHERE is_approved = TRUE)
       SELECT tr.text, tr.client_name_override, tr.photographer_slug, tr.photographer_name, t.review_count
       FROM top_review tr CROSS JOIN total t`
    );
    if (!row) return "";
    const quote = row.text.length > 220 ? row.text.slice(0, 220).replace(/\s\S*$/, "") + "…" : row.text;
    const name = row.client_name_override || "Private Client";
    return `<div style="margin:24px 0 0;padding:16px;background:#FAFAF8;border-radius:10px;border:1px solid #F3EDE6;">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.5px;color:#9B8E82;text-transform:uppercase;">Join ${row.review_count}+ travelers who loved their photoshoot</p>
  <p style="margin:0 0 8px;font-size:14px;font-style:italic;line-height:1.5;color:#4A4A4A;">&ldquo;${quote}&rdquo;</p>
  <p style="margin:0;font-size:12px;color:#9B8E82;">— ${name} · <a href="${country.baseUrl}/photographers/${row.photographer_slug}" style="color:#C94536;text-decoration:none;">${row.photographer_name}</a></p>
</div>`;
  } catch {
    return "";
  }
}

// === Email templates ===

export async function sendBookingNotification(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  packageName: string | null,
  shootDate: string | null,
  conciergeChatId?: string | null,
  bookingId?: string | null
) {
  // The concierge_chat_id is written to bookings AFTER this email
  // fires (the attribution lookup is fire-and-forget). To still
  // include the concierge context, we re-query the booking by id
  // after a short delay if we have a bookingId and no chatId yet —
  // gives the attribution writer a chance to land first.
  if (!conciergeChatId && bookingId) {
    const { queryOne } = await import("@/lib/db");
    // Two short attempts spaced 800ms apart. The attribution write
    // typically lands within ~50-200ms; we wait a moment to give it
    // room. If it never lands, we just send the plain notification.
    for (let attempt = 0; attempt < 2; attempt++) {
      const row = await queryOne<{ concierge_chat_id: string | null }>(
        "SELECT concierge_chat_id FROM bookings WHERE id = $1",
        [bookingId]
      ).catch(() => null);
      if (row?.concierge_chat_id) {
        conciergeChatId = row.concierge_chat_id;
        break;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);
  shootDate = formatShootDate(shootDate, locale);
  const clientFirstName = clientName.split(" ")[0];

  // Concierge attribution — when the booking came from a Lens chat, we
  // surface what the visitor originally asked for so the photographer's
  // first reply can be context-aware. A short, redacted excerpt; no
  // attempt to summarise — the raw words are more useful for a human
  // reading the email.
  let conciergeBlockHtml = "";
  if (conciergeChatId) {
    try {
      const { queryOne } = await import("@/lib/db");
      const row = await queryOne<{ messages: Array<{ role: string; content: string }>; source_chip: string | null }>(
        "SELECT messages, source_chip FROM concierge_chats WHERE id = $1",
        [conciergeChatId]
      );
      if (row?.messages) {
        const firstUserMsg = row.messages.find((m) => m.role === "user")?.content?.trim() || "";
        if (firstUserMsg) {
          const heading = pickT({
            en: "From Lens (our AI Concierge) — the visitor's original ask:",
            pt: "Do Lens (o nosso AI Concierge) — pedido original do visitante:",
            de: "Von Lens (unser AI Concierge) — die ursprüngliche Anfrage:",
            es: "De Lens (nuestro AI Concierge) — petición original del visitante:",
            fr: "De Lens (notre AI Concierge) — demande initiale du visiteur :",
            it: "Da Lens (il nostro AI Concierge) — la richiesta originale del visitatore:",
          }, locale);
          const safe = firstUserMsg.slice(0, 400).replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const chipLine = row.source_chip ? `<br /><span style="font-size:12px;color:#9aa1a8;">(Started via: ${row.source_chip.replace(/</g, "&lt;").replace(/>/g, "&gt;")})</span>` : "";
          conciergeBlockHtml = `
            <div style="margin:16px 0;padding:14px 16px;border-left:3px solid #C94536;background:#FAF7F2;border-radius:6px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1F1F1F;">${heading}</p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#4A4A4A;font-style:italic;">"${safe}"</p>
              ${chipLine}
            </div>
          `;
        }
      }
    } catch {
      // Best-effort enrichment — if the lookup fails, just send the
      // standard notification without the concierge context block.
    }
  }

  const T = pickT({
    en: { subject: `New booking request from ${clientFirstName}`, h2: "New Booking Request", greeting: `Hi ${photographerName},`, body: `<strong>${clientFirstName}</strong> has requested a photoshoot${packageName ? ` (${packageName})` : ""}${shootDate ? ` on ${shootDate}` : ""}.`, cta: "View Booking" },
    pt: { subject: `Novo pedido de reserva de ${clientFirstName}`, h2: "Novo Pedido de Reserva", greeting: `Olá ${photographerName},`, body: `<strong>${clientFirstName}</strong> pediu uma sessão fotográfica${packageName ? ` (${packageName})` : ""}${shootDate ? ` a ${shootDate}` : ""}.`, cta: "Ver Reserva" },
    de: { subject: `Neue Buchungsanfrage von ${clientFirstName}`, h2: "Neue Buchungsanfrage", greeting: `Hallo ${photographerName},`, body: `<strong>${clientFirstName}</strong> hat ein Fotoshooting angefragt${packageName ? ` (${packageName})` : ""}${shootDate ? ` am ${shootDate}` : ""}.`, cta: "Buchung ansehen" },
    es: { subject: `Nueva solicitud de reserva de ${clientFirstName}`, h2: "Nueva solicitud de reserva", greeting: `Hola ${photographerName},`, body: `<strong>${clientFirstName}</strong> ha solicitado una sesión fotográfica${packageName ? ` (${packageName})` : ""}${shootDate ? ` el ${shootDate}` : ""}.`, cta: "Ver reserva" },
    fr: { subject: `Nouvelle demande de réservation de ${clientFirstName}`, h2: "Nouvelle demande de réservation", greeting: `Bonjour ${photographerName},`, body: `<strong>${clientFirstName}</strong> a demandé une séance photo${packageName ? ` (${packageName})` : ""}${shootDate ? ` le ${shootDate}` : ""}.`, cta: "Voir la réservation" },
    it: { subject: `Nuova richiesta di prenotazione da ${clientFirstName}`, h2: "Nuova richiesta di prenotazione", greeting: `Ciao ${photographerName},`, body: `<strong>${clientFirstName}</strong> ha richiesto un servizio fotografico${packageName ? ` (${packageName})` : ""}${shootDate ? ` il ${shootDate}` : ""}.`, cta: "Vedi la prenotazione" },
  }, locale);

  await sendEmail(
    photographerEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
      ${conciergeBlockHtml}
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

export async function sendBookingRequestToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  packageName: string | null,
  shootDate: string | null
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  shootDate = formatShootDate(shootDate, locale);
  const firstName = clientName.split(" ")[0];
  const photographerDisplay = maskSurname(photographerName);
  const T = pickT({
    en: {
      subject: `Booking request sent to ${photographerDisplay}`,
      h2: "Booking Request Sent!",
      greeting: `Hi ${firstName},`,
      body: `Your booking request has been sent to <strong>${photographerDisplay}</strong>${packageName ? ` for ${packageName}` : ""}${shootDate ? ` on ${shootDate}` : ""}.`,
      nextLabel: "What happens next?",
      next: `${photographerDisplay} will review your request and get back to you shortly. You can also message them directly to discuss details.`,
      cta: "View Your Booking",
    },
    pt: {
      subject: `Pedido de reserva enviado a ${photographerDisplay}`,
      h2: "Pedido de Reserva Enviado!",
      greeting: `Olá ${firstName},`,
      body: `O seu pedido de reserva foi enviado a <strong>${photographerDisplay}</strong>${packageName ? ` para ${packageName}` : ""}${shootDate ? ` a ${shootDate}` : ""}.`,
      nextLabel: "O que acontece a seguir?",
      next: `${photographerDisplay} irá analisar o seu pedido e responder em breve. Pode também enviar-lhe uma mensagem directa para combinar os detalhes.`,
      cta: "Ver a Sua Reserva",
    },
    de: {
      subject: `Buchungsanfrage an ${photographerDisplay} gesendet`,
      h2: "Buchungsanfrage gesendet!",
      greeting: `Hallo ${firstName},`,
      body: `Ihre Buchungsanfrage wurde an <strong>${photographerDisplay}</strong>${packageName ? ` für ${packageName}` : ""}${shootDate ? ` am ${shootDate}` : ""} gesendet.`,
      nextLabel: "Wie geht es weiter?",
      next: `${photographerDisplay} wird Ihre Anfrage prüfen und sich in Kürze bei Ihnen melden. Sie können dem Fotografen auch direkt eine Nachricht senden, um Details zu besprechen.`,
      cta: "Buchung anzeigen",
    },
    fr: {
      subject: `Demande de réservation envoyée à ${photographerDisplay}`,
      h2: "Demande de réservation envoyée !",
      greeting: `Bonjour ${firstName},`,
      body: `Votre demande de réservation a été envoyée à <strong>${photographerDisplay}</strong>${packageName ? ` pour ${packageName}` : ""}${shootDate ? ` le ${shootDate}` : ""}.`,
      nextLabel: "Que se passe-t-il ensuite ?",
      next: `${photographerDisplay} examinera votre demande et reviendra vers vous rapidement. Vous pouvez aussi lui envoyer un message directement pour discuter des détails.`,
      cta: "Voir votre réservation",
    },
    es: {
      subject: `Solicitud de reserva enviada a ${photographerDisplay}`,
      h2: "¡Solicitud de reserva enviada!",
      greeting: `Hola ${firstName},`,
      body: `Su solicitud de reserva ha sido enviada a <strong>${photographerDisplay}</strong>${packageName ? ` para ${packageName}` : ""}${shootDate ? ` el ${shootDate}` : ""}.`,
      nextLabel: "¿Qué pasa ahora?",
      next: `${photographerDisplay} revisará su solicitud y le responderá en breve. También puede enviarle un mensaje directo para acordar los detalles.`,
      cta: "Ver su reserva",
    },
    it: {
      subject: `Richiesta di prenotazione inviata a ${photographerDisplay}`,
      h2: "Richiesta di prenotazione inviata!",
      greeting: `Ciao ${firstName},`,
      body: `La tua richiesta di prenotazione è stata inviata a <strong>${photographerDisplay}</strong>${packageName ? ` per ${packageName}` : ""}${shootDate ? ` il ${shootDate}` : ""}.`,
      nextLabel: "Cosa succede adesso?",
      next: `${photographerDisplay} esaminerà la tua richiesta e ti risponderà a breve. Puoi anche scrivere direttamente per concordare i dettagli.`,
      cta: "Vedi la tua prenotazione",
    },
  }, locale);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${T.nextLabel}</strong> ${T.next}</p>
      </div>
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

export async function sendBookingConfirmation(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  shootDate: string | null
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  shootDate = formatShootDate(shootDate, locale);
  const socialProof = await emailSocialProof();
  const T = pickT({
    en: {
      subject: `Booking confirmed with ${photographerName}!`,
      h2: "Booking Confirmed!",
      greeting: `Hi ${clientName.split(" ")[0]},`,
      confirmed: `<strong>${photographerName}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.`,
      msgPrompt: "You can message your photographer to discuss the details.",
      nextStepLabel: "Next step:",
      nextStep: "Discuss the meeting point, outfit ideas, and any special requests with your photographer through our messaging system.",
      cta: "Open Messages",
    },
    pt: {
      subject: `Reserva confirmada com ${photographerName}!`,
      h2: "Reserva Confirmada!",
      greeting: `Olá ${clientName.split(" ")[0]},`,
      confirmed: `<strong>${photographerName}</strong> confirmou a sua sessão fotográfica${shootDate ? ` a ${shootDate}` : ""}.`,
      msgPrompt: "Pode enviar mensagens ao seu fotógrafo para combinar os detalhes.",
      nextStepLabel: "Próximo passo:",
      nextStep: "Combine o ponto de encontro, ideias de outfit e quaisquer pedidos especiais com o seu fotógrafo através do nosso sistema de mensagens.",
      cta: "Abrir Mensagens",
    },
    de: {
      subject: `Buchung mit ${photographerName} bestätigt!`,
      h2: "Buchung bestätigt!",
      greeting: `Hallo ${clientName.split(" ")[0]},`,
      confirmed: `<strong>${photographerName}</strong> hat Ihr Fotoshooting${shootDate ? ` am ${shootDate}` : ""} bestätigt.`,
      msgPrompt: "Sie können Ihrem Fotografen Nachrichten senden, um Details zu besprechen.",
      nextStepLabel: "Nächster Schritt:",
      nextStep: "Besprechen Sie Treffpunkt, Outfit-Ideen und Sonderwünsche mit Ihrem Fotografen über unser Nachrichtensystem.",
      cta: "Nachrichten öffnen",
    },
    fr: {
      subject: `Réservation confirmée avec ${photographerName} !`,
      h2: "Réservation confirmée !",
      greeting: `Bonjour ${clientName.split(" ")[0]},`,
      confirmed: `<strong>${photographerName}</strong> a confirmé votre séance photo${shootDate ? ` le ${shootDate}` : ""}.`,
      msgPrompt: "Vous pouvez envoyer un message à votre photographe pour discuter des détails.",
      nextStepLabel: "Prochaine étape :",
      nextStep: "Discutez du point de rencontre, des idées de tenue et de toute demande spéciale avec votre photographe via notre système de messagerie.",
      cta: "Ouvrir les messages",
    },
    es: {
      subject: `¡Reserva confirmada con ${photographerName}!`,
      h2: "¡Reserva confirmada!",
      greeting: `Hola ${clientName.split(" ")[0]},`,
      confirmed: `<strong>${photographerName}</strong> ha confirmado su sesión fotográfica${shootDate ? ` el ${shootDate}` : ""}.`,
      msgPrompt: "Puede enviar un mensaje a su fotógrafo para acordar los detalles.",
      nextStepLabel: "Siguiente paso:",
      nextStep: "Acuerde con su fotógrafo el punto de encuentro, ideas de outfit y cualquier petición especial a través de nuestro sistema de mensajería.",
      cta: "Abrir mensajes",
    },
    it: {
      subject: `Prenotazione confermata con ${photographerName}!`,
      h2: "Prenotazione confermata!",
      greeting: `Ciao ${clientName.split(" ")[0]},`,
      confirmed: `<strong>${photographerName}</strong> ha confermato il tuo servizio fotografico${shootDate ? ` il ${shootDate}` : ""}.`,
      msgPrompt: "Puoi scrivere al tuo fotografo per concordare i dettagli.",
      nextStepLabel: "Prossimo passo:",
      nextStep: "Concorda con il tuo fotografo il punto d'incontro, le idee sull'outfit e qualsiasi richiesta particolare tramite il nostro sistema di messaggi.",
      cta: "Apri i messaggi",
    },
  }, locale);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.confirmed}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.msgPrompt}</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${T.nextStepLabel}</strong> ${T.nextStep}</p>
      </div>
      ${emailButton(localizedUrl("/dashboard/messages", locale, BASE_URL), T.cta)}
      ${socialProof}
    `, locale)
  );
}

export async function sendBookingConfirmationWithPayment(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  shootDate: string | null,
  paymentUrl: string | null,
  totalPrice: number | null
) {
  const { getUserLocaleByEmail, pickT, localizedUrl, formatPrice } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  shootDate = formatShootDate(shootDate, locale);
  const price = totalPrice ? Math.round(Number(totalPrice)) : null;
  const firstName = clientName.split(" ")[0];
  const photographerDisplay = maskSurname(photographerName);

  const T = pickT({
    en: {
      subject: `${photographerDisplay} confirmed your booking${totalPrice ? ` — pay within 24h to secure` : ""}!`,
      h2: "Booking Confirmed!",
      greeting: `Hi ${firstName},`,
      confirmed: `<strong>${photographerDisplay}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.`,
      paymentLabel: "Payment required:",
      paymentBody: (priceStr: string) => `Please pay ${priceStr} to secure your session. Your payment is held safely until you receive and accept your photos.`,
      payNow: (priceStr: string) => `Pay Now — ${priceStr}`,
      viewBooking: "View Booking",
      deadlineLabel: "⏰ Important — your slot is held for 24 hours.",
      deadlineBody: `Payment guarantees your slot. ${photographerDisplay} is holding this time for you, but if payment is not received within 24 hours, the booking will be automatically cancelled and the slot released to other clients. Your slot only locks in once payment clears — until then another client paying first could take the date.`,
      tipLabel: "Tip:",
      tip: "We also recommend messaging your photographer to discuss meeting point, outfit ideas, and any special requests.",
      cta: "Open Messages",
    },
    pt: {
      subject: `${photographerDisplay} confirmou a sua reserva${totalPrice ? ` — pague em 24h para garantir` : ""}!`,
      h2: "Reserva Confirmada!",
      greeting: `Olá ${firstName},`,
      confirmed: `<strong>${photographerDisplay}</strong> confirmou a sua sessão fotográfica${shootDate ? ` a ${shootDate}` : ""}.`,
      paymentLabel: "Pagamento necessário:",
      paymentBody: (priceStr: string) => `Por favor, pague ${priceStr} para garantir a sua sessão. O pagamento fica guardado em segurança até receber e aceitar as suas fotos.`,
      payNow: (priceStr: string) => `Pagar Agora — ${priceStr}`,
      viewBooking: "Ver Reserva",
      deadlineLabel: "⏰ Importante — o seu horário está reservado por 24 horas.",
      deadlineBody: `O pagamento garante o seu horário. ${photographerDisplay} está a reservar este tempo para si, mas se o pagamento não for recebido em 24 horas, a reserva será automaticamente cancelada e o horário libertado para outros clientes. O seu lugar só fica reservado depois do pagamento — até lá, outro cliente que pagar primeiro pode levar essa data.`,
      tipLabel: "Dica:",
      tip: "Recomendamos também enviar uma mensagem ao seu fotógrafo para combinar o ponto de encontro, ideias de outfit e quaisquer pedidos especiais.",
      cta: "Abrir Mensagens",
    },
    de: {
      subject: `${photographerDisplay} hat Ihre Buchung bestätigt${totalPrice ? ` — innerhalb 24h bezahlen, um sie zu sichern` : ""}!`,
      h2: "Buchung bestätigt!",
      greeting: `Hallo ${firstName},`,
      confirmed: `<strong>${photographerDisplay}</strong> hat Ihr Fotoshooting${shootDate ? ` am ${shootDate}` : ""} bestätigt.`,
      paymentLabel: "Zahlung erforderlich:",
      paymentBody: (priceStr: string) => `Bitte zahlen Sie ${priceStr}, um Ihren Termin zu sichern. Ihre Zahlung wird sicher verwahrt, bis Sie Ihre Fotos erhalten und annehmen.`,
      payNow: (priceStr: string) => `Jetzt bezahlen — ${priceStr}`,
      viewBooking: "Buchung anzeigen",
      deadlineLabel: "⏰ Wichtig — Ihr Termin ist 24 Stunden reserviert.",
      deadlineBody: `Die Zahlung sichert Ihren Termin. ${photographerDisplay} hält diese Zeit für Sie frei, aber wenn die Zahlung nicht innerhalb von 24 Stunden eingeht, wird die Buchung automatisch storniert und der Termin für andere Kunden freigegeben. Ihr Slot wird erst nach erfolgter Zahlung gesperrt — bis dahin könnte ein anderer Kunde, der zuerst bezahlt, das Datum übernehmen.`,
      tipLabel: "Tipp:",
      tip: "Wir empfehlen, Ihrem Fotografen eine Nachricht zu senden, um Treffpunkt, Outfit-Ideen und Sonderwünsche zu besprechen.",
      cta: "Nachrichten öffnen",
    },
    fr: {
      subject: `${photographerDisplay} a confirmé votre réservation${totalPrice ? ` — payez sous 24h pour la sécuriser` : ""} !`,
      h2: "Réservation confirmée !",
      greeting: `Bonjour ${firstName},`,
      confirmed: `<strong>${photographerDisplay}</strong> a confirmé votre séance photo${shootDate ? ` le ${shootDate}` : ""}.`,
      paymentLabel: "Paiement requis :",
      paymentBody: (priceStr: string) => `Veuillez payer ${priceStr} pour sécuriser votre séance. Votre paiement est conservé en sécurité jusqu'à ce que vous receviez et acceptiez vos photos.`,
      payNow: (priceStr: string) => `Payer maintenant — ${priceStr}`,
      viewBooking: "Voir la réservation",
      deadlineLabel: "⏰ Important — votre créneau est réservé pendant 24 heures.",
      deadlineBody: `Le paiement garantit votre créneau. ${photographerDisplay} réserve ce moment pour vous, mais si le paiement n'est pas reçu dans les 24 heures, la réservation sera automatiquement annulée et le créneau libéré pour d'autres clients. Votre créneau n'est verrouillé qu'après le paiement — jusque-là, un autre client qui paie en premier pourrait prendre la date.`,
      tipLabel: "Astuce :",
      tip: "Nous recommandons aussi d'envoyer un message à votre photographe pour discuter du point de rencontre, des idées de tenue et de toute demande spéciale.",
      cta: "Ouvrir les messages",
    },
    es: {
      subject: `¡${photographerDisplay} confirmó su reserva${totalPrice ? ` — pague en 24h para asegurarla` : ""}!`,
      h2: "¡Reserva confirmada!",
      greeting: `Hola ${firstName},`,
      confirmed: `<strong>${photographerDisplay}</strong> ha confirmado su sesión fotográfica${shootDate ? ` el ${shootDate}` : ""}.`,
      paymentLabel: "Pago requerido:",
      paymentBody: (priceStr: string) => `Por favor pague ${priceStr} para asegurar su sesión. Su pago queda guardado de forma segura hasta que reciba y acepte sus fotos.`,
      payNow: (priceStr: string) => `Pagar ahora — ${priceStr}`,
      viewBooking: "Ver reserva",
      deadlineLabel: "⏰ Importante — su horario está reservado por 24 horas.",
      deadlineBody: `El pago garantiza su horario. ${photographerDisplay} está reservando este tiempo para usted, pero si no se recibe el pago en 24 horas, la reserva se cancelará automáticamente y el horario quedará disponible para otros clientes. Su plaza solo queda reservada una vez completado el pago — hasta entonces, otro cliente que pague antes podría llevarse la fecha.`,
      tipLabel: "Consejo:",
      tip: "Le recomendamos también enviar un mensaje a su fotógrafo para acordar el punto de encuentro, ideas de outfit y cualquier petición especial.",
      cta: "Abrir mensajes",
    },
    it: {
      subject: `${photographerDisplay} ha confermato la tua prenotazione${totalPrice ? ` — paga entro 24h per bloccarla` : ""}!`,
      h2: "Prenotazione confermata!",
      greeting: `Ciao ${firstName},`,
      confirmed: `<strong>${photographerDisplay}</strong> ha confermato il tuo servizio fotografico${shootDate ? ` il ${shootDate}` : ""}.`,
      paymentLabel: "Pagamento richiesto:",
      paymentBody: (priceStr: string) => `Paga ${priceStr} per bloccare la tua sessione. Il pagamento resta al sicuro finché non ricevi e accetti le foto.`,
      payNow: (priceStr: string) => `Paga ora — ${priceStr}`,
      viewBooking: "Vedi la prenotazione",
      deadlineLabel: "⏰ Importante — il tuo orario è tenuto per 24 ore.",
      deadlineBody: `Il pagamento garantisce il tuo orario. ${photographerDisplay} lo sta tenendo per te, ma se il pagamento non arriva entro 24 ore la prenotazione viene annullata automaticamente e l'orario torna disponibile. Il posto è tuo solo a pagamento completato — fino ad allora un altro cliente che paga prima può prendersi la data.`,
      tipLabel: "Consiglio:",
      tip: "Ti consigliamo anche di scrivere al tuo fotografo per concordare il punto d'incontro, le idee sull'outfit e qualsiasi richiesta particolare.",
      cta: "Apri i messaggi",
    },
  }, locale);

  const priceStr = price ? formatPrice(price, locale) : "";
  const deadlineSection = paymentUrl && price
    ? `<div style="margin:16px 0;padding:16px;background:#FFF5E5;border-radius:10px;border:2px solid #F59E0B;">
        <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#92400E;font-weight:700;">${T.deadlineLabel}</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#78350F;">${T.deadlineBody}</p>
      </div>`
    : "";
  const paymentSection = paymentUrl && price
    ? `<div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${T.paymentLabel}</strong> ${T.paymentBody(priceStr)}</p>
      </div>
      ${emailButton(paymentUrl, T.payNow(priceStr), "#16A34A")}
      ${deadlineSection}`
    : emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.viewBooking);

  const socialProof = await emailSocialProof();
  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.confirmed}</p>
      ${paymentSection}
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${T.tipLabel}</strong> ${T.tip}</p>
      </div>
      ${emailButton(localizedUrl("/dashboard/messages", locale, BASE_URL), T.cta)}
      ${socialProof}
    `, locale)
  );
}

export async function sendPaymentReceivedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  bookingId: string,
  amount: number,
  clientPhone?: string | null
) {
  const firstName = clientName.split(" ")[0];
  const contactSection = clientPhone
    ? `<div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong style="color:#16A34A;">Client phone:</strong> ${clientPhone}</p>
      </div>`
    : "";

  // `amount` is the photographer's PAYOUT (what they receive after the
  // platform fee), NOT the gross the client paid — showing the gross here
  // confused photographers into thinking it was their earnings.
  const payoutLabel = `&euro;${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  await sendEmail(
    photographerEmail,
    `Payment received from ${firstName} — your payout ${payoutLabel}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Received!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${firstName}</strong> has booked and paid for their session. Your payout is <strong>${payoutLabel}</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">The funds are held securely until the client accepts the photo delivery.</p>
      ${contactSection}
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking")}
    `)
  );
}

export async function sendPaymentConfirmedToClient(
  clientEmail: string,
  clientName: string,
  photographerNameRaw: string,
  amount: number
) {
  /** Anti-disintermediation: a client never sees the surname. */
  const photographerName = maskSurname(photographerNameRaw);
  const { getUserLocaleByEmail, pickT, localizedUrl, formatPrice } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  const firstName = clientName.split(" ")[0];
  const priceStr = formatPrice(amount, locale);
  const T = pickT({
    en: {
      subject: `Payment confirmed — ${priceStr} for your session with ${photographerName}`,
      h2: "Payment Confirmed!",
      greeting: `Hi ${firstName},`,
      body1: `Your payment of <strong>${priceStr}</strong> for your photoshoot with <strong>${photographerName}</strong> has been confirmed.`,
      body2: "Your funds are held securely. After your photoshoot, your photographer will deliver your edited photos. Once you accept the delivery, the payment will be released to the photographer.",
      cta: "View Booking",
    },
    pt: {
      subject: `Pagamento confirmado — ${priceStr} para a sua sessão com ${photographerName}`,
      h2: "Pagamento Confirmado!",
      greeting: `Olá ${firstName},`,
      body1: `O seu pagamento de <strong>${priceStr}</strong> para a sessão fotográfica com <strong>${photographerName}</strong> foi confirmado.`,
      body2: "O seu dinheiro fica guardado em segurança. Após a sessão, o fotógrafo entrega-lhe as fotos editadas. Quando aceitar a entrega, o pagamento é libertado ao fotógrafo.",
      cta: "Ver Reserva",
    },
    de: {
      subject: `Zahlung bestätigt — ${priceStr} für Ihre Session mit ${photographerName}`,
      h2: "Zahlung bestätigt!",
      greeting: `Hallo ${firstName},`,
      body1: `Ihre Zahlung von <strong>${priceStr}</strong> für Ihr Fotoshooting mit <strong>${photographerName}</strong> wurde bestätigt.`,
      body2: "Ihr Geld wird sicher verwahrt. Nach dem Fotoshooting liefert Ihr Fotograf Ihnen die bearbeiteten Fotos. Sobald Sie die Lieferung annehmen, wird die Zahlung an den Fotografen freigegeben.",
      cta: "Buchung anzeigen",
    },
    fr: {
      subject: `Paiement confirmé — ${priceStr} pour votre séance avec ${photographerName}`,
      h2: "Paiement confirmé !",
      greeting: `Bonjour ${firstName},`,
      body1: `Votre paiement de <strong>${priceStr}</strong> pour votre séance photo avec <strong>${photographerName}</strong> a été confirmé.`,
      body2: "Votre argent est conservé en toute sécurité. Après la séance, votre photographe vous livrera les photos éditées. Une fois la livraison acceptée, le paiement sera libéré au photographe.",
      cta: "Voir la réservation",
    },
    es: {
      subject: `Pago confirmado — ${priceStr} por su sesión con ${photographerName}`,
      h2: "¡Pago confirmado!",
      greeting: `Hola ${firstName},`,
      body1: `Su pago de <strong>${priceStr}</strong> por la sesión fotográfica con <strong>${photographerName}</strong> ha sido confirmado.`,
      body2: "Su dinero queda guardado de forma segura. Tras la sesión, su fotógrafo le entregará las fotos editadas. Cuando acepte la entrega, el pago se liberará al fotógrafo.",
      cta: "Ver reserva",
    },
    it: {
      subject: `Pagamento confermato — ${priceStr} per la tua sessione con ${photographerName}`,
      h2: "Pagamento confermato!",
      greeting: `Ciao ${firstName},`,
      body1: `Il tuo pagamento di <strong>${priceStr}</strong> per il servizio fotografico con <strong>${photographerName}</strong> è stato confermato.`,
      body2: "Il denaro resta al sicuro. Dopo la sessione il fotografo ti consegnerà le foto ritoccate. Quando accetti la consegna, il pagamento viene sbloccato per il fotografo.",
      cta: "Vedi la prenotazione",
    },
  }, locale);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

export async function sendDeliveryAcceptedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  payoutAmount: number,
  /** Extras still unsold. Acceptance is not the end of the money on this
   *  booking — the gallery lives another 90 days and they can still sell. */
  extrasOnOffer = 0,
  /** How the extras actually went on this booking. Reported here, at
   *  acceptance, rather than pinged one photo at a time while the client is
   *  still choosing. extrasPayout is the photographer's own earnings — the
   *  client's total is never in a photographer's email. */
  breakdown?: { giftOffered: number; giftTaken: number; extrasBought: number; extrasPayout: number },
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);
  const clientFirstName = clientName.split(" ")[0];
  const amount = `&euro;${payoutAmount.toFixed(2)}`;

  const b = breakdown;
  const showBreakdown = !!b && (b.giftOffered > 0 || b.extrasBought > 0);
  const breakdownHtml = showBreakdown
    ? `<div style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#F7F5F1;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1F1F1F;">${pickT({
          en: "How the extras went", pt: "Como correram os extras", de: "Wie es mit den Extras lief",
          es: "Cómo fueron los extras", fr: "Ce qu’il en est des photos en plus",
          it: "Com'è andata con le foto extra",
        }, locale)}</p>
        ${b!.giftOffered > 0 ? `<p style="margin:0 0 4px;font-size:14px;line-height:1.5;color:#4A4A4A;">🎁 ${pickT({
          en: `You offered ${b!.giftOffered} free — ${clientFirstName} took ${b!.giftTaken}.`,
          pt: `Ofereceu ${b!.giftOffered} grátis — ${clientFirstName} levou ${b!.giftTaken}.`,
          de: `Sie haben ${b!.giftOffered} gratis angeboten — ${clientFirstName} hat ${b!.giftTaken} genommen.`,
          es: `Ofreciste ${b!.giftOffered} gratis — ${clientFirstName} cogió ${b!.giftTaken}.`,
          fr: `Vous en avez offert ${b!.giftOffered} — ${clientFirstName} en a pris ${b!.giftTaken}.`,
          it: `Ne hai regalate ${b!.giftOffered} — ${clientFirstName} ne ha prese ${b!.giftTaken}.`,
        }, locale)}</p>` : ""}
        <p style="margin:0;font-size:14px;line-height:1.5;color:#4A4A4A;">🛒 ${b!.extrasBought > 0 ? pickT({
          en: `Bought ${b!.extrasBought} more — <strong style="color:#16A34A;">+&euro;${b!.extrasPayout.toFixed(2)}</strong> to you, included above.`,
          pt: `Comprou mais ${b!.extrasBought} — <strong style="color:#16A34A;">+&euro;${b!.extrasPayout.toFixed(2)}</strong> para si, já incluídos acima.`,
          de: `${b!.extrasBought} weitere gekauft — <strong style="color:#16A34A;">+&euro;${b!.extrasPayout.toFixed(2)}</strong> für Sie, oben bereits enthalten.`,
          es: `Compró ${b!.extrasBought} más — <strong style="color:#16A34A;">+&euro;${b!.extrasPayout.toFixed(2)}</strong> para ti, ya incluidos arriba.`,
          fr: `${b!.extrasBought} de plus achetées — <strong style="color:#16A34A;">+&euro;${b!.extrasPayout.toFixed(2)}</strong> pour vous, déjà comptés ci-dessus.`,
          it: `Ne ha comprate altre ${b!.extrasBought} — <strong style="color:#16A34A;">+&euro;${b!.extrasPayout.toFixed(2)}</strong> per te, già inclusi sopra.`,
        }, locale) : pickT({
          en: "No extras bought this time.", pt: "Nenhum extra comprado desta vez.",
          de: "Diesmal keine Extras gekauft.", es: "Ningún extra comprado esta vez.",
          fr: "Aucune photo en plus achetée cette fois.",
          it: "Nessuna foto extra acquistata questa volta.",
        }, locale)}</p>
      </div>`
    : "";

  const T = pickT({
    en: { subject: `${clientFirstName} accepted delivery — €${payoutAmount.toFixed(2)} transferred to you`, h2: "Payment Transferred!", greeting: `Hi ${photographerName},`, body1: `<strong>${clientFirstName}</strong> has accepted the photo delivery. A payment of <strong style="color:#16A34A;">${amount}</strong> has been transferred to your Stripe account.`, body2: "The funds should arrive in your bank account within 2-7 business days, depending on your Stripe payout schedule.", cta: "View Dashboard", reviewPrompt: "Enjoyed working with this client? Leave a quick review to help build your reputation on the platform:", reviewCta: "Leave a Review" },
    pt: { subject: `${clientFirstName} aceitou a entrega — €${payoutAmount.toFixed(2)} transferidos para si`, h2: "Pagamento Transferido!", greeting: `Olá ${photographerName},`, body1: `<strong>${clientFirstName}</strong> aceitou a entrega das fotografias. Um pagamento de <strong style="color:#16A34A;">${amount}</strong> foi transferido para a sua conta Stripe.`, body2: "Os fundos chegam à sua conta bancária em 2-7 dias úteis, consoante o seu calendário de pagamentos Stripe.", cta: "Ver Dashboard", reviewPrompt: "Gostou de trabalhar com este cliente? Deixe uma avaliação para reforçar a sua reputação na plataforma:", reviewCta: "Deixar Avaliação" },
    de: { subject: `${clientFirstName} hat die Lieferung angenommen — €${payoutAmount.toFixed(2)} an Sie überwiesen`, h2: "Zahlung überwiesen!", greeting: `Hallo ${photographerName},`, body1: `<strong>${clientFirstName}</strong> hat die Fotolieferung angenommen. Eine Zahlung von <strong style="color:#16A34A;">${amount}</strong> wurde auf Ihr Stripe-Konto überwiesen.`, body2: "Die Mittel sollten innerhalb von 2-7 Werktagen auf Ihrem Bankkonto eintreffen, je nach Ihrem Stripe-Auszahlungsplan.", cta: "Dashboard ansehen", reviewPrompt: "Hat Ihnen die Zusammenarbeit gefallen? Hinterlassen Sie eine kurze Bewertung, um Ihre Reputation auf der Plattform zu stärken:", reviewCta: "Bewertung abgeben" },
    es: { subject: `${clientFirstName} aceptó la entrega — €${payoutAmount.toFixed(2)} transferidos a usted`, h2: "¡Pago transferido!", greeting: `Hola ${photographerName},`, body1: `<strong>${clientFirstName}</strong> ha aceptado la entrega de las fotos. Un pago de <strong style="color:#16A34A;">${amount}</strong> ha sido transferido a su cuenta de Stripe.`, body2: "Los fondos deberían llegar a su cuenta bancaria en 2-7 días hábiles, según el calendario de pagos de Stripe.", cta: "Ver dashboard", reviewPrompt: "¿Disfrutó trabajando con este cliente? Deje una breve reseña para reforzar su reputación en la plataforma:", reviewCta: "Dejar reseña" },
    fr: { subject: `${clientFirstName} a accepté la livraison — €${payoutAmount.toFixed(2)} transférés vers vous`, h2: "Paiement transféré !", greeting: `Bonjour ${photographerName},`, body1: `<strong>${clientFirstName}</strong> a accepté la livraison des photos. Un paiement de <strong style="color:#16A34A;">${amount}</strong> a été transféré sur votre compte Stripe.`, body2: "Les fonds devraient arriver sur votre compte bancaire sous 2-7 jours ouvrés, selon votre calendrier de versement Stripe.", cta: "Voir le tableau de bord", reviewPrompt: "Vous avez apprécié travailler avec ce client ? Laissez un court avis pour renforcer votre réputation sur la plateforme :", reviewCta: "Laisser un avis" },
    it: { subject: `${clientFirstName} ha accettato la consegna — €${payoutAmount.toFixed(2)} trasferiti a te`, h2: "Pagamento trasferito!", greeting: `Ciao ${photographerName},`, body1: `<strong>${clientFirstName}</strong> ha accettato la consegna delle foto. Un pagamento di <strong style="color:#16A34A;">${amount}</strong> è stato trasferito sul tuo account Stripe.`, body2: "I fondi dovrebbero arrivare sul tuo conto bancario entro 2-7 giorni lavorativi, secondo il tuo calendario di pagamenti Stripe.", cta: "Vai alla dashboard", reviewPrompt: "Ti sei trovato bene con questo cliente? Lascia una breve recensione per rafforzare la tua reputazione sulla piattaforma:", reviewCta: "Lascia una recensione" },
  }, locale);

  await sendEmail(
    photographerEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${breakdownHtml}
      ${extrasOnOffer > 0 ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">${pickT({
        en: `${extrasOnOffer} extra photo${extrasOnOffer === 1 ? "" : "s"} you held back ${extrasOnOffer === 1 ? "is" : "are"} still on offer in this gallery for another 90 days. You earn your own price on each one sold.`,
        pt: `${extrasOnOffer} fotografia${extrasOnOffer === 1 ? "" : "s"} extra que guardou continua${extrasOnOffer === 1 ? "" : "m"} à venda nesta galeria durante mais 90 dias. Recebe o seu preço por cada uma vendida.`,
        de: `${extrasOnOffer} zurückgehaltene Zusatzfoto${extrasOnOffer === 1 ? "" : "s"} ${extrasOnOffer === 1 ? "bleibt" : "bleiben"} in dieser Galerie noch 90 Tage im Angebot. Pro Verkauf erhalten Sie Ihren eigenen Preis.`,
        es: `${extrasOnOffer} foto${extrasOnOffer === 1 ? "" : "s"} extra que guardaste sigue${extrasOnOffer === 1 ? "" : "n"} a la venta en esta galería durante 90 días más. Ganas tu propio precio por cada una vendida.`,
        fr: `${extrasOnOffer} photo${extrasOnOffer === 1 ? "" : "s"} supplémentaire${extrasOnOffer === 1 ? "" : "s"} que vous avez gardée${extrasOnOffer === 1 ? "" : "s"} reste${extrasOnOffer === 1 ? "" : "nt"} proposée${extrasOnOffer === 1 ? "" : "s"} pendant encore 90 jours. Vous gagnez votre propre prix par vente.`,
        it: `${extrasOnOffer} foto extra che hai tenuto da parte ${extrasOnOffer === 1 ? "resta ancora in vendita" : "restano ancora in vendita"} in questa galleria per altri 90 giorni. Su ogni vendita guadagni il tuo prezzo.`,
      }, locale)}</p>` : ""}
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.cta)}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.reviewPrompt}</p>
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.reviewCta, "#3B82F6")}
    `, locale)
  );
}

export async function sendDeliveryAcceptedToClient(
  clientEmail: string,
  clientName: string,
  photographerNameRaw: string,
  /** Deep link back to the gallery (with ?pw=…&tip=1) — when present the
   *  email includes a soft optional-tip line + button below the download
   *  note. Catches the different-device / next-morning tip moment. */
  tipUrl?: string | null
) {
  /** Anti-disintermediation: a client never sees the surname. */
  const photographerName = maskSurname(photographerNameRaw);
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  const firstName = clientName.split(" ")[0];
  const photogFirst = photographerName.split(" ")[0];
  const TIP = pickT({
    en: { tipIntro: `Loved ${photogFirst}'s work? You can add an optional tip — it goes to ${photogFirst}, minus a small processing fee.`, tipCta: `💛 Leave a tip for ${photogFirst}` },
    pt: { tipIntro: `Adorou o trabalho de ${photogFirst}? Pode deixar uma gorjeta opcional — vai para ${photogFirst}, menos uma pequena taxa de processamento.`, tipCta: `💛 Deixar uma gorjeta para ${photogFirst}` },
    de: { tipIntro: `Hat Ihnen die Arbeit von ${photogFirst} gefallen? Sie können ein optionales Trinkgeld hinterlassen — es geht an ${photogFirst}, abzüglich einer kleinen Bearbeitungsgebühr.`, tipCta: `💛 Trinkgeld für ${photogFirst}` },
    es: { tipIntro: `¿Le encantó el trabajo de ${photogFirst}? Puede dejar una propina opcional — va para ${photogFirst}, menos una pequeña tarifa de procesamiento.`, tipCta: `💛 Dejar una propina para ${photogFirst}` },
    fr: { tipIntro: `Vous avez adoré le travail de ${photogFirst} ? Vous pouvez laisser un pourboire facultatif — il va à ${photogFirst}, moins de petits frais de traitement.`, tipCta: `💛 Laisser un pourboire à ${photogFirst}` },
    it: { tipIntro: `Ti è piaciuto il lavoro di ${photogFirst}? Puoi lasciare una mancia, se vuoi — va a ${photogFirst}, meno una piccola commissione di elaborazione.`, tipCta: `💛 Lascia una mancia a ${photogFirst}` },
  }, locale);
  const tipBlock = tipUrl
    ? `<div style="margin:16px 0;padding:16px;background:#FFFBEB;border-radius:10px;border:1px solid #FDE68A;">
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#4A4A4A;">${TIP.tipIntro}</p>
        ${emailButton(tipUrl, TIP.tipCta, "#D97706")}
      </div>`
    : "";
  const T = pickT({
    en: {
      subject: `Delivery accepted — thank you!`,
      h2: "Thank You!",
      greeting: `Hi ${firstName},`,
      body: `You've accepted the photo delivery from <strong>${photographerName}</strong>. We hope you love your photos!`,
      downloadNote: `Your photos will be available for download for <strong>90 days</strong>. Make sure to download them before then!`,
      reviewIntro: `If you enjoyed your experience, we'd love to hear from you! Reviews help other travelers discover ${country.brand}.`,
      reviewOnLabel: "Leave a review on:",
      googleCta: "⭐ Review us on Google",
      ppCta: `Review ${photographerName} on ${country.brand}`,
    },
    pt: {
      subject: `Entrega aceite — obrigado!`,
      h2: "Obrigado!",
      greeting: `Olá ${firstName},`,
      body: `Aceitou a entrega das fotos de <strong>${photographerName}</strong>. Esperamos que adore as suas fotos!`,
      downloadNote: `As suas fotos ficarão disponíveis para download durante <strong>90 dias</strong>. Não se esqueça de as descarregar antes desse prazo!`,
      reviewIntro: `Se gostou da experiência, adorávamos ouvir a sua opinião! As avaliações ajudam outros viajantes a descobrir a ${country.brand}.`,
      reviewOnLabel: "Deixe uma avaliação em:",
      googleCta: "⭐ Avalie-nos no Google",
      ppCta: `Avaliar ${photographerName} na ${country.brand}`,
    },
    de: {
      subject: `Lieferung angenommen — vielen Dank!`,
      h2: "Vielen Dank!",
      greeting: `Hallo ${firstName},`,
      body: `Sie haben die Fotolieferung von <strong>${photographerName}</strong> angenommen. Wir hoffen, dass Ihnen Ihre Fotos gefallen!`,
      downloadNote: `Ihre Fotos stehen <strong>90 Tage</strong> zum Download bereit. Bitte laden Sie sie vorher herunter!`,
      reviewIntro: `Wenn Ihnen die Erfahrung gefallen hat, würden wir gerne von Ihnen hören! Bewertungen helfen anderen Reisenden, ${country.brand} zu entdecken.`,
      reviewOnLabel: "Bewertung abgeben auf:",
      googleCta: "⭐ Bewerten Sie uns auf Google",
      ppCta: `${photographerName} auf ${country.brand} bewerten`,
    },
    fr: {
      subject: `Livraison acceptée — merci !`,
      h2: "Merci !",
      greeting: `Bonjour ${firstName},`,
      body: `Vous avez accepté la livraison des photos de <strong>${photographerName}</strong>. Nous espérons que vous adorez vos photos !`,
      downloadNote: `Vos photos seront disponibles au téléchargement pendant <strong>90 jours</strong>. Pensez à les télécharger avant cette date !`,
      reviewIntro: `Si vous avez aimé votre expérience, nous serions ravis d'avoir votre retour ! Les avis aident d'autres voyageurs à découvrir ${country.brand}.`,
      reviewOnLabel: "Laissez un avis sur :",
      googleCta: "⭐ Évaluez-nous sur Google",
      ppCta: `Évaluer ${photographerName} sur ${country.brand}`,
    },
    es: {
      subject: `Entrega aceptada — ¡gracias!`,
      h2: "¡Gracias!",
      greeting: `Hola ${firstName},`,
      body: `Ha aceptado la entrega de las fotos de <strong>${photographerName}</strong>. ¡Esperamos que le encanten sus fotos!`,
      downloadNote: `Sus fotos estarán disponibles para descarga durante <strong>90 días</strong>. ¡Asegúrese de descargarlas antes!`,
      reviewIntro: `Si disfrutó la experiencia, ¡nos encantaría conocer su opinión! Las reseñas ayudan a otros viajeros a descubrir ${country.brand}.`,
      reviewOnLabel: "Deje una reseña en:",
      googleCta: "⭐ Reséñenos en Google",
      ppCta: `Reseñar a ${photographerName} en ${country.brand}`,
    },
    it: {
      subject: `Consegna accettata — grazie!`,
      h2: "Grazie!",
      greeting: `Ciao ${firstName},`,
      body: `Hai accettato la consegna delle foto di <strong>${photographerName}</strong>. Speriamo che ti piacciano!`,
      downloadNote: `Le tue foto resteranno scaricabili per <strong>90 giorni</strong>. Ricordati di scaricarle prima!`,
      reviewIntro: `Se ti sei trovato bene, ci farebbe piacere sapere com'è andata! Le recensioni aiutano altri viaggiatori a scoprire ${country.brand}.`,
      reviewOnLabel: "Lascia una recensione su:",
      googleCta: "⭐ Recensiscici su Google",
      ppCta: `Recensisci ${photographerName} su ${country.brand}`,
    },
  }, locale);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.downloadNote}</p>
      </div>
      ${tipBlock}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.reviewIntro}</p>
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#4A4A4A;">${T.reviewOnLabel}</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", T.googleCta, "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.ppCta)}
    `, locale)
  );
}

export async function sendTrustpilotFollowUpToClient(
  clientEmail: string,
  clientName: string,
  photographerNameRaw: string
) {
  /** Anti-disintermediation: a client never sees the surname. */
  const photographerName = maskSurname(photographerNameRaw);
  const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  const firstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `One last thing, ${firstName} — it means a lot to us`,
      h2: "Thank You for Your Review!",
      greeting: `Hi ${firstName},`,
      body1: `We really appreciate you sharing your experience with <strong>${photographerName}</strong> on our platform.`,
      body2: `We have one small favour to ask — it would mean the world to our small business if you could leave a quick review on Google or Trustpilot. It takes less than a minute and helps other travelers discover ${country.brand}:`,
      googleCta: "Review Us on Google",
      trustpilotCta: "Review Us on Trustpilot",
      footer: `Even a few words make a huge difference. Thank you for supporting independent photography in ${country.countryName.en}!`,
    },
    pt: {
      subject: `Mais uma coisa, ${firstName} — significa muito para nós`,
      h2: "Obrigado pela Sua Avaliação!",
      greeting: `Olá ${firstName},`,
      body1: `Agradecemos imenso por partilhar a sua experiência com <strong>${photographerName}</strong> na nossa plataforma.`,
      body2: `Temos um pequeno favor a pedir — significaria o mundo para o nosso pequeno negócio se pudesse deixar uma breve avaliação no Google ou Trustpilot. Demora menos de um minuto e ajuda outros viajantes a descobrir a ${country.brand}:`,
      googleCta: "Avalie-nos no Google",
      trustpilotCta: "Avalie-nos no Trustpilot",
      footer: `Mesmo algumas palavras fazem uma enorme diferença. Obrigado por apoiar a fotografia independente em ${country.countryName.pt}!`,
    },
    de: {
      subject: `Eine letzte Sache, ${firstName} — es bedeutet uns viel`,
      h2: "Vielen Dank für Ihre Bewertung!",
      greeting: `Hallo ${firstName},`,
      body1: `Wir freuen uns sehr, dass Sie Ihre Erfahrung mit <strong>${photographerName}</strong> auf unserer Plattform geteilt haben.`,
      body2: `Wir haben eine kleine Bitte — es würde unserem kleinen Unternehmen sehr viel bedeuten, wenn Sie eine kurze Bewertung auf Google oder Trustpilot hinterlassen könnten. Es dauert weniger als eine Minute und hilft anderen Reisenden, ${country.brand} zu entdecken:`,
      googleCta: "Bewerten Sie uns auf Google",
      trustpilotCta: "Bewerten Sie uns auf Trustpilot",
      footer: `Schon ein paar Worte machen einen riesigen Unterschied. Vielen Dank, dass Sie unabhängige Fotografie in ${country.countryName.de} unterstützen!`,
    },
    fr: {
      subject: `Une dernière chose, ${firstName} — cela compte beaucoup pour nous`,
      h2: "Merci pour votre avis !",
      greeting: `Bonjour ${firstName},`,
      body1: `Nous apprécions vraiment que vous ayez partagé votre expérience avec <strong>${photographerName}</strong> sur notre plateforme.`,
      body2: `Nous avons une petite faveur à demander — cela signifierait énormément pour notre petite entreprise si vous pouviez laisser un court avis sur Google ou Trustpilot. Cela prend moins d'une minute et aide d'autres voyageurs à découvrir ${country.brand} :`,
      googleCta: "Évaluez-nous sur Google",
      trustpilotCta: "Évaluez-nous sur Trustpilot",
      footer: `Même quelques mots font une énorme différence. Merci de soutenir la photographie indépendante au ${country.countryName.fr} !`,
    },
    es: {
      subject: `Una última cosa, ${firstName} — significa mucho para nosotros`,
      h2: "¡Gracias por su reseña!",
      greeting: `Hola ${firstName},`,
      body1: `Apreciamos enormemente que haya compartido su experiencia con <strong>${photographerName}</strong> en nuestra plataforma.`,
      body2: `Tenemos un pequeño favor que pedirle — significaría muchísimo para nuestro pequeño negocio si pudiera dejar una breve reseña en Google o Trustpilot. Lleva menos de un minuto y ayuda a otros viajeros a descubrir ${country.brand}:`,
      googleCta: "Reséñenos en Google",
      trustpilotCta: "Reséñenos en Trustpilot",
      footer: `Incluso unas pocas palabras marcan una gran diferencia. ¡Gracias por apoyar la fotografía independiente en ${country.countryName.es}!`,
    },
    it: {
      subject: `Un'ultima cosa, ${firstName} — per noi conta molto`,
      h2: "Grazie per la tua recensione!",
      greeting: `Ciao ${firstName},`,
      body1: `Ti ringraziamo davvero per aver raccontato la tua esperienza con <strong>${photographerName}</strong> sulla nostra piattaforma.`,
      body2: `Abbiamo un piccolo favore da chiederti: per la nostra piccola impresa significherebbe moltissimo se lasciassi una breve recensione su Google o Trustpilot. Ci vuole meno di un minuto e aiuta altri viaggiatori a scoprire ${country.brand}:`,
      googleCta: "Recensiscici su Google",
      trustpilotCta: "Recensiscici su Trustpilot",
      footer: `Anche poche parole fanno un'enorme differenza. Grazie per sostenere la fotografia indipendente in ${country.countryName.it}!`,
    },
  }, locale);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", T.googleCta, "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton(`https://www.trustpilot.com/evaluate/${country.host}`, T.trustpilotCta, "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">${T.footer}</p>
    `, locale)
  );
}

export async function sendTrustpilotFollowUpToPhotographer(
  photographerEmail: string,
  photographerName: string
) {
  const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);

  const T = pickT({
    en: { subject: `Quick favour, ${photographerName}?`, h2: "Help Us Grow!", greeting: `Hi ${photographerName},`, body1: `Thank you for being part of ${country.brand}. Your work is what makes this platform great.`, body2: "We'd love it if you could share your experience as a photographer on Google or Trustpilot. A genuine review from a professional like you helps build trust and brings more clients to the platform — which means more bookings for everyone:", googleCta: "Review Us on Google", trustpilotCta: "Review Us on Trustpilot", footer: "It takes less than a minute. Thank you for your support!" },
    pt: { subject: `Pequeno favor, ${photographerName}?`, h2: "Ajude-nos a Crescer!", greeting: `Olá ${photographerName},`, body1: `Obrigado por fazer parte da ${country.brand}. O seu trabalho é o que torna esta plataforma especial.`, body2: "Adorávamos que partilhasse a sua experiência como fotógrafo no Google ou Trustpilot. Uma avaliação genuína de um profissional como o(a) ajuda a construir confiança e atrai mais clientes — o que significa mais reservas para todos:", googleCta: "Avalie-nos no Google", trustpilotCta: "Avalie-nos no Trustpilot", footer: "Demora menos de um minuto. Obrigado pelo seu apoio!" },
    de: { subject: `Kleiner Gefallen, ${photographerName}?`, h2: "Helfen Sie uns zu wachsen!", greeting: `Hallo ${photographerName},`, body1: `Vielen Dank, dass Sie Teil von ${country.brand} sind. Ihre Arbeit macht diese Plattform großartig.`, body2: "Wir würden uns sehr freuen, wenn Sie Ihre Erfahrung als Fotograf auf Google oder Trustpilot teilen. Eine ehrliche Bewertung von einem Profi wie Ihnen schafft Vertrauen und bringt mehr Kunden auf die Plattform — was mehr Buchungen für alle bedeutet:", googleCta: "Bewerten Sie uns auf Google", trustpilotCta: "Bewerten Sie uns auf Trustpilot", footer: "Es dauert weniger als eine Minute. Danke für Ihre Unterstützung!" },
    es: { subject: `Un pequeño favor, ${photographerName}`, h2: "¡Ayúdenos a crecer!", greeting: `Hola ${photographerName},`, body1: `Gracias por formar parte de ${country.brand}. Su trabajo es lo que hace que esta plataforma sea genial.`, body2: "Nos encantaría que compartiera su experiencia como fotógrafo en Google o Trustpilot. Una reseña genuina de un profesional como usted genera confianza y atrae más clientes a la plataforma — lo que significa más reservas para todos:", googleCta: "Reséñenos en Google", trustpilotCta: "Reséñenos en Trustpilot", footer: "Lleva menos de un minuto. ¡Gracias por su apoyo!" },
    fr: { subject: `Un petit service, ${photographerName} ?`, h2: "Aidez-nous à grandir !", greeting: `Bonjour ${photographerName},`, body1: `Merci de faire partie de ${country.brand}. Votre travail est ce qui fait la grandeur de cette plateforme.`, body2: "Nous adorerions que vous partagiez votre expérience en tant que photographe sur Google ou Trustpilot. Un avis authentique d'un professionnel comme vous renforce la confiance et attire plus de clients — ce qui signifie plus de réservations pour tout le monde :", googleCta: "Évaluez-nous sur Google", trustpilotCta: "Évaluez-nous sur Trustpilot", footer: "Cela prend moins d'une minute. Merci de votre soutien !" },
    it: { subject: `Un piccolo favore, ${photographerName}?`, h2: "Aiutaci a crescere!", greeting: `Ciao ${photographerName},`, body1: `Grazie per far parte di ${country.brand}. È il tuo lavoro a rendere grande questa piattaforma.`, body2: "Ci farebbe molto piacere se raccontassi la tua esperienza da fotografo su Google o Trustpilot. Una recensione sincera da parte di un professionista come te crea fiducia e porta più clienti sulla piattaforma — cioè più prenotazioni per tutti:", googleCta: "Recensiscici su Google", trustpilotCta: "Recensiscici su Trustpilot", footer: "Ci vuole meno di un minuto. Grazie del supporto!" },
  }, locale);

  await sendEmail(
    photographerEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", T.googleCta, "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton(`https://www.trustpilot.com/evaluate/${country.host}`, T.trustpilotCta, "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">${T.footer}</p>
    `, locale)
  );
}

export async function sendNewMessageNotification(
  recipientEmail: string,
  recipientName: string,
  senderName: string
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(recipientEmail);
  const firstName = recipientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `You have new messages from ${senderName}`,
      h2: "New Messages",
      greeting: `Hi ${firstName},`,
      body: `You have new messages from <strong>${senderName}</strong>.`,
      cta: "Read Messages",
    },
    pt: {
      subject: `Tem novas mensagens de ${senderName}`,
      h2: "Novas Mensagens",
      greeting: `Olá ${firstName},`,
      body: `Tem novas mensagens de <strong>${senderName}</strong>.`,
      cta: "Ler Mensagens",
    },
    de: {
      subject: `Sie haben neue Nachrichten von ${senderName}`,
      h2: "Neue Nachrichten",
      greeting: `Hallo ${firstName},`,
      body: `Sie haben neue Nachrichten von <strong>${senderName}</strong>.`,
      cta: "Nachrichten lesen",
    },
    fr: {
      subject: `Vous avez de nouveaux messages de ${senderName}`,
      h2: "Nouveaux messages",
      greeting: `Bonjour ${firstName},`,
      body: `Vous avez de nouveaux messages de <strong>${senderName}</strong>.`,
      cta: "Lire les messages",
    },
    es: {
      subject: `Tiene nuevos mensajes de ${senderName}`,
      h2: "Nuevos mensajes",
      greeting: `Hola ${firstName},`,
      body: `Tiene nuevos mensajes de <strong>${senderName}</strong>.`,
      cta: "Leer mensajes",
    },
    it: {
      subject: `Hai nuovi messaggi da ${senderName}`,
      h2: "Nuovi messaggi",
      greeting: `Ciao ${firstName},`,
      body: `Hai nuovi messaggi da <strong>${senderName}</strong>.`,
      cta: "Leggi i messaggi",
    },
  }, locale);

  await sendEmail(
    recipientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
      ${emailButton(localizedUrl("/dashboard/messages", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

export async function sendReviewNotification(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  rating: number
) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const clientFirstName = clientName.split(" ")[0];
  await sendEmail(
    photographerEmail,
    `New ${rating}-star review from ${clientFirstName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Review</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${clientFirstName}</strong> left you a review:</p>
      <p style="margin:0 0 12px;font-size:24px;color:#F59E0B;">${stars}</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Review")}
    `)
  );
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(to);
  const firstName = name.split(" ")[0];
  const resetUrl = `${localizedUrl("/auth/reset-password", locale, BASE_URL)}?token=${token}`;
  const T = pickT({
    en: {
      subject: `Reset your ${country.brand} password`,
      h2: "Reset Your Password",
      greeting: `Hi ${firstName},`,
      body: "We received a request to reset your password. Click the button below to set a new one:",
      cta: "Reset Password",
      footer: "This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.",
    },
    pt: {
      subject: `Redefinir a sua palavra-passe da ${country.brand}`,
      h2: "Redefinir a Sua Palavra-passe",
      greeting: `Olá ${firstName},`,
      body: "Recebemos um pedido para redefinir a sua palavra-passe. Clique no botão abaixo para definir uma nova:",
      cta: "Redefinir Palavra-passe",
      footer: "Esta ligação expira em 30 minutos. Se não pediu a redefinição da palavra-passe, pode ignorar este email.",
    },
    de: {
      subject: `Setzen Sie Ihr ${country.brand} Passwort zurück`,
      h2: "Passwort zurücksetzen",
      greeting: `Hallo ${firstName},`,
      body: "Wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf die Schaltfläche unten, um ein neues festzulegen:",
      cta: "Passwort zurücksetzen",
      footer: "Dieser Link läuft in 30 Minuten ab. Wenn Sie kein Zurücksetzen des Passworts angefordert haben, können Sie diese E-Mail ignorieren.",
    },
    fr: {
      subject: `Réinitialisez votre mot de passe ${country.brand}`,
      h2: "Réinitialisez votre mot de passe",
      greeting: `Bonjour ${firstName},`,
      body: "Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau :",
      cta: "Réinitialiser le mot de passe",
      footer: "Ce lien expire dans 30 minutes. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail.",
    },
    es: {
      subject: `Restablezca su contraseña de ${country.brand}`,
      h2: "Restablezca su contraseña",
      greeting: `Hola ${firstName},`,
      body: "Hemos recibido una solicitud para restablecer su contraseña. Haga clic en el botón de abajo para crear una nueva:",
      cta: "Restablecer contraseña",
      footer: "Este enlace caduca en 30 minutos. Si no solicitó el restablecimiento, puede ignorar este correo.",
    },
    it: {
      subject: `Reimposta la tua password ${country.brand}`,
      h2: "Reimposta la tua password",
      greeting: `Ciao ${firstName},`,
      body: "Abbiamo ricevuto una richiesta di reimpostazione della password. Clicca sul pulsante qui sotto per sceglierne una nuova:",
      cta: "Reimposta la password",
      footer: "Questo link scade tra 30 minuti. Se non hai richiesto la reimpostazione, puoi ignorare questa email.",
    },
  }, locale);

  await sendEmail(
    to,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
      ${emailButton(resetUrl, T.cta)}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">${T.footer}</p>
    `, locale)
  );
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(to);
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  const firstName = name.split(" ")[0];
  const T = pickT({
    en: {
      subject: `Verify your email — ${country.brand}`,
      h2: "Verify Your Email",
      greeting: `Hi ${firstName},`,
      body: "Thank you for signing up! Please verify your email address to activate your account:",
      cta: "Verify Email Address",
      footer: "This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.",
    },
    pt: {
      subject: `Verifique o seu email — ${country.brand}`,
      h2: "Verifique o Seu Email",
      greeting: `Olá ${firstName},`,
      body: "Obrigado por se registar! Por favor, verifique o seu endereço de email para activar a sua conta:",
      cta: "Verificar Endereço de Email",
      footer: "Esta ligação expira em 24 horas. Se não criou uma conta, pode ignorar este email.",
    },
    de: {
      subject: `Bestätigen Sie Ihre E-Mail — ${country.brand}`,
      h2: "Bestätigen Sie Ihre E-Mail",
      greeting: `Hallo ${firstName},`,
      body: "Vielen Dank für Ihre Anmeldung! Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren:",
      cta: "E-Mail-Adresse bestätigen",
      footer: "Dieser Link läuft in 24 Stunden ab. Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.",
    },
    fr: {
      subject: `Vérifiez votre e-mail — ${country.brand}`,
      h2: "Vérifiez votre e-mail",
      greeting: `Bonjour ${firstName},`,
      body: "Merci de votre inscription ! Veuillez vérifier votre adresse e-mail pour activer votre compte :",
      cta: "Vérifier l'adresse e-mail",
      footer: "Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
    },
    es: {
      subject: `Verifique su correo — ${country.brand}`,
      h2: "Verifique su correo",
      greeting: `Hola ${firstName},`,
      body: "¡Gracias por registrarse! Verifique su dirección de correo para activar su cuenta:",
      cta: "Verificar dirección de correo",
      footer: "Este enlace caduca en 24 horas. Si no creó una cuenta, puede ignorar este correo.",
    },
    it: {
      subject: `Verifica la tua email — ${country.brand}`,
      h2: "Verifica la tua email",
      greeting: `Ciao ${firstName},`,
      body: "Grazie per esserti registrato! Verifica il tuo indirizzo email per attivare l'account:",
      cta: "Verifica l'indirizzo email",
      footer: "Questo link scade tra 24 ore. Se non hai creato un account, puoi ignorare questa email.",
    },
  }, locale);

  await sendEmail(
    to,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
      ${emailButton(verifyUrl, T.cta)}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">${T.footer}</p>
    `, locale)
  );
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  role: "client" | "photographer"
) {
  const isPhotographer = role === "photographer";

  if (isPhotographer) {
    await sendEmail(
      to,
      `Welcome to ${country.brand} — Let's get you started!`,
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Welcome to ${country.brand}!</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for joining ${country.brand}! We're excited to have you on the platform. Here's how to get your profile live and start receiving bookings:</p>

        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <p style="margin:0 0 12px;font-weight:bold;color:#1F1F1F;">Your setup checklist:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#9B8E82;">1.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Complete your profile</strong> — Add a photo, bio, and tagline</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">2.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Upload a cover image</strong> — This appears on your card</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">3.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Add portfolio photos</strong> — At least 5, we recommend 10+</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">4.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Create packages</strong> — Set up 2-3 at different price points</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">5.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Select your locations</strong> — Where you're available to shoot</td></tr>
            <tr><td style="padding:6px 0;color:#9B8E82;">6.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>Connect Stripe</strong> — Required to receive payments</td></tr>
          </table>
        </div>

        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Once your profile is complete and approved by our team, you'll appear in search results and can start receiving bookings.</p>

        <div style="margin:16px 0;padding:16px;background:#FEF2F2;border-radius:10px;border:1px solid #FECACA;">
          <p style="margin:0 0 10px;font-weight:bold;color:#991B1B;">Important rules:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#7F1D1D;">
            <tr><td style="padding:4px 0;vertical-align:top;">1.</td><td style="padding:4px 8px;"><strong>Complete your profile within 7 days</strong> — accounts that remain incomplete will be automatically deactivated</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;">2.</td><td style="padding:4px 8px;"><strong>Never work with clients off-platform</strong> — soliciting clients outside ${country.brand} or accepting direct payments results in a permanent ban</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;">3.</td><td style="padding:4px 8px;"><strong>Respond to booking requests within 24 hours</strong> — clients expect fast communication</td></tr>
          </table>
        </div>

        ${emailButton(`${BASE_URL}/dashboard/profile`, "Complete Your Profile")}

        <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">
          <strong>Helpful links:</strong><br>
          <a href="${BASE_URL}/support" style="color:#C94536;">Help Center</a> — answers to common questions<br>
          <a href="${BASE_URL}/for-photographers/pricing" style="color:#C94536;">Pricing &amp; Plans</a> — commission rates and features<br>
          <a href="${BASE_URL}/contact" style="color:#C94536;">Contact Us</a> — we're here to help
        </p>
      `)
    );
  } else {
    const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
    const locale = await getUserLocaleByEmail(to);
    const firstName = name.split(" ")[0];
    const T = pickT({
      en: {
        subject: `Welcome to ${country.brand}!`,
        h2: `Welcome to ${country.brand}!`,
        greeting: `Hi ${firstName},`,
        intro: `You're all set! Here's how to book your perfect photoshoot in ${country.areaServed}:`,
        s1Title: "Browse photographers",
        s1Body: `Find your style in ${TOP_CITIES}, and more`,
        s2Title: "Pick a package",
        s2Body: "Choose the session length and number of photos",
        s3Title: "Book &amp; pay securely",
        s3Body: "Your payment is held in escrow until you approve the photos",
        cta: "Browse Photographers",
        footerHtml: `Questions? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visit our Help Center</a> or <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contact us</a>.`,
      },
      pt: {
        subject: `Bem-vindo à ${country.brand}!`,
        h2: `Bem-vindo à ${country.brand}!`,
        greeting: `Olá ${firstName},`,
        intro: `Está tudo pronto! Veja como reservar a sua sessão fotográfica perfeita em ${country.areaServed}:`,
        s1Title: "Explore os fotógrafos",
        s1Body: `Encontre o seu estilo em ${TOP_CITIES} e mais`,
        s2Title: "Escolha um pacote",
        s2Body: "Escolha a duração da sessão e o número de fotos",
        s3Title: "Reserve e pague em segurança",
        s3Body: "O seu pagamento fica em garantia até aprovar as fotos",
        cta: "Explorar Fotógrafos",
        footerHtml: `Dúvidas? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visite o nosso Centro de Ajuda</a> ou <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contacte-nos</a>.`,
      },
      de: {
        subject: `Willkommen bei ${country.brand}!`,
        h2: `Willkommen bei ${country.brand}!`,
        greeting: `Hallo ${firstName},`,
        intro: `Alles bereit! So buchen Sie Ihr perfektes Fotoshooting in ${country.areaServed}:`,
        s1Title: "Fotografen entdecken",
        s1Body: `Finden Sie Ihren Stil in ${TOP_CITIES} und mehr`,
        s2Title: "Paket auswählen",
        s2Body: "Wählen Sie Dauer und Anzahl der Fotos",
        s3Title: "Sicher buchen und bezahlen",
        s3Body: "Ihre Zahlung wird treuhänderisch verwahrt, bis Sie die Fotos freigeben",
        cta: "Fotografen entdecken",
        footerHtml: `Fragen? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Besuchen Sie unser Hilfecenter</a> oder <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">kontaktieren Sie uns</a>.`,
      },
      fr: {
        subject: `Bienvenue sur ${country.brand} !`,
        h2: `Bienvenue sur ${country.brand} !`,
        greeting: `Bonjour ${firstName},`,
        intro: `Tout est prêt ! Voici comment réserver votre séance photo idéale en ${country.areaServed} :`,
        s1Title: "Parcourir les photographes",
        s1Body: `Trouvez votre style à ${TOP_CITIES} et plus`,
        s2Title: "Choisir un forfait",
        s2Body: "Sélectionnez la durée de la séance et le nombre de photos",
        s3Title: "Réserver et payer en sécurité",
        s3Body: "Votre paiement est conservé sous séquestre jusqu'à validation des photos",
        cta: "Parcourir les photographes",
        footerHtml: `Des questions ? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visitez notre Centre d'aide</a> ou <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contactez-nous</a>.`,
      },
      es: {
        subject: `¡Bienvenido a ${country.brand}!`,
        h2: `¡Bienvenido a ${country.brand}!`,
        greeting: `Hola ${firstName},`,
        intro: `¡Todo listo! Así puede reservar su sesión fotográfica ideal en ${country.areaServed}:`,
        s1Title: "Explorar fotógrafos",
        s1Body: `Encuentre su estilo en ${TOP_CITIES} y más`,
        s2Title: "Elegir un paquete",
        s2Body: "Seleccione la duración de la sesión y el número de fotos",
        s3Title: "Reservar y pagar de forma segura",
        s3Body: "Su pago queda en custodia hasta que apruebe las fotos",
        cta: "Explorar fotógrafos",
        footerHtml: `¿Preguntas? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visite nuestro Centro de ayuda</a> o <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contáctenos</a>.`,
      },
      it: {
        subject: `Benvenuto su ${country.brand}!`,
        h2: `Benvenuto su ${country.brand}!`,
        greeting: `Ciao ${firstName},`,
        intro: `È tutto pronto! Ecco come prenotare il tuo servizio fotografico perfetto in ${country.areaServed}:`,
        s1Title: "Sfoglia i fotografi",
        s1Body: `Trova il tuo stile a ${TOP_CITIES} e altrove`,
        s2Title: "Scegli un pacchetto",
        s2Body: "Scegli la durata della sessione e il numero di foto",
        s3Title: "Prenota e paga in sicurezza",
        s3Body: "Il pagamento resta vincolato finché non approvi le foto",
        cta: "Sfoglia i fotografi",
        footerHtml: `Domande? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visita il nostro Centro assistenza</a> oppure <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">scrivici</a>.`,
      },
    }, locale);

    await sendEmail(
      to,
      T.subject,
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.intro}</p>

        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#C94536;font-weight:bold;vertical-align:top;">1.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>${T.s1Title}</strong> — ${T.s1Body}</td></tr>
            <tr><td style="padding:6px 0;color:#C94536;font-weight:bold;vertical-align:top;">2.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>${T.s2Title}</strong> — ${T.s2Body}</td></tr>
            <tr><td style="padding:6px 0;color:#C94536;font-weight:bold;vertical-align:top;">3.</td><td style="padding:6px 8px;font-size:15px;color:#4A4A4A;"><strong>${T.s3Title}</strong> — ${T.s3Body}</td></tr>
          </table>
        </div>

        ${emailButton(localizedUrl("/photographers", locale, BASE_URL), T.cta)}

        <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">
          ${T.footerHtml}
        </p>
      `, locale)
    );
  }
}

export async function sendSubscriptionEmail(
  email: string, name: string, plan: string, action: "upgraded" | "downgraded" | "cancelled"
) {
  const subjects: Record<string, string> = {
    upgraded: `Welcome to ${country.brand} ${plan}!`,
    downgraded: `Your plan has been changed to ${plan}`,
    cancelled: "Your subscription has been cancelled",
  };
  const messages: Record<string, string> = {
    upgraded: `You've been upgraded to the <strong>${plan}</strong> plan. Enjoy lower commission rates and more features!`,
    downgraded: `Your plan has been changed to <strong>${plan}</strong>. Your features have been updated accordingly.`,
    cancelled: `Your subscription has been cancelled. You've been moved to the <strong>Free</strong> plan. You can upgrade again anytime.`,
  };
  await sendEmail(email, subjects[action],
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Plan ${action === "cancelled" ? "Cancelled" : "Updated"}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${messages[action]}</p>
      ${emailButton(`${BASE_URL}/dashboard/subscriptions`, "View Subscription")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">Invoices are available in your Stripe billing portal.</p>
    `)
  );
}

// === Admin notification emails ===

// Send to all admin emails (Telegram is handled separately per notification for better formatting)
async function sendToAllAdmins(subject: string, html: string, options?: { replyTo?: string }) {
  const adminEmail = await getAdminEmail();
  const emails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
  await Promise.allSettled(emails.map((email) => sendEmail(email, subject, html, options)));
}

/**
 * A client accepted their delivery AND gave permission to use a few of the
 * photos on the platform's own social accounts.
 *
 * Separate from the ordinary acceptance notice on purpose: this is the one an
 * admin has to act on while the gallery is still live, and it carries the
 * archive link so nobody has to go hunting for the password. The link contains
 * the gallery password, which is why this mail goes only to the admin
 * addresses in platform_settings.
 */
export async function sendAdminSocialConsentNotification(args: {
  clientName: string;
  clientEmail: string;
  photographerName: string;
  bookingId: string;
  photoCount: number;
  archiveUrl: string;
  galleryUrl: string;
}) {
  await sendToAllAdmins(
    `[Photos OK to use] ${args.clientName} accepted delivery and said yes`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Permission granted</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#444;">
        <strong>${args.clientName}</strong> (${args.clientEmail}) accepted the delivery from
        <strong>${args.photographerName}</strong> and ticked the box allowing a few photos
        from this shoot to be used on our social accounts.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#444;">${args.photoCount} photos in the gallery.</p>
      <p style="margin:0 0 12px;">
        <a href="${args.archiveUrl}" style="display:inline-block;background:#C94536;color:#fff;padding:12px 22px;border-radius:10px;font-weight:600;text-decoration:none;">Download the archive</a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;"><a href="${args.galleryUrl}" style="color:#C94536;">Open the gallery</a></p>
      <p style="margin:16px 0 0;font-size:13px;color:#888;">Booking ${args.bookingId}</p>
    `),
  );
}

export async function sendAdminNewPhotographerNotification(
  photographerName: string,
  photographerEmail: string
) {
  await sendToAllAdmins(
    `[New Photographer] ${photographerName} has joined`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Photographer Registration</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">A new photographer has registered and is setting up their profile:</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Name:</strong> ${photographerName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Email:</strong> ${photographerEmail}</p>
      </div>
      ${emailButton(`${BASE_URL}/admin`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminNewClientNotification(
  clientName: string,
  clientEmail: string
) {
  await sendToAllAdmins(
    `[New Client] ${clientName} has signed up`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Client Registration</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">A new client has signed up:</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Name:</strong> ${clientName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Email:</strong> ${clientEmail}</p>
      </div>
      ${emailButton(`${BASE_URL}/admin#clients`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminNewBookingNotification(
  clientName: string,
  photographerName: string,
  packageName: string | null,
  shootDate: string | null,
  // Optional so the ~120 existing three-arg call sites stay untouched; pass
  // the client's address and Reply goes to them instead of our own From.
  options?: { replyTo?: string }
) {
  shootDate = formatShootDate(shootDate, "en");
  await sendToAllAdmins(
      `[New Booking] ${clientName} \u2192 ${photographerName}`,
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Booking Created</h2>
        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
          <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
          ${packageName ? `<p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Package:</strong> ${packageName}</p>` : ""}
          ${shootDate ? `<p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Date:</strong> ${shootDate}</p>` : ""}
        </div>
        ${emailButton(`${BASE_URL}/admin`, "Go to Admin Panel")}
      `),
      options
    );
}

export async function sendPaymentReminderToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  paymentUrl: string | null,
  totalPrice: number | null
) {
  const { getUserLocaleByEmail, pickT, formatPrice } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  const firstName = clientName.split(" ")[0];
  const photographerDisplay = maskSurname(photographerName);
  const priceStr = totalPrice ? formatPrice(Number(totalPrice), locale) : "";
  const T = pickT({
    en: {
      subject: `~18h left to pay — your slot with ${photographerDisplay} is held`,
      h2: "Your slot is held — pay to secure it",
      greeting: `Hi ${firstName},`,
      body1: `<strong>${photographerDisplay}</strong> is holding your photoshoot slot, but we haven't received payment yet.`,
      body2: `Payment guarantees your slot. If we don't receive it within the next ~18 hours, your booking will be automatically cancelled and the slot released to other clients.`,
      body3: `Slot still held — pay to lock it in before another client does. The calendar only blocks the date once your payment clears.`,
      payNow: `Pay Now — ${priceStr}`,
      viewBooking: "View Booking",
    },
    pt: {
      subject: `Restam ~18h para pagar — o seu horário com ${photographerDisplay} está reservado`,
      h2: "O seu horário está reservado — pague para garantir",
      greeting: `Olá ${firstName},`,
      body1: `<strong>${photographerDisplay}</strong> está a reservar o seu horário, mas ainda não recebemos o pagamento.`,
      body2: `O pagamento garante o seu horário. Se não o recebermos nas próximas ~18 horas, a sua reserva será automaticamente cancelada e o horário libertado para outros clientes.`,
      body3: `O horário ainda está reservado — pague para o garantir antes que outro cliente o faça. A data só fica bloqueada no calendário depois do pagamento confirmado.`,
      payNow: `Pagar agora — ${priceStr}`,
      viewBooking: "Ver reserva",
    },
    de: {
      subject: `Noch ~18h zum Bezahlen — Ihr Termin mit ${photographerDisplay} ist reserviert`,
      h2: "Ihr Termin ist reserviert — bezahlen Sie, um ihn zu sichern",
      greeting: `Hallo ${firstName},`,
      body1: `<strong>${photographerDisplay}</strong> hält Ihren Termin frei, aber wir haben die Zahlung noch nicht erhalten.`,
      body2: `Die Zahlung sichert Ihren Termin. Wenn wir sie nicht innerhalb der nächsten ~18 Stunden erhalten, wird Ihre Buchung automatisch storniert und der Termin für andere Kunden freigegeben.`,
      body3: `Der Termin ist weiterhin reserviert — bezahlen Sie jetzt, bevor ein anderer Kunde dies tut. Das Datum wird erst nach Zahlungseingang im Kalender gesperrt.`,
      payNow: `Jetzt bezahlen — ${priceStr}`,
      viewBooking: "Buchung anzeigen",
    },
    es: {
      subject: `Quedan ~18h para pagar — su sesión con ${photographerDisplay} está reservada`,
      h2: "Su horario está reservado — pague para asegurarlo",
      greeting: `Hola ${firstName},`,
      body1: `<strong>${photographerDisplay}</strong> está reservando su horario, pero aún no hemos recibido el pago.`,
      body2: `El pago garantiza su horario. Si no lo recibimos en las próximas ~18 horas, su reserva se cancelará automáticamente y el horario quedará disponible para otros clientes.`,
      body3: `La plaza sigue reservada — pague para asegurarla antes de que otro cliente lo haga. La fecha solo se bloquea en el calendario cuando se confirma el pago.`,
      payNow: `Pagar ahora — ${priceStr}`,
      viewBooking: "Ver reserva",
    },
    fr: {
      subject: `~18h restantes pour payer — votre créneau avec ${photographerDisplay} est réservé`,
      h2: "Votre créneau est réservé — payez pour le sécuriser",
      greeting: `Bonjour ${firstName},`,
      body1: `<strong>${photographerDisplay}</strong> réserve votre créneau, mais nous n'avons pas encore reçu le paiement.`,
      body2: `Le paiement garantit votre créneau. Si nous ne le recevons pas dans les ~18 prochaines heures, votre réservation sera automatiquement annulée et le créneau libéré pour d'autres clients.`,
      body3: `Le créneau est toujours réservé — payez pour le verrouiller avant qu'un autre client ne le fasse. La date n'est bloquée dans l'agenda qu'une fois le paiement confirmé.`,
      payNow: `Payer maintenant — ${priceStr}`,
      viewBooking: "Voir la réservation",
    },
    it: {
      subject: `Restano ~18h per pagare — il tuo orario con ${photographerDisplay} è tenuto`,
      h2: "Il tuo orario è tenuto — paga per bloccarlo",
      greeting: `Ciao ${firstName},`,
      body1: `<strong>${photographerDisplay}</strong> sta tenendo il tuo orario, ma non abbiamo ancora ricevuto il pagamento.`,
      body2: `Il pagamento garantisce il tuo orario. Se non lo riceviamo entro le prossime ~18 ore, la prenotazione verrà annullata automaticamente e l'orario tornerà disponibile per altri clienti.`,
      body3: `L'orario è ancora tenuto — paga per bloccarlo prima che lo faccia un altro cliente. La data si blocca in calendario solo a pagamento confermato.`,
      payNow: `Paga ora — ${priceStr}`,
      viewBooking: "Vedi la prenotazione",
    },
  }, locale);

  const ctaSection = paymentUrl && totalPrice
    ? emailButton(paymentUrl, T.payNow, "#16A34A")
    : emailButton(`${BASE_URL}/dashboard/bookings`, T.viewBooking);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#B45309;font-weight:600;">⏳ ${T.body3}</p>
      ${ctaSection}
    `, locale)
  );
}

export async function sendShootReminderToClient(
  clientEmail: string,
  clientName: string,
  photographerNameRaw: string,
  shootDate: string
) {
  /** Anti-disintermediation: a client never sees the surname. */
  const photographerName = maskSurname(photographerNameRaw);
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  shootDate = formatShootDate(shootDate, locale) || shootDate;
  const firstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `Tomorrow: Your photoshoot with ${photographerName}!`,
      h2: "Your photoshoot is tomorrow!",
      greeting: `Hi ${firstName},`,
      body1: `Just a reminder that your photoshoot with <strong>${photographerName}</strong> is scheduled for <strong>${shootDate}</strong>.`,
      body2: "Make sure to confirm the meeting point and any last-minute details with your photographer.",
      cta: "Open Messages",
    },
    pt: {
      subject: `Amanhã: a sua sessão com ${photographerName}!`,
      h2: "A sua sessão fotográfica é amanhã!",
      greeting: `Olá ${firstName},`,
      body1: `Apenas um lembrete de que a sua sessão com <strong>${photographerName}</strong> está marcada para <strong>${shootDate}</strong>.`,
      body2: "Confirme o ponto de encontro e os últimos detalhes com o seu fotógrafo.",
      cta: "Abrir mensagens",
    },
    de: {
      subject: `Morgen: Ihr Fotoshooting mit ${photographerName}!`,
      h2: "Ihr Fotoshooting ist morgen!",
      greeting: `Hallo ${firstName},`,
      body1: `Nur eine Erinnerung, dass Ihr Fotoshooting mit <strong>${photographerName}</strong> für den <strong>${shootDate}</strong> geplant ist.`,
      body2: "Bestätigen Sie den Treffpunkt und letzte Details mit Ihrem Fotografen.",
      cta: "Nachrichten öffnen",
    },
    es: {
      subject: `Mañana: ¡su sesión con ${photographerName}!`,
      h2: "¡Su sesión es mañana!",
      greeting: `Hola ${firstName},`,
      body1: `Solo un recordatorio de que su sesión con <strong>${photographerName}</strong> está programada para el <strong>${shootDate}</strong>.`,
      body2: "Confirme el punto de encuentro y los últimos detalles con su fotógrafo.",
      cta: "Abrir mensajes",
    },
    fr: {
      subject: `Demain : votre séance avec ${photographerName} !`,
      h2: "Votre séance photo est demain !",
      greeting: `Bonjour ${firstName},`,
      body1: `Petit rappel : votre séance avec <strong>${photographerName}</strong> est prévue pour le <strong>${shootDate}</strong>.`,
      body2: "Confirmez le point de rendez-vous et les derniers détails avec votre photographe.",
      cta: "Ouvrir les messages",
    },
    it: {
      subject: `Domani: la tua sessione con ${photographerName}!`,
      h2: "Il tuo servizio fotografico è domani!",
      greeting: `Ciao ${firstName},`,
      body1: `Un promemoria: la tua sessione con <strong>${photographerName}</strong> è fissata per <strong>${shootDate}</strong>.`,
      body2: "Conferma il punto d'incontro e gli ultimi dettagli con il tuo fotografo.",
      cta: "Apri i messaggi",
    },
  }, locale);

  await sendEmail(
    clientEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${emailButton(localizedUrl("/dashboard/messages", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

export async function sendShootReminderToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  shootDate: string
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);
  shootDate = formatShootDate(shootDate, locale) || shootDate;
  const clientFirstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `Tomorrow: Photoshoot with ${clientFirstName}`,
      h2: "Photoshoot Tomorrow!",
      greeting: `Hi ${photographerName},`,
      body1: `Reminder: you have a photoshoot with <strong>${clientFirstName}</strong> scheduled for <strong>${shootDate}</strong>.`,
      body2: "Make sure to confirm the meeting point and any details with your client.",
      cta: "Open Messages",
    },
    pt: {
      subject: `Amanhã: sessão com ${clientFirstName}`,
      h2: "Sessão fotográfica amanhã!",
      greeting: `Olá ${photographerName},`,
      body1: `Lembrete: tem uma sessão com <strong>${clientFirstName}</strong> marcada para <strong>${shootDate}</strong>.`,
      body2: "Confirme o ponto de encontro e os detalhes com o seu cliente.",
      cta: "Abrir mensagens",
    },
    de: {
      subject: `Morgen: Fotoshooting mit ${clientFirstName}`,
      h2: "Fotoshooting morgen!",
      greeting: `Hallo ${photographerName},`,
      body1: `Erinnerung: Sie haben ein Fotoshooting mit <strong>${clientFirstName}</strong> am <strong>${shootDate}</strong>.`,
      body2: "Bestätigen Sie den Treffpunkt und alle Details mit Ihrem Kunden.",
      cta: "Nachrichten öffnen",
    },
    es: {
      subject: `Mañana: sesión con ${clientFirstName}`,
      h2: "¡Sesión mañana!",
      greeting: `Hola ${photographerName},`,
      body1: `Recordatorio: tiene una sesión con <strong>${clientFirstName}</strong> programada para el <strong>${shootDate}</strong>.`,
      body2: "Confirme el punto de encuentro y los detalles con su cliente.",
      cta: "Abrir mensajes",
    },
    fr: {
      subject: `Demain : séance avec ${clientFirstName}`,
      h2: "Séance photo demain !",
      greeting: `Bonjour ${photographerName},`,
      body1: `Rappel : vous avez une séance avec <strong>${clientFirstName}</strong> prévue le <strong>${shootDate}</strong>.`,
      body2: "Confirmez le point de rendez-vous et les détails avec votre client.",
      cta: "Ouvrir les messages",
    },
    it: {
      subject: `Domani: servizio con ${clientFirstName}`,
      h2: "Servizio fotografico domani!",
      greeting: `Ciao ${photographerName},`,
      body1: `Promemoria: hai un servizio con <strong>${clientFirstName}</strong> fissato per <strong>${shootDate}</strong>.`,
      body2: "Conferma il punto d'incontro e i dettagli con il cliente.",
      cta: "Apri i messaggi",
    },
  }, locale);

  await sendEmail(
    photographerEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${emailButton(localizedUrl("/dashboard/messages", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

export async function sendDeliveryReminderToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);
  const clientFirstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `Reminder: ${clientFirstName} is waiting for their photos`,
      h2: "Delivery Reminder",
      greeting: `Hi ${photographerName},`,
      body1: `Your client <strong>${clientFirstName}</strong> is waiting for their photos. The expected delivery time has passed.`,
      body2: "Please upload and deliver the photos as soon as possible.",
      cta: "Go to Bookings",
    },
    pt: {
      subject: `Lembrete: ${clientFirstName} está à espera das fotos`,
      h2: "Lembrete de entrega",
      greeting: `Olá ${photographerName},`,
      body1: `O seu cliente <strong>${clientFirstName}</strong> está à espera das fotos. O prazo de entrega previsto já passou.`,
      body2: "Por favor faça o upload e entregue as fotos o quanto antes.",
      cta: "Ver reservas",
    },
    de: {
      subject: `Erinnerung: ${clientFirstName} wartet auf die Fotos`,
      h2: "Lieferungs-Erinnerung",
      greeting: `Hallo ${photographerName},`,
      body1: `Ihr Kunde <strong>${clientFirstName}</strong> wartet auf die Fotos. Die erwartete Lieferzeit ist abgelaufen.`,
      body2: "Bitte laden Sie die Fotos hoch und liefern Sie sie so bald wie möglich.",
      cta: "Zu den Buchungen",
    },
    es: {
      subject: `Recordatorio: ${clientFirstName} está esperando las fotos`,
      h2: "Recordatorio de entrega",
      greeting: `Hola ${photographerName},`,
      body1: `Su cliente <strong>${clientFirstName}</strong> está esperando las fotos. El plazo de entrega previsto ha pasado.`,
      body2: "Por favor suba y entregue las fotos lo antes posible.",
      cta: "Ir a reservas",
    },
    fr: {
      subject: `Rappel : ${clientFirstName} attend ses photos`,
      h2: "Rappel de livraison",
      greeting: `Bonjour ${photographerName},`,
      body1: `Votre client <strong>${clientFirstName}</strong> attend ses photos. Le délai de livraison prévu est dépassé.`,
      body2: "Veuillez téléverser et livrer les photos dès que possible.",
      cta: "Voir les réservations",
    },
    it: {
      subject: `Promemoria: ${clientFirstName} sta aspettando le foto`,
      h2: "Promemoria di consegna",
      greeting: `Ciao ${photographerName},`,
      body1: `Il tuo cliente <strong>${clientFirstName}</strong> sta aspettando le foto. Il termine di consegna previsto è passato.`,
      body2: "Carica e consegna le foto il prima possibile.",
      cta: "Vai alle prenotazioni",
    },
  }, locale);

  await sendEmail(
    photographerEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body2}</p>
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.cta)}
    `, locale)
  );
}

// === Render-only versions (for notification queue) ===

export function renderPaymentReminderToClient(
  clientName: string, photographerName: string, paymentUrl: string | null, totalPrice: number | null
): { subject: string; html: string } {
  const photographerDisplay = maskSurname(photographerName);
  const ctaSection = paymentUrl && totalPrice
    ? emailButton(paymentUrl, `Pay Now — €${totalPrice}`, "#16A34A")
    : emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking");
  return {
    subject: `Reminder: Complete your payment for the session with ${photographerDisplay}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Reminder</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your booking with <strong>${photographerDisplay}</strong> has been confirmed, but we haven't received your payment yet.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please complete your payment to secure your photoshoot session.</p>
      ${ctaSection}
    `),
  };
}

export function renderShootReminderToClient(
  clientName: string, photographerName: string, shootDate: string
): { subject: string; html: string } {
  shootDate = formatShootDate(shootDate, "en") || shootDate;
  return {
    subject: `Tomorrow: Your photoshoot with ${photographerName}!`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Your Photoshoot is Tomorrow!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Just a reminder that your photoshoot with <strong>${photographerName}</strong> is scheduled for <strong>${shootDate}</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Make sure to confirm the meeting point and any last-minute details with your photographer.</p>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Open Messages")}
    `),
  };
}

export function renderShootReminderToPhotographer(
  photographerName: string, clientName: string, shootDate: string
): { subject: string; html: string } {
  shootDate = formatShootDate(shootDate, "en") || shootDate;
  const clientFirstName = clientName.split(" ")[0];
  return {
    subject: `Tomorrow: Photoshoot with ${clientFirstName}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Photoshoot Tomorrow!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Reminder: you have a photoshoot with <strong>${clientFirstName}</strong> scheduled for <strong>${shootDate}</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Make sure to confirm the meeting point and any details with your client.</p>
      ${emailButton(`${BASE_URL}/dashboard/messages`, "Open Messages")}
    `),
  };
}

export function renderDeliveryReminderToPhotographer(
  photographerName: string, clientName: string
): { subject: string; html: string } {
  const clientFirstName = clientName.split(" ")[0];
  return {
    subject: `Reminder: ${clientFirstName} is waiting for their photos`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Delivery Reminder</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your client <strong>${clientFirstName}</strong> is waiting for their photos. The expected delivery time has passed.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please upload and deliver the photos as soon as possible.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "Go to Bookings")}
    `),
  };
}

export function renderTrustpilotFollowUpToClient(
  clientName: string, photographerName: string
): { subject: string; html: string } {
  return {
    subject: `One last thing, ${clientName.split(" ")[0]} — it means a lot to us`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Thank You for Your Review!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We really appreciate you sharing your experience with <strong>${photographerName}</strong> on our platform.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We have one small favour to ask — it would mean the world to our small business if you could leave a quick review on Google or Trustpilot. It takes less than a minute and helps other travelers discover ${country.brand}:</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", "Review Us on Google", "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton(`https://www.trustpilot.com/evaluate/${country.host}`, "Review Us on Trustpilot", "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">Even a few words make a huge difference. Thank you for supporting independent photography in Portugal!</p>
    `),
  };
}

export function renderTrustpilotFollowUpToPhotographer(
  photographerName: string
): { subject: string; html: string } {
  return {
    subject: `Quick favour, ${photographerName}?`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Help Us Grow!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for being part of ${country.brand}. Your work is what makes this platform great.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We'd love it if you could share your experience as a photographer on Google or Trustpilot. A genuine review from a professional like you helps build trust and brings more clients to the platform — which means more bookings for everyone:</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", "Review Us on Google", "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton(`https://www.trustpilot.com/evaluate/${country.host}`, "Review Us on Trustpilot", "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">It takes less than a minute. Thank you for your support!</p>
    `),
  };
}

/** Concierge "your matches" 24h follow-up. Sent to visitors who chatted
 *  with Lens, got photographer matches, gave us their email, but never
 *  came back. Recap of the same matches so they don't have to dig
 *  through the chat. Cron: src/app/api/cron/reminders/route.ts §4d. */
export function renderConciergeMatchesFollowUp(
  firstName: string | null,
  photographers: Array<{
    name: string;
    slug: string;
    cover_url: string | null;
    min_price: number | null;
    top_locations: string[];
  }>,
  chatId: string,
): { subject: string; html: string } {
  const greet = (firstName || "").trim() || "there";
  const conciergeUrl = `${BASE_URL}/concierge?chat=${encodeURIComponent(chatId)}`;
  const cards = photographers.slice(0, 4).map((p) => {
    const profileUrl = `${BASE_URL}/photographers/${p.slug}`;
    const cover = p.cover_url
      ? `<img src="${p.cover_url}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px 12px 0 0;" />`
      : "";
    const loc = p.top_locations.slice(0, 2).join(" · ");
    const price = p.min_price ? `From €${clientPriceWithFee(Number(p.min_price))}` : "";
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border:1px solid #F3EDE6;border-radius:12px;overflow:hidden;">
        <tr><td>${cover}</td></tr>
        <tr><td style="padding:14px 16px;">
          <div style="font-size:16px;font-weight:700;color:#1F1F1F;">${maskSurname(p.name)}</div>
          <div style="margin-top:4px;font-size:13px;color:#6B6056;">${loc}${loc && price ? " · " : ""}${price}</div>
          <div style="margin-top:12px;">
            <a href="${profileUrl}" style="color:#C94536;font-weight:600;text-decoration:none;font-size:14px;">View profile →</a>
          </div>
        </td></tr>
      </table>`;
  }).join("");
  return {
    subject: `Your ${country.brand} matches`,
    html: emailLayout(`
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">Hey ${greet}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Yesterday our concierge put together a shortlist for you. Here it is again so you don't have to dig through the chat — tap any photographer to see their full profile and book directly.</p>
      ${cards}
      ${emailButton(conciergeUrl, "Reopen your chat")}
      <p style="margin:16px 0 0;font-size:13px;color:#9B8E82;line-height:1.5;">Prefer to talk to a real person? Just reply to this email — we read every one.</p>
    `),
  };
}

/** Soft "ready to book?" nudge for concierge-sourced inquiries that
 *  haven't reached the checkout step within 24h. Different tone from
 *  the firm payment-reminder cascade (which only kicks in once status
 *  hits 'confirmed' and a payment URL exists). Cron: §1d. */
export function renderReadyToBookNudge(
  firstName: string | null,
  photographerName: string,
  threadUrl: string,
): { subject: string; html: string } {
  const greet = (firstName || "").trim() || "there";
  const photographerDisplay = maskSurname(photographerName);
  return {
    subject: `Still thinking about your shoot with ${photographerDisplay}?`,
    html: emailLayout(`
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">Hey ${greet}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">You started a chat with <strong>${photographerDisplay}</strong> yesterday on ${country.brand} — looks like you didn't finish picking a date.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4A4A;">No rush, but if you're still up for it, jump back into the conversation and they can confirm availability + send you a quick booking link.</p>
      ${emailButton(threadUrl, "Open the chat")}
      <p style="margin:16px 0 0;font-size:13px;color:#9B8E82;line-height:1.5;">Questions? Just reply to this email.</p>
    `),
  };
}

// === Additional notifications ===

export async function sendAdminBookingConfirmedNotification(
  clientName: string,
  photographerName: string,
  shootDate: string | null,
  totalPrice: number | null,
  packageName: string | null
) {
  const dateStr = formatShootDate(shootDate, "en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) || "Flexible dates";
  await sendToAllAdmins(
    `[Booking Confirmed] ${clientName} ↔ ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#16A34A;">Booking Confirmed</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Date:</strong> ${dateStr}</p>
        ${packageName ? `<p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Package:</strong> ${packageName}</p>` : ""}
        ${totalPrice ? `<p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Price:</strong> &euro;${Math.round(totalPrice)}</p>` : ""}
      </div>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Payment link has been sent to the client.</p>
      ${emailButton(`${BASE_URL}/admin#bookings`, "Go to Admin Panel", "#16A34A")}
    `)
  );
}

export async function sendAdminBookingCancelledNotification(
  clientName: string,
  photographerName: string,
  cancelledBy: "client" | "photographer" | "admin",
  refundAmount: number | null
) {
  const refundLine = refundAmount && refundAmount > 0
    ? `<p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Refund:</strong> &euro;${refundAmount.toFixed(2)}</p>`
    : `<p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Refund:</strong> None</p>`;
  await sendToAllAdmins(
    `[Booking Cancelled] ${clientName} \u2194 ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Booking Cancelled</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Cancelled by:</strong> ${cancelledBy}</p>
        ${refundLine}
      </div>
      ${emailButton(`${BASE_URL}/admin#bookings`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminAutoCancelNotification(
  clientName: string,
  photographerName: string
) {
  await sendToAllAdmins(
    `[Auto-Cancelled] ${clientName} ↔ ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#C94536;">Booking Auto-Cancelled</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Reason:</strong> Payment not received within 48 hours</p>
      </div>
      ${emailButton(`${BASE_URL}/admin#bookings`, "Go to Admin Panel")}
    `)
  );
}

export async function sendAdminNewInquiryNotification(
  clientName: string,
  photographerName: string,
  messagePreview: string,
  options?: { replyTo?: string }
) {
  await sendToAllAdmins(
    `[New Inquiry] ${clientName} → ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">New Inquiry</h2>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Photographer:</strong> ${photographerName}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;font-style:italic;">"${messagePreview}"</p>
      </div>
      ${emailButton(`${BASE_URL}/admin`, "Go to Admin Panel")}
    `),
    options
  );
}

export async function sendPaymentFailedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string
) {
  const photographerDisplay = maskSurname(photographerName);
  await sendEmail(
    clientEmail,
    `Payment failed for your booking with ${photographerDisplay}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Failed</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your payment for the photoshoot with <strong>${photographerDisplay}</strong> could not be processed.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please try again with a different payment method or contact your bank for details.</p>
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "Retry Payment")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">
        Need help? <a href="${BASE_URL}/support" style="color:#C94536;">Contact support</a>
      </p>
    `)
  );
}

export async function sendAbandonedBookingReminder(
  clientEmail: string,
  clientName: string,
  photographers: { name: string; slug: string }[]
) {
  const firstName = clientName.split(" ")[0];
  const single = photographers.length === 1;
  const display0 = maskSurname(photographers[0].name);
  const subject = single
    ? `Still thinking about your photoshoot with ${display0}?`
    : `Still looking for a photographer in Portugal?`;
  const photographerLinks = photographers
    .map(p => `<a href="${BASE_URL}/photographers/${p.slug}" style="color:#C94536;font-weight:600;text-decoration:none;">${maskSurname(p.name)}</a>`)
    .join(", ");
  await sendEmail(
    clientEmail,
    subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Hi ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We noticed you were checking out ${single ? `<strong>${display0}</strong>` : `some of our photographers: ${photographerLinks}`}. Great taste!</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Schedules fill up quickly during peak season. You can message any photographer directly with questions before booking.</p>
      ${emailButton(`${BASE_URL}/photographers/${photographers[0].slug}`, single ? "View " + display0 + "'s Profile" : "View Photographers")}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#9A9A9A;">Need help choosing? Reply to this email and we'll personally help you find the perfect photographer for your trip.</p>
    `)
  );
}

export async function sendNoBookingNudge(
  clientEmail: string,
  clientName: string
) {
  const firstName = clientName.split(" ")[0];
  await sendEmail(
    clientEmail,
    `Need help finding a photographer in Portugal?`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Hi ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Welcome to ${country.brand}! We noticed you signed up but haven't booked a session yet.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Not sure where to start? Tell us your dates, group size, and preferred location, and we'll recommend the perfect photographer for your trip.</p>
      ${emailButton(`${BASE_URL}/photographers`, "Browse Photographers")}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#9A9A9A;">Just reply to this email with your plans and we'll take care of the rest!</p>
    `)
  );
}

export async function sendReviewApprovedToPhotographer(
  photographerEmail: string,
  photographerName: string,
  clientName: string,
  rating: number,
  profileSlug: string,
  title?: string | null,
  text?: string | null
) {
  const filledStar = "\u2605";
  const emptyStar = "\u2606";
  const stars = filledStar.repeat(rating) + emptyStar.repeat(5 - rating);
  const clientFirstName = clientName.split(" ")[0];
  const safeTitle = title ? String(title).replace(/</g, "&lt;") : "";
  const safeText = text ? String(text).replace(/</g, "&lt;").replace(/\n/g, "<br>") : "";

  await sendEmail(
    photographerEmail,
    `You have a new ${rating}-star review`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">You have a new review</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName.split(" ")[0]},</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${clientFirstName}</strong> left you a review.</p>

      <div style="margin:16px 0;padding:20px;background:#FAF8F5;border-radius:12px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:24px;letter-spacing:2px;color:#F59E0B;">${stars}</p>
        ${safeTitle ? `<p style="margin:12px 0 8px;font-size:16px;font-weight:700;color:#1F1F1F;">${safeTitle}</p>` : ""}
        ${safeText ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;font-style:italic;">"${safeText}"</p>` : ""}
      </div>

      ${emailButton(`${BASE_URL}/photographers/${profileSlug}#reviews`, "View on Your Profile")}
    `)
  );
}

// Kate's personal-tone ask sent ~48h after the client accepts delivery.
// Always English (Kate's call). Sends from ceo@photoportugal.com so the
// reply lands in her mailbox, not the shared support inbox.
//
// Asks for blanket permission, not per-frame approval: the earlier copy
// promised to send candidate photos back for sign-off, which meant a second
// round-trip and manual work for Kate on every "yes". The photographer now
// picks the frames, and the client keeps a veto they rarely use. Nothing
// downstream parses the replies — Kate reads them herself.
export async function sendSocialPermissionEmail(
  to: string,
  firstName: string,
  photographerName: string,
  location: string | null,
) {
  if (!ceoTransporter) {
    console.log(`[email] SMTP_CEO_PASS not set, skipping social-permission email → ${to}`);
    return;
  }
  const safeFirst = String(firstName || "there").replace(/[<>]/g, "");
  const safePhotog = maskSurname(String(photographerName || "your photographer")).replace(/[<>]/g, "");
  const safeLoc = location ? String(location).replace(/[<>]/g, "") : null;
  const locationPhrase = safeLoc ? ` in <strong>${safeLoc}</strong>` : "";

  const body = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#1F1F1F;">Hi ${safeFirst},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">It's Kate, founder of ${country.brand}. I've just been through the photos <strong>${safePhotog}</strong> made with you${locationPhrase} — genuinely lovely work ✨</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">We're still a young platform, and the honest truth is that good photos are what bring new clients to our photographers. So: would you let us feature a few of yours on our Instagram and website?</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;"><strong>${safePhotog}</strong> would pick the frames they're proudest of — the most natural and flattering ones, never anything personal or revealing. Nothing for you to approve; just reply <strong>"yes"</strong> and we'll handle it from there. And if there's a particular shot you'd rather keep to yourself, just tell me which and we'll leave it out.</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#2A2A2A;">Prefer not to? Reply <strong>"no thanks"</strong> and that's the end of it — no hard feelings, and I won't ask twice.</p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#2A2A2A;">Either way, thank you for choosing us. Every booking through our platform goes to an independent photographer here in ${country.countryName.en}, and that's the whole point of what we're building 🌸</p>
    <p style="margin:0;font-size:15px;line-height:1.55;color:#2A2A2A;">Warmly,</p>
    <p style="margin:4px 0 2px;font-size:15px;line-height:1.4;color:#1F1F1F;font-weight:600;">Kate</p>
    <p style="margin:0;font-size:13px;line-height:1.4;color:#9B8E82;">Founder · ${country.brand}</p>
  `;

  const subject = `May we show off ${safePhotog}'s work? 🌸`;
  try {
    await ceoTransporter.sendMail({
      from: `Kate Belova <${process.env.SMTP_CEO_USER || `ceo@${country.host}`}>`,
      to,
      subject,
      html: emailLayout(body, "en"),
      replyTo: process.env.SMTP_CEO_USER || `ceo@${country.host}`,
    });
    console.log(`[email] Sent social-permission → ${to}`);
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject, "sent")).catch(() => {});
  } catch (err) {
    console.error(`[email] social-permission failed → ${to}`, err);
    import("@/lib/notification-log").then(m => m.logNotification("email", to, subject, "failed", undefined, String(err))).catch(() => {});
  }
}

/**
 * Calendar sync has been failing for this photographer for a while.
 *
 * Sent by the reminders cron, not at the moment of failure: a single hiccup
 * fixes itself on the next run 15 minutes later and is not worth an email.
 * What matters is a connection that stays broken — one sat dead for 2.5 months
 * showing only Google's raw `{"error":"invalid_grant"}` on the dashboard, and
 * nobody noticed. While it's broken the cached busy slots go stale, so the
 * booking check can accept a slot the photographer is not actually free for.
 */
export async function sendCalendarSyncBrokenEmail(
  to: string,
  photographerName: string,
  connectionLabel: string,
  brokenSinceDays: number,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const url = `${country.baseUrl}${locale === "en" ? "" : `/${locale}`}/dashboard/calendar-sync`;

  const C = {
    en: {
      subject: "Your calendar stopped syncing — reconnect it",
      h2: "Your calendar stopped syncing",
      greet: `Hi ${firstName},`,
      p1: `We haven't been able to read <strong>${connectionLabel}</strong> for ${brokenSinceDays} day${brokenSinceDays === 1 ? "" : "s"}.`,
      p2: "That matters because we use your calendar to block times you're already busy. While it's disconnected we're working from an old copy, so a client could book a slot you can't actually do.",
      p3: "Reconnecting takes about ten seconds.",
      cta: "Reconnect my calendar",
      p4: "If you meant to disconnect it, you can ignore this — but please block your busy dates manually under Availability so nothing gets double-booked.",
    },
    pt: {
      subject: "O seu calendário deixou de sincronizar — volte a ligá-lo",
      h2: "O seu calendário deixou de sincronizar",
      greet: `Olá ${firstName},`,
      p1: `Há ${brokenSinceDays} dia${brokenSinceDays === 1 ? "" : "s"} que não conseguimos ler <strong>${connectionLabel}</strong>.`,
      p2: "Isto é importante porque usamos o seu calendário para bloquear as horas em que já está ocupado. Enquanto estiver desligado, estamos a trabalhar com uma cópia antiga — um cliente pode reservar um horário que na verdade não tem livre.",
      p3: "Voltar a ligar demora cerca de dez segundos.",
      cta: "Voltar a ligar o calendário",
      p4: "Se desligou de propósito, ignore este email — mas bloqueie as suas datas ocupadas manualmente em Disponibilidade para não haver reservas duplicadas.",
    },
    de: {
      subject: "Ihr Kalender synchronisiert nicht mehr — bitte neu verbinden",
      h2: "Ihr Kalender synchronisiert nicht mehr",
      greet: `Hallo ${firstName},`,
      p1: `Seit ${brokenSinceDays} Tag${brokenSinceDays === 1 ? "" : "en"} können wir <strong>${connectionLabel}</strong> nicht mehr auslesen.`,
      p2: "Das ist wichtig, weil wir Ihren Kalender nutzen, um bereits belegte Zeiten zu sperren. Solange die Verbindung fehlt, arbeiten wir mit einem alten Stand — ein Kunde könnte einen Termin buchen, den Sie gar nicht wahrnehmen können.",
      p3: "Das Neuverbinden dauert etwa zehn Sekunden.",
      cta: "Kalender neu verbinden",
      p4: "Falls Sie die Verbindung absichtlich getrennt haben, können Sie diese E-Mail ignorieren — tragen Sie Ihre belegten Tage dann bitte manuell unter Verfügbarkeit ein, damit nichts doppelt gebucht wird.",
    },
    es: {
      subject: "Tu calendario dejó de sincronizarse — vuelve a conectarlo",
      h2: "Tu calendario dejó de sincronizarse",
      greet: `Hola ${firstName},`,
      p1: `Llevamos ${brokenSinceDays} día${brokenSinceDays === 1 ? "" : "s"} sin poder leer <strong>${connectionLabel}</strong>.`,
      p2: "Esto importa porque usamos tu calendario para bloquear las horas en las que ya estás ocupado. Mientras esté desconectado trabajamos con una copia antigua, así que un cliente podría reservar un hueco que en realidad no tienes libre.",
      p3: "Volver a conectarlo lleva unos diez segundos.",
      cta: "Reconectar mi calendario",
      p4: "Si lo desconectaste a propósito, puedes ignorar este correo — pero bloquea tus fechas ocupadas manualmente en Disponibilidad para que no haya reservas duplicadas.",
    },
    fr: {
      subject: "Votre agenda ne se synchronise plus — reconnectez-le",
      h2: "Votre agenda ne se synchronise plus",
      greet: `Bonjour ${firstName},`,
      p1: `Depuis ${brokenSinceDays} jour${brokenSinceDays === 1 ? "" : "s"}, nous n'arrivons plus à lire <strong>${connectionLabel}</strong>.`,
      p2: "C'est important, car nous utilisons votre agenda pour bloquer les créneaux où vous êtes déjà pris. Tant que la connexion est coupée, nous travaillons sur une copie ancienne : un client pourrait réserver un créneau que vous ne pouvez pas assurer.",
      p3: "La reconnexion prend une dizaine de secondes.",
      cta: "Reconnecter mon agenda",
      p4: "Si vous l'avez déconnecté volontairement, ignorez cet e-mail — mais pensez à bloquer vos dates occupées manuellement dans Disponibilité pour éviter les doubles réservations.",
    },
    it: {
      subject: "Il tuo calendario ha smesso di sincronizzarsi — ricollegalo",
      h2: "Il tuo calendario ha smesso di sincronizzarsi",
      greet: `Ciao ${firstName},`,
      p1: `Da ${brokenSinceDays} giorn${brokenSinceDays === 1 ? "o" : "i"} non riusciamo più a leggere <strong>${connectionLabel}</strong>.`,
      p2: "È importante perché usiamo il tuo calendario per bloccare gli orari in cui sei già impegnato. Finché resta scollegato lavoriamo su una copia vecchia, quindi un cliente potrebbe prenotare un orario che in realtà non hai libero.",
      p3: "Ricollegarlo richiede una decina di secondi.",
      cta: "Ricollega il calendario",
      p4: "Se l'hai scollegato di proposito puoi ignorare questa email — ma blocca a mano le date occupate in Disponibilità, così nessuno prenota due volte.",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p1}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p2}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p3}</p>
      ${emailButton(url, C.cta)}
      <p style="margin:0;font-size:13px;color:#9B8E82;line-height:1.6;">${C.p4}</p>
    `, locale),
  );
}

// ─── Two-stage onboarding (2026-08-02) ────────────────────────────────────
// Stage one ends with an approval request; stage two is the week the
// photographer has to connect Stripe once they are already live. See
// lib/onboarding-stage.ts for why the two are separate.

export async function sendApprovalRequestedToPhotographer(
  to: string,
  photographerName: string,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const C = {
    en: {
      subject: `We've got your application — ${country.brand}`,
      h2: "Your profile is with our team",
      greet: `Hi ${firstName},`,
      p1: "Thanks for finishing your profile — it's now in the review queue.",
      p2: "A real person looks at every application. We usually come back within a couple of days, either to welcome you in or to ask for a small change first.",
      p3: "There's nothing to do until you hear from us.",
    },
    pt: {
      subject: `Recebemos a sua candidatura — ${country.brand}`,
      h2: "O seu perfil está com a nossa equipa",
      greet: `Olá ${firstName},`,
      p1: "Obrigado por concluir o seu perfil — está agora na fila de análise.",
      p2: "Cada candidatura é vista por uma pessoa. Normalmente respondemos dentro de dois dias, seja para lhe dar as boas-vindas, seja para pedir uma pequena alteração primeiro.",
      p3: "Não precisa de fazer mais nada até termos novidades.",
    },
    de: {
      subject: `Ihre Bewerbung ist bei uns — ${country.brand}`,
      h2: "Ihr Profil liegt bei unserem Team",
      greet: `Hallo ${firstName},`,
      p1: "Danke, dass Sie Ihr Profil fertiggestellt haben — es ist jetzt in der Prüfung.",
      p2: "Jede Bewerbung sieht sich ein Mensch an. Normalerweise melden wir uns innerhalb von zwei Tagen: entweder mit einer Zusage oder mit der Bitte um eine kleine Änderung.",
      p3: "Bis dahin müssen Sie nichts weiter tun.",
    },
    es: {
      subject: `Hemos recibido tu solicitud — ${country.brand}`,
      h2: "Tu perfil está con nuestro equipo",
      greet: `Hola ${firstName},`,
      p1: "Gracias por completar tu perfil: ya está en la cola de revisión.",
      p2: "Cada solicitud la mira una persona. Solemos responder en un par de días, ya sea para darte la bienvenida o para pedirte antes algún cambio pequeño.",
      p3: "No tienes que hacer nada más hasta que te escribamos.",
    },
    fr: {
      subject: `Nous avons bien reçu votre candidature — ${country.brand}`,
      h2: "Votre profil est entre les mains de notre équipe",
      greet: `Bonjour ${firstName},`,
      p1: "Merci d'avoir complété votre profil : il est désormais dans la file d'attente.",
      p2: "Chaque candidature est examinée par une personne. Nous revenons vers vous sous deux jours en général, soit pour vous accueillir, soit pour vous demander d'abord une petite modification.",
      p3: "Vous n'avez rien à faire d'ici là.",
    },
    it: {
      subject: `Abbiamo ricevuto la tua candidatura — ${country.brand}`,
      h2: "Il tuo profilo è al vaglio del nostro team",
      greet: `Ciao ${firstName},`,
      p1: "Grazie per aver completato il profilo: ora è in coda di revisione.",
      p2: "Ogni candidatura viene letta da una persona. Di solito rispondiamo entro un paio di giorni, per darti il benvenuto o per chiederti prima una piccola modifica.",
      p3: "Fino ad allora non devi fare altro.",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p1}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p2}</p>
      <p style="margin:0;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p3}</p>
    `, locale),
  );
}

export async function sendAdminApprovalRequestNotification(
  photographerName: string,
  photographerEmail: string,
  slug: string,
  options?: { replyTo?: string },
) {
  await sendToAllAdmins(
    `[Review] ${photographerName} asked for approval`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Ready for review</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">A photographer finished the profile checklist and asked to be approved. Stripe is not connected yet — that step only unlocks once you approve.</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Name:</strong> ${photographerName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Email:</strong> ${photographerEmail}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Profile:</strong> ${country.baseUrl}/photographers/${slug}</p>
      </div>
      ${emailButton(`${BASE_URL}/admin`, "Review this photographer")}
    `),
    options
  );
}

/**
 * Extra photographs bought. Two audiences, two different facts.
 *
 * The client is told what they now own and where it is; the archive is built
 * in the background, so the copy points at the gallery rather than promising
 * a file that may still be zipping.
 *
 * The photographer is told the payout, never the client's gross — the same
 * rule the rest of the product follows.
 */
export async function sendExtrasBoughtToClient(
  to: string,
  clientName: string,
  count: number,
  galleryUrl: string,
  locale: Locale = "en",
) {
  const firstName = (clientName || "").split(" ")[0] || clientName;
  const C = {
    en: {
      subject: `Your ${count} extra photo${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} yours`,
      greet: `Hi ${firstName},`,
      body: `Thank you — ${count} extra photograph${count === 1 ? "" : "s"} from your session ${count === 1 ? "is" : "are"} now unlocked in your gallery, in full resolution.`,
      zip: "They are also being packed into their own download, which takes a few minutes for larger sets.",
      cta: "Open my gallery",
    },
    pt: {
      subject: `${count} fotografia${count === 1 ? "" : "s"} extra já ${count === 1 ? "é sua" : "são suas"}`,
      greet: `Olá ${firstName},`,
      body: `Obrigado — ${count} fotografia${count === 1 ? "" : "s"} extra da sua sessão ${count === 1 ? "está desbloqueada" : "estão desbloqueadas"} na sua galeria, em alta resolução.`,
      zip: "Estamos também a prepará-las num download próprio; em conjuntos maiores demora alguns minutos.",
      cta: "Abrir a minha galeria",
    },
    de: {
      subject: `Ihre ${count} zusätzlichen Fotos gehören Ihnen`,
      greet: `Hallo ${firstName},`,
      body: `Danke — ${count} zusätzliche Aufnahme${count === 1 ? "" : "n"} aus Ihrem Shooting ${count === 1 ? "ist" : "sind"} jetzt in voller Auflösung in Ihrer Galerie freigeschaltet.`,
      zip: "Sie werden außerdem in einen eigenen Download gepackt — bei größeren Mengen dauert das ein paar Minuten.",
      cta: "Meine Galerie öffnen",
    },
    es: {
      subject: `Tus ${count} foto${count === 1 ? "" : "s"} extra ya ${count === 1 ? "es tuya" : "son tuyas"}`,
      greet: `Hola ${firstName},`,
      body: `Gracias — ${count} fotografía${count === 1 ? "" : "s"} extra de tu sesión ${count === 1 ? "está desbloqueada" : "están desbloqueadas"} en tu galería, en alta resolución.`,
      zip: "También las estamos preparando en una descarga aparte; con conjuntos grandes tarda unos minutos.",
      cta: "Abrir mi galería",
    },
    fr: {
      subject: `Vos ${count} photo${count === 1 ? "" : "s"} supplémentaire${count === 1 ? "" : "s"} sont à vous`,
      greet: `Bonjour ${firstName},`,
      body: `Merci — ${count} photographie${count === 1 ? "" : "s"} supplémentaire${count === 1 ? "" : "s"} de votre séance ${count === 1 ? "est débloquée" : "sont débloquées"} dans votre galerie, en pleine résolution.`,
      zip: "Elles sont aussi rassemblées dans un téléchargement à part ; pour les grandes sélections cela prend quelques minutes.",
      cta: "Ouvrir ma galerie",
    },
    it: {
      subject: `${count === 1 ? "La tua foto extra è tua" : `Le tue ${count} foto extra sono tue`}`,
      greet: `Ciao ${firstName},`,
      body: `Grazie — ${count} fotografi${count === 1 ? "a" : "e"} extra della tua sessione ${count === 1 ? "è ora sbloccata" : "sono ora sbloccate"} nella tua galleria, ad alta risoluzione.`,
      zip: "Le stiamo anche preparando in un download a parte; con selezioni grandi ci vogliono alcuni minuti.",
      cta: "Apri la mia galleria",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.subject}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${C.body}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6B7280;">${C.zip}</p>
      ${emailButton(galleryUrl, C.cta)}
    `, locale)
  );
}

export async function sendExtrasBoughtToPhotographer(
  to: string,
  photographerName: string,
  clientName: string,
  count: number,
  payoutEur: string,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const C = {
    en: {
      subject: `${clientName} bought ${count} extra photo${count === 1 ? "" : "s"} — €${payoutEur} to you`,
      greet: `Hi ${firstName},`,
      body: `${clientName} bought ${count} of the photograph${count === 1 ? "" : "s"} you held back. €${payoutEur} is on its way to your payout account — nothing for you to do.`,
      tail: "Photographs you keep out of a delivery stay on offer while the gallery is live.",
    },
    pt: {
      subject: `${clientName} comprou ${count} fotografia${count === 1 ? "" : "s"} extra — €${payoutEur} para si`,
      greet: `Olá ${firstName},`,
      body: `${clientName} comprou ${count} das fotografias que reteve. €${payoutEur} seguem para a sua conta de pagamentos — não tem de fazer nada.`,
      tail: "As fotografias que deixa fora de uma entrega continuam à venda enquanto a galeria estiver ativa.",
    },
    de: {
      subject: `${clientName} hat ${count} zusätzliche Fotos gekauft — €${payoutEur} für Sie`,
      greet: `Hallo ${firstName},`,
      body: `${clientName} hat ${count} der zurückgehaltenen Aufnahmen gekauft. €${payoutEur} sind auf dem Weg zu Ihrem Auszahlungskonto — Sie müssen nichts tun.`,
      tail: "Aufnahmen, die Sie aus einer Lieferung heraushalten, bleiben im Angebot, solange die Galerie online ist.",
    },
    es: {
      subject: `${clientName} compró ${count} foto${count === 1 ? "" : "s"} extra — €${payoutEur} para ti`,
      greet: `Hola ${firstName},`,
      body: `${clientName} ha comprado ${count} de las fotografías que reservaste. €${payoutEur} van de camino a tu cuenta de cobros — no tienes que hacer nada.`,
      tail: "Las fotos que dejas fuera de una entrega siguen a la venta mientras la galería esté activa.",
    },
    fr: {
      subject: `${clientName} a acheté ${count} photo${count === 1 ? "" : "s"} supplémentaire${count === 1 ? "" : "s"} — €${payoutEur} pour vous`,
      greet: `Bonjour ${firstName},`,
      body: `${clientName} a acheté ${count} des photographies que vous aviez retenues. €${payoutEur} partent vers votre compte de paiement — rien à faire de votre côté.`,
      tail: "Les photos que vous laissez hors d'une livraison restent proposées tant que la galerie est en ligne.",
    },
    it: {
      subject: `${clientName} ha comprato ${count} foto extra — €${payoutEur} per te`,
      greet: `Ciao ${firstName},`,
      body: `${clientName} ha comprato ${count} delle fotografie che avevi tenuto da parte. €${payoutEur} sono in arrivo sul tuo conto per i pagamenti — non devi fare nulla.`,
      tail: "Le foto che lasci fuori da una consegna restano in vendita finché la galleria è online.",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.subject}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${C.body}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#9CA3AF;">${C.tail}</p>
    `, locale)
  );
}

export async function sendApprovedConnectStripeEmail(
  to: string,
  photographerName: string,
  graceDays: number,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const url = `${country.baseUrl}${locale === "en" ? "" : `/${locale}`}/dashboard/payouts`;
  const C = {
    en: {
      subject: `You're in — welcome to ${country.brand}`,
      h2: `You're in`,
      greet: `Hi ${firstName},`,
      p1: "We've reviewed your profile and accepted it. It's live on the site now, and clients can find and book you.",
      p2: `One thing left: connect your payout account so we can pay you. It takes a few minutes, and you have ${graceDays} days.`,
      p3: "You can receive bookings before it's done — we'll hold the money and send it on as soon as your account is connected. But it's much easier to do it now than on the day of your first shoot.",
      cta: "Connect my payout account",
    },
    pt: {
      subject: `Está dentro — bem-vindo à ${country.brand}`,
      h2: "Está dentro",
      greet: `Olá ${firstName},`,
      p1: "Analisámos o seu perfil e aceitámos a candidatura. Já está publicado no site e os clientes podem encontrá-lo e reservar.",
      p2: `Falta uma coisa: ligar a conta de pagamentos para lhe podermos pagar. São poucos minutos e tem ${graceDays} dias.`,
      p3: "Pode receber reservas antes disso — guardamos o dinheiro e enviamos assim que a conta estiver ligada. Mas é bem mais simples tratar disto agora do que no dia da primeira sessão.",
      cta: "Ligar a minha conta de pagamentos",
    },
    de: {
      subject: `Sie sind dabei — willkommen bei ${country.brand}`,
      h2: "Sie sind dabei",
      greet: `Hallo ${firstName},`,
      p1: "Wir haben Ihr Profil geprüft und angenommen. Es ist jetzt online, und Kundinnen und Kunden können Sie finden und buchen.",
      p2: `Eines fehlt noch: Verbinden Sie Ihr Auszahlungskonto, damit wir Sie bezahlen können. Das dauert wenige Minuten, und Sie haben ${graceDays} Tage Zeit.`,
      p3: "Sie können auch vorher schon Buchungen erhalten — wir halten das Geld und überweisen es, sobald das Konto verbunden ist. Es ist aber deutlich entspannter, das jetzt zu erledigen als am Tag des ersten Shootings.",
      cta: "Auszahlungskonto verbinden",
    },
    es: {
      subject: `Estás dentro — bienvenido a ${country.brand}`,
      h2: "Estás dentro",
      greet: `Hola ${firstName},`,
      p1: "Hemos revisado tu perfil y lo hemos aceptado. Ya está publicado y los clientes pueden encontrarte y reservar contigo.",
      p2: `Queda una cosa: conectar tu cuenta de cobros para que podamos pagarte. Son unos minutos y tienes ${graceDays} días.`,
      p3: "Puedes recibir reservas antes de hacerlo: guardamos el dinero y te lo enviamos en cuanto la cuenta esté conectada. Pero es mucho más cómodo resolverlo ahora que el día de tu primera sesión.",
      cta: "Conectar mi cuenta de cobros",
    },
    fr: {
      subject: `C'est bon — bienvenue chez ${country.brand}`,
      h2: "C'est bon",
      greet: `Bonjour ${firstName},`,
      p1: "Nous avons examiné votre profil et l'avons accepté. Il est en ligne, et les clients peuvent vous trouver et vous réserver.",
      p2: `Il reste une chose : connecter votre compte de paiement pour que nous puissions vous régler. Cela prend quelques minutes, et vous avez ${graceDays} jours.`,
      p3: "Vous pouvez recevoir des réservations avant : nous conservons l'argent et le versons dès que le compte est connecté. Mais c'est bien plus simple de le faire maintenant que le jour de votre première séance.",
      cta: "Connecter mon compte de paiement",
    },
    it: {
      subject: `Ci sei — benvenuto su ${country.brand}`,
      h2: "Ci sei",
      greet: `Ciao ${firstName},`,
      p1: "Abbiamo esaminato il tuo profilo e lo abbiamo accettato. È già online e i clienti possono trovarti e prenotare.",
      p2: `Manca una cosa: collegare il conto per i pagamenti, così possiamo pagarti. Sono pochi minuti e hai ${graceDays} giorni di tempo.`,
      p3: "Puoi ricevere prenotazioni anche prima: tratteniamo il denaro e te lo inviamo appena il conto è collegato. Ma è molto più comodo farlo adesso che il giorno del primo servizio.",
      cta: "Collega il mio conto per i pagamenti",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p1}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p2}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p3}</p>
      ${emailButton(url, C.cta)}
    `, locale),
  );
}

export async function sendStripeDeadlineNudge(
  to: string,
  photographerName: string,
  daysLeft: number,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const url = `${country.baseUrl}${locale === "en" ? "" : `/${locale}`}/dashboard/payouts`;
  const last = daysLeft <= 0;
  const C = {
    en: {
      subject: last
        ? "Last reminder: connect your payout account"
        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to connect your payout account`,
      h2: "You can't be paid yet",
      greet: `Hi ${firstName},`,
      p1: "Your profile is live and taking bookings, but your payout account still isn't connected — so there's nowhere for us to send your money.",
      p2: last
        ? "This is the last automatic reminder. If you've hit a problem with the form, reply to this email and a person will help — we'd rather sort it out than lose you."
        : `You have ${daysLeft} day${daysLeft === 1 ? "" : "s"} left. It takes a few minutes: ID, address and bank details.`,
      cta: "Connect my payout account",
    },
    pt: {
      subject: last
        ? "Último lembrete: ligue a sua conta de pagamentos"
        : `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"} para ligar a conta de pagamentos`,
      h2: "Ainda não lhe podemos pagar",
      greet: `Olá ${firstName},`,
      p1: "O seu perfil está publicado e a receber reservas, mas a conta de pagamentos continua por ligar — não temos para onde enviar o seu dinheiro.",
      p2: last
        ? "Este é o último lembrete automático. Se ficou preso nalgum passo do formulário, responda a este email e uma pessoa ajuda-o — preferimos resolver a perdê-lo."
        : `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"}. São poucos minutos: identificação, morada e dados bancários.`,
      cta: "Ligar a minha conta de pagamentos",
    },
    de: {
      subject: last
        ? "Letzte Erinnerung: Auszahlungskonto verbinden"
        : `Noch ${daysLeft} Tag${daysLeft === 1 ? "" : "e"}, um Ihr Auszahlungskonto zu verbinden`,
      h2: "Wir können Sie noch nicht bezahlen",
      greet: `Hallo ${firstName},`,
      p1: "Ihr Profil ist online und nimmt Buchungen an, aber Ihr Auszahlungskonto ist noch nicht verbunden — wir haben also keinen Weg, Ihnen Geld zu schicken.",
      p2: last
        ? "Das ist die letzte automatische Erinnerung. Wenn Sie im Formular hängen, antworten Sie einfach auf diese E-Mail — ein Mensch hilft Ihnen. Uns ist eine Lösung lieber als ein Abschied."
        : `Sie haben noch ${daysLeft} Tag${daysLeft === 1 ? "" : "e"}. Es dauert wenige Minuten: Ausweis, Adresse und Bankverbindung.`,
      cta: "Auszahlungskonto verbinden",
    },
    es: {
      subject: last
        ? "Último recordatorio: conecta tu cuenta de cobros"
        : `Te quedan ${daysLeft} día${daysLeft === 1 ? "" : "s"} para conectar tu cuenta de cobros`,
      h2: "Todavía no podemos pagarte",
      greet: `Hola ${firstName},`,
      p1: "Tu perfil está publicado y recibiendo reservas, pero la cuenta de cobros sigue sin conectar, así que no tenemos dónde enviarte el dinero.",
      p2: last
        ? "Este es el último recordatorio automático. Si te has atascado en el formulario, responde a este correo y te ayuda una persona: preferimos resolverlo a perderte."
        : `Te quedan ${daysLeft} día${daysLeft === 1 ? "" : "s"}. Son unos minutos: identificación, dirección y datos bancarios.`,
      cta: "Conectar mi cuenta de cobros",
    },
    fr: {
      subject: last
        ? "Dernier rappel : connectez votre compte de paiement"
        : `Il vous reste ${daysLeft} jour${daysLeft === 1 ? "" : "s"} pour connecter votre compte de paiement`,
      h2: "Nous ne pouvons pas encore vous payer",
      greet: `Bonjour ${firstName},`,
      p1: "Votre profil est en ligne et reçoit des réservations, mais votre compte de paiement n'est toujours pas connecté : nous n'avons nulle part où vous envoyer votre argent.",
      p2: last
        ? "C'est le dernier rappel automatique. Si vous bloquez sur le formulaire, répondez à cet e-mail et une personne vous aidera — nous préférons régler le problème que vous perdre."
        : `Il vous reste ${daysLeft} jour${daysLeft === 1 ? "" : "s"}. Cela prend quelques minutes : pièce d'identité, adresse et coordonnées bancaires.`,
      cta: "Connecter mon compte de paiement",
    },
    it: {
      subject: last
        ? "Ultimo promemoria: collega il conto per i pagamenti"
        : `Ti restano ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"} per collegare il conto per i pagamenti`,
      h2: "Non possiamo ancora pagarti",
      greet: `Ciao ${firstName},`,
      p1: "Il tuo profilo è online e riceve prenotazioni, ma il conto per i pagamenti non è ancora collegato: non abbiamo dove mandarti i soldi.",
      p2: last
        ? "Questo è l'ultimo promemoria automatico. Se ti sei bloccato in qualche passaggio del modulo, rispondi a questa email e ti aiuta una persona: preferiamo risolvere che perderti."
        : `Ti restano ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}. Sono pochi minuti: documento, indirizzo e coordinate bancarie.`,
      cta: "Collega il mio conto per i pagamenti",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p2}</p>
      ${emailButton(url, C.cta)}
    `, locale),
  );
}

export async function sendPhotographerFullyLiveEmail(
  to: string,
  photographerName: string,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const url = `${country.baseUrl}${locale === "en" ? "" : `/${locale}`}/dashboard`;
  const C = {
    en: {
      subject: "Your payout account is connected — you're all set",
      h2: "You're all set",
      greet: `Hi ${firstName},`,
      p1: "Your payout account is connected and verified. Nothing else is outstanding.",
      p2: "From here on, when a client accepts your gallery the money goes out to you automatically — you don't have to invoice anyone or ask us for it.",
      cta: "Go to my dashboard",
    },
    pt: {
      subject: "A sua conta de pagamentos está ligada — está tudo pronto",
      h2: "Está tudo pronto",
      greet: `Olá ${firstName},`,
      p1: "A sua conta de pagamentos está ligada e verificada. Não falta mais nada.",
      p2: "A partir de agora, quando um cliente aceitar a sua galeria, o dinheiro segue automaticamente para si — não precisa de emitir nada nem de nos pedir.",
      cta: "Ir para o meu painel",
    },
    de: {
      subject: "Ihr Auszahlungskonto ist verbunden — alles erledigt",
      h2: "Alles erledigt",
      greet: `Hallo ${firstName},`,
      p1: "Ihr Auszahlungskonto ist verbunden und verifiziert. Es steht nichts mehr offen.",
      p2: "Ab jetzt geht das Geld automatisch an Sie, sobald ein Kunde Ihre Galerie annimmt — Sie müssen nichts in Rechnung stellen und uns um nichts bitten.",
      cta: "Zum Dashboard",
    },
    es: {
      subject: "Tu cuenta de cobros está conectada — ya está todo listo",
      h2: "Ya está todo listo",
      greet: `Hola ${firstName},`,
      p1: "Tu cuenta de cobros está conectada y verificada. No queda nada pendiente.",
      p2: "A partir de ahora, cuando un cliente acepte tu galería el dinero sale hacia ti automáticamente: no tienes que facturar nada ni pedírnoslo.",
      cta: "Ir a mi panel",
    },
    fr: {
      subject: "Votre compte de paiement est connecté — tout est prêt",
      h2: "Tout est prêt",
      greet: `Bonjour ${firstName},`,
      p1: "Votre compte de paiement est connecté et vérifié. Il ne reste rien en suspens.",
      p2: "Désormais, dès qu'un client accepte votre galerie, l'argent part automatiquement vers vous : pas de facture à émettre, rien à nous demander.",
      cta: "Aller à mon tableau de bord",
    },
    it: {
      subject: "Il tuo conto per i pagamenti è collegato — è tutto pronto",
      h2: "È tutto pronto",
      greet: `Ciao ${firstName},`,
      p1: "Il tuo conto per i pagamenti è collegato e verificato. Non resta nulla in sospeso.",
      p2: "Da ora, quando un cliente accetta la tua galleria il denaro parte automaticamente verso di te: non devi emettere nulla né chiedercelo.",
      cta: "Vai alla mia dashboard",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${C.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p2}</p>
      ${emailButton(url, C.cta)}
    `, locale),
  );
}

export async function sendAdminStripeOverdueNotification(
  photographerName: string,
  photographerEmail: string,
  slug: string,
  daysOverdue: number,
) {
  await sendToAllAdmins(
    `[Action needed] ${photographerName} is live but still can't be paid`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Stripe deadline passed</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">This photographer was approved and is live on the site, but the week they had to connect a payout account has run out. They have had three reminders. Nothing has been done automatically — decide what should happen.</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Name:</strong> ${photographerName}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Email:</strong> ${photographerEmail}</p>
        <p style="margin:0 0 8px;font-size:15px;color:#4A4A4A;"><strong>Overdue by:</strong> ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}</p>
        <p style="margin:0;font-size:15px;color:#4A4A4A;"><strong>Profile:</strong> ${country.baseUrl}/photographers/${slug}</p>
      </div>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#9B8E82;">If they take a booking meanwhile, the money is held safely and pays out by itself once they connect.</p>
      ${emailButton(`${BASE_URL}/admin`, "Open the admin panel")}
    `)
  );
}

export async function sendProfileHiddenNoStripeEmail(
  to: string,
  photographerName: string,
  locale: Locale = "en",
) {
  const firstName = (photographerName || "").split(" ")[0] || photographerName;
  const url = `${country.baseUrl}${locale === "en" ? "" : `/${locale}`}/dashboard/payouts`;
  const C = {
    en: {
      subject: "Your profile is no longer visible to clients",
      h2: "Your profile has been hidden",
      greet: `Hi ${firstName},`,
      p1: "We've taken your profile off the site. It isn't a decision about your work — the week you had to connect a payout account has passed, and we can't list a photographer we have no way to pay.",
      p2: "Your account is untouched. Log in, connect your payout account, and your profile goes back up automatically within about fifteen minutes. Nothing else is lost: your photos, packages and locations are all still there.",
      p3: "If something in the form is blocking you, reply to this email and a person will help. We'd much rather sort it out.",
      cta: "Connect my payout account",
    },
    pt: {
      subject: "O seu perfil deixou de estar visível para os clientes",
      h2: "O seu perfil foi ocultado",
      greet: `Olá ${firstName},`,
      p1: "Retirámos o seu perfil do site. Não é uma decisão sobre o seu trabalho — passou a semana que tinha para ligar a conta de pagamentos, e não podemos mostrar um fotógrafo a quem não temos forma de pagar.",
      p2: "A sua conta está intacta. Entre, ligue a conta de pagamentos e o perfil volta a ficar online automaticamente em cerca de quinze minutos. Não perdeu nada: fotos, pacotes e localizações continuam lá.",
      p3: "Se algo no formulário o estiver a bloquear, responda a este email e uma pessoa ajuda-o. Preferimos muito mais resolver.",
      cta: "Ligar a minha conta de pagamentos",
    },
    de: {
      subject: "Ihr Profil ist für Kunden nicht mehr sichtbar",
      h2: "Ihr Profil wurde ausgeblendet",
      greet: `Hallo ${firstName},`,
      p1: "Wir haben Ihr Profil von der Seite genommen. Das ist keine Bewertung Ihrer Arbeit — die Woche für das Verbinden eines Auszahlungskontos ist verstrichen, und wir können niemanden listen, den wir nicht bezahlen können.",
      p2: "Ihr Konto bleibt unangetastet. Melden Sie sich an, verbinden Sie Ihr Auszahlungskonto, und das Profil geht innerhalb von etwa fünfzehn Minuten automatisch wieder online. Es geht nichts verloren: Fotos, Pakete und Orte sind alle noch da.",
      p3: "Wenn Sie im Formular hängen, antworten Sie einfach auf diese E-Mail — ein Mensch hilft Ihnen. Uns ist eine Lösung deutlich lieber.",
      cta: "Auszahlungskonto verbinden",
    },
    es: {
      subject: "Tu perfil ya no es visible para los clientes",
      h2: "Hemos ocultado tu perfil",
      greet: `Hola ${firstName},`,
      p1: "Hemos retirado tu perfil del sitio. No es una valoración de tu trabajo: ha pasado la semana que tenías para conectar una cuenta de cobros, y no podemos mostrar a un fotógrafo al que no tenemos forma de pagar.",
      p2: "Tu cuenta sigue intacta. Entra, conecta la cuenta de cobros y el perfil vuelve a publicarse automáticamente en unos quince minutos. No has perdido nada: fotos, paquetes y ubicaciones siguen ahí.",
      p3: "Si algo del formulario te está bloqueando, responde a este correo y te ayuda una persona. Preferimos resolverlo con diferencia.",
      cta: "Conectar mi cuenta de cobros",
    },
    fr: {
      subject: "Votre profil n'est plus visible par les clients",
      h2: "Votre profil a été masqué",
      greet: `Bonjour ${firstName},`,
      p1: "Nous avons retiré votre profil du site. Ce n'est pas un jugement sur votre travail : la semaine dont vous disposiez pour connecter un compte de paiement est écoulée, et nous ne pouvons pas référencer un photographe que nous n'avons aucun moyen de payer.",
      p2: "Votre compte est intact. Connectez-vous, reliez votre compte de paiement, et le profil est republié automatiquement en une quinzaine de minutes. Rien n'est perdu : photos, forfaits et lieux sont toujours là.",
      p3: "Si le formulaire vous bloque, répondez à cet e-mail et une personne vous aidera. Nous préférons de loin régler le problème.",
      cta: "Connecter mon compte de paiement",
    },
    it: {
      subject: "Il tuo profilo non è più visibile ai clienti",
      h2: "Abbiamo nascosto il tuo profilo",
      greet: `Ciao ${firstName},`,
      p1: "Abbiamo tolto il tuo profilo dal sito. Non è un giudizio sul tuo lavoro: è passata la settimana che avevi per collegare un conto per i pagamenti, e non possiamo mostrare un fotografo che non abbiamo modo di pagare.",
      p2: "Il tuo account è intatto. Accedi, collega il conto e il profilo torna online automaticamente entro un quarto d'ora circa. Non hai perso nulla: foto, pacchetti e località sono ancora lì.",
      p3: "Se qualcosa nel modulo ti sta bloccando, rispondi a questa email e ti aiuta una persona. Preferiamo di gran lunga risolvere.",
      cta: "Collega il mio conto per i pagamenti",
    },
  }[locale];

  await sendEmail(
    to,
    C.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#B91C1C;">${C.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;">${C.greet}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p1}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p2}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#4A4A4A;line-height:1.6;">${C.p3}</p>
      ${emailButton(url, C.cta)}
    `, locale),
  );
}
