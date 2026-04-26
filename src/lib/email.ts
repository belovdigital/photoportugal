import nodemailer from "nodemailer";
import { queryOne } from "@/lib/db";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.migadu.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "info@photoportugal.com",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = "Photo Portugal <info@photoportugal.com>";
const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

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
export function emailLayout(body: string, locale: "en" | "pt" | "de" | "es" | "fr" = "en"): string {
  const labels: Record<string, { help: string; privacy: string; helpUrl: string; privacyUrl: string }> = {
    en: { help: "Help", privacy: "Privacy", helpUrl: "/support", privacyUrl: "/privacy" },
    pt: { help: "Ajuda", privacy: "Privacidade", helpUrl: "/pt/support", privacyUrl: "/pt/privacy" },
    de: { help: "Hilfe", privacy: "Datenschutz", helpUrl: "/de/support", privacyUrl: "/de/privacy" },
    es: { help: "Ayuda", privacy: "Privacidad", helpUrl: "/es/support", privacyUrl: "/es/privacy" },
    fr: { help: "Aide", privacy: "Confidentialité", helpUrl: "/fr/support", privacyUrl: "/fr/privacy" },
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
          <a href="https://photoportugal.com" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
            <img src="https://photoportugal.com/logo-icon.png" width="28" height="28" alt="" style="border-radius:6px;">
            <span style="font-size:17px;font-weight:700;color:#1F1F1F;letter-spacing:-0.3px;">Photo Portugal</span>
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
                <a href="https://photoportugal.com" style="color:#9B8E82;text-decoration:none;font-weight:500;">photoportugal.com</a>
              </td>
              <td align="right" style="font-size:13px;color:#C4B8AD;">
                <a href="https://photoportugal.com${L.helpUrl}" style="color:#C4B8AD;text-decoration:none;">${L.help}</a>
                <span style="margin:0 6px;">·</span>
                <a href="https://photoportugal.com${L.privacyUrl}" style="color:#C4B8AD;text-decoration:none;">${L.privacy}</a>
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
  }, loc);

  const cover = photographer.cover_url
    ? `<img src="${photographer.cover_url}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin-bottom:16px;" />`
    : "";

  const priceLine = photographer.min_price
    ? `<p style="margin:4px 0 0;font-size:14px;color:#4A4A4A;">${T.from} <strong>€${Math.round(photographer.min_price)}</strong></p>`
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
  <p style="margin:0;font-size:12px;color:#9B8E82;">— ${name} · <a href="https://photoportugal.com/photographers/${row.photographer_slug}" style="color:#C94536;text-decoration:none;">${row.photographer_name}</a></p>
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
  shootDate: string | null
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);
  const clientFirstName = clientName.split(" ")[0];

  const T = pickT({
    en: { subject: `New booking request from ${clientFirstName}`, h2: "New Booking Request", greeting: `Hi ${photographerName},`, body: `<strong>${clientFirstName}</strong> has requested a photoshoot${packageName ? ` (${packageName})` : ""}${shootDate ? ` on ${shootDate}` : ""}.`, cta: "View Booking" },
    pt: { subject: `Novo pedido de reserva de ${clientFirstName}`, h2: "Novo Pedido de Reserva", greeting: `Olá ${photographerName},`, body: `<strong>${clientFirstName}</strong> pediu uma sessão fotográfica${packageName ? ` (${packageName})` : ""}${shootDate ? ` a ${shootDate}` : ""}.`, cta: "Ver Reserva" },
    de: { subject: `Neue Buchungsanfrage von ${clientFirstName}`, h2: "Neue Buchungsanfrage", greeting: `Hallo ${photographerName},`, body: `<strong>${clientFirstName}</strong> hat ein Fotoshooting angefragt${packageName ? ` (${packageName})` : ""}${shootDate ? ` am ${shootDate}` : ""}.`, cta: "Buchung ansehen" },
    es: { subject: `Nueva solicitud de reserva de ${clientFirstName}`, h2: "Nueva solicitud de reserva", greeting: `Hola ${photographerName},`, body: `<strong>${clientFirstName}</strong> ha solicitado una sesión fotográfica${packageName ? ` (${packageName})` : ""}${shootDate ? ` el ${shootDate}` : ""}.`, cta: "Ver reserva" },
    fr: { subject: `Nouvelle demande de réservation de ${clientFirstName}`, h2: "Nouvelle demande de réservation", greeting: `Bonjour ${photographerName},`, body: `<strong>${clientFirstName}</strong> a demandé une séance photo${packageName ? ` (${packageName})` : ""}${shootDate ? ` le ${shootDate}` : ""}.`, cta: "Voir la réservation" },
  }, locale);

  await sendEmail(
    photographerEmail,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
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
  const firstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `Booking request sent to ${photographerName}`,
      h2: "Booking Request Sent!",
      greeting: `Hi ${firstName},`,
      body: `Your booking request has been sent to <strong>${photographerName}</strong>${packageName ? ` for ${packageName}` : ""}${shootDate ? ` on ${shootDate}` : ""}.`,
      nextLabel: "What happens next?",
      next: `${photographerName} will review your request and get back to you shortly. You can also message them directly to discuss details.`,
      cta: "View Your Booking",
    },
    pt: {
      subject: `Pedido de reserva enviado a ${photographerName}`,
      h2: "Pedido de Reserva Enviado!",
      greeting: `Olá ${firstName},`,
      body: `O seu pedido de reserva foi enviado a <strong>${photographerName}</strong>${packageName ? ` para ${packageName}` : ""}${shootDate ? ` a ${shootDate}` : ""}.`,
      nextLabel: "O que acontece a seguir?",
      next: `${photographerName} irá analisar o seu pedido e responder em breve. Pode também enviar-lhe uma mensagem directa para combinar os detalhes.`,
      cta: "Ver a Sua Reserva",
    },
    de: {
      subject: `Buchungsanfrage an ${photographerName} gesendet`,
      h2: "Buchungsanfrage gesendet!",
      greeting: `Hallo ${firstName},`,
      body: `Ihre Buchungsanfrage wurde an <strong>${photographerName}</strong>${packageName ? ` für ${packageName}` : ""}${shootDate ? ` am ${shootDate}` : ""} gesendet.`,
      nextLabel: "Wie geht es weiter?",
      next: `${photographerName} wird Ihre Anfrage prüfen und sich in Kürze bei Ihnen melden. Sie können dem Fotografen auch direkt eine Nachricht senden, um Details zu besprechen.`,
      cta: "Buchung anzeigen",
    },
    fr: {
      subject: `Demande de réservation envoyée à ${photographerName}`,
      h2: "Demande de réservation envoyée !",
      greeting: `Bonjour ${firstName},`,
      body: `Votre demande de réservation a été envoyée à <strong>${photographerName}</strong>${packageName ? ` pour ${packageName}` : ""}${shootDate ? ` le ${shootDate}` : ""}.`,
      nextLabel: "Que se passe-t-il ensuite ?",
      next: `${photographerName} examinera votre demande et reviendra vers vous rapidement. Vous pouvez aussi lui envoyer un message directement pour discuter des détails.`,
      cta: "Voir votre réservation",
    },
    es: {
      subject: `Solicitud de reserva enviada a ${photographerName}`,
      h2: "¡Solicitud de reserva enviada!",
      greeting: `Hola ${firstName},`,
      body: `Su solicitud de reserva ha sido enviada a <strong>${photographerName}</strong>${packageName ? ` para ${packageName}` : ""}${shootDate ? ` el ${shootDate}` : ""}.`,
      nextLabel: "¿Qué pasa ahora?",
      next: `${photographerName} revisará su solicitud y le responderá en breve. También puede enviarle un mensaje directo para acordar los detalles.`,
      cta: "Ver su reserva",
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
  const price = totalPrice ? Math.round(Number(totalPrice)) : null;
  const firstName = clientName.split(" ")[0];

  const T = pickT({
    en: {
      subject: `${photographerName} confirmed your booking${totalPrice ? ` — pay now to secure` : ""}!`,
      h2: "Booking Confirmed!",
      greeting: `Hi ${firstName},`,
      confirmed: `<strong>${photographerName}</strong> has confirmed your photoshoot${shootDate ? ` on ${shootDate}` : ""}.`,
      paymentLabel: "Payment required:",
      paymentBody: (priceStr: string) => `Please pay ${priceStr} to secure your session. Your payment is held safely until you receive and accept your photos.`,
      payNow: (priceStr: string) => `Pay Now — ${priceStr}`,
      viewBooking: "View Booking",
      tipLabel: "Tip:",
      tip: "We also recommend messaging your photographer to discuss meeting point, outfit ideas, and any special requests.",
      cta: "Open Messages",
    },
    pt: {
      subject: `${photographerName} confirmou a sua reserva${totalPrice ? ` — pague agora para garantir` : ""}!`,
      h2: "Reserva Confirmada!",
      greeting: `Olá ${firstName},`,
      confirmed: `<strong>${photographerName}</strong> confirmou a sua sessão fotográfica${shootDate ? ` a ${shootDate}` : ""}.`,
      paymentLabel: "Pagamento necessário:",
      paymentBody: (priceStr: string) => `Por favor, pague ${priceStr} para garantir a sua sessão. O pagamento fica guardado em segurança até receber e aceitar as suas fotos.`,
      payNow: (priceStr: string) => `Pagar Agora — ${priceStr}`,
      viewBooking: "Ver Reserva",
      tipLabel: "Dica:",
      tip: "Recomendamos também enviar uma mensagem ao seu fotógrafo para combinar o ponto de encontro, ideias de outfit e quaisquer pedidos especiais.",
      cta: "Abrir Mensagens",
    },
    de: {
      subject: `${photographerName} hat Ihre Buchung bestätigt${totalPrice ? ` — jetzt bezahlen, um sie zu sichern` : ""}!`,
      h2: "Buchung bestätigt!",
      greeting: `Hallo ${firstName},`,
      confirmed: `<strong>${photographerName}</strong> hat Ihr Fotoshooting${shootDate ? ` am ${shootDate}` : ""} bestätigt.`,
      paymentLabel: "Zahlung erforderlich:",
      paymentBody: (priceStr: string) => `Bitte zahlen Sie ${priceStr}, um Ihren Termin zu sichern. Ihre Zahlung wird sicher verwahrt, bis Sie Ihre Fotos erhalten und annehmen.`,
      payNow: (priceStr: string) => `Jetzt bezahlen — ${priceStr}`,
      viewBooking: "Buchung anzeigen",
      tipLabel: "Tipp:",
      tip: "Wir empfehlen, Ihrem Fotografen eine Nachricht zu senden, um Treffpunkt, Outfit-Ideen und Sonderwünsche zu besprechen.",
      cta: "Nachrichten öffnen",
    },
    fr: {
      subject: `${photographerName} a confirmé votre réservation${totalPrice ? ` — payez maintenant pour la sécuriser` : ""} !`,
      h2: "Réservation confirmée !",
      greeting: `Bonjour ${firstName},`,
      confirmed: `<strong>${photographerName}</strong> a confirmé votre séance photo${shootDate ? ` le ${shootDate}` : ""}.`,
      paymentLabel: "Paiement requis :",
      paymentBody: (priceStr: string) => `Veuillez payer ${priceStr} pour sécuriser votre séance. Votre paiement est conservé en sécurité jusqu'à ce que vous receviez et acceptiez vos photos.`,
      payNow: (priceStr: string) => `Payer maintenant — ${priceStr}`,
      viewBooking: "Voir la réservation",
      tipLabel: "Astuce :",
      tip: "Nous recommandons aussi d'envoyer un message à votre photographe pour discuter du point de rencontre, des idées de tenue et de toute demande spéciale.",
      cta: "Ouvrir les messages",
    },
    es: {
      subject: `¡${photographerName} confirmó su reserva${totalPrice ? ` — pague ahora para asegurarla` : ""}!`,
      h2: "¡Reserva confirmada!",
      greeting: `Hola ${firstName},`,
      confirmed: `<strong>${photographerName}</strong> ha confirmado su sesión fotográfica${shootDate ? ` el ${shootDate}` : ""}.`,
      paymentLabel: "Pago requerido:",
      paymentBody: (priceStr: string) => `Por favor pague ${priceStr} para asegurar su sesión. Su pago queda guardado de forma segura hasta que reciba y acepte sus fotos.`,
      payNow: (priceStr: string) => `Pagar ahora — ${priceStr}`,
      viewBooking: "Ver reserva",
      tipLabel: "Consejo:",
      tip: "Le recomendamos también enviar un mensaje a su fotógrafo para acordar el punto de encuentro, ideas de outfit y cualquier petición especial.",
      cta: "Abrir mensajes",
    },
  }, locale);

  const priceStr = price ? formatPrice(price, locale) : "";
  const paymentSection = paymentUrl && price
    ? `<div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${T.paymentLabel}</strong> ${T.paymentBody(priceStr)}</p>
      </div>
      ${emailButton(paymentUrl, T.payNow(priceStr), "#16A34A")}`
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

  await sendEmail(
    photographerEmail,
    `Payment received from ${firstName} — €${amount}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Received!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${photographerName},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${firstName}</strong> has paid <strong>&euro;${amount}</strong> for their booking.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">The funds are held securely until the client accepts the photo delivery.</p>
      ${contactSection}
      ${emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking")}
    `)
  );
}

export async function sendPaymentConfirmedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  amount: number
) {
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
  payoutAmount: number
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(photographerEmail);
  const clientFirstName = clientName.split(" ")[0];
  const amount = `&euro;${payoutAmount.toFixed(2)}`;

  const T = pickT({
    en: { subject: `${clientFirstName} accepted delivery — €${payoutAmount.toFixed(2)} transferred to you`, h2: "Payment Transferred!", greeting: `Hi ${photographerName},`, body1: `<strong>${clientFirstName}</strong> has accepted the photo delivery. A payment of <strong style="color:#16A34A;">${amount}</strong> has been transferred to your Stripe account.`, body2: "The funds should arrive in your bank account within 2-7 business days, depending on your Stripe payout schedule.", cta: "View Dashboard", reviewPrompt: "Enjoyed working with this client? Leave a quick review to help build your reputation on the platform:", reviewCta: "Leave a Review" },
    pt: { subject: `${clientFirstName} aceitou a entrega — €${payoutAmount.toFixed(2)} transferidos para si`, h2: "Pagamento Transferido!", greeting: `Olá ${photographerName},`, body1: `<strong>${clientFirstName}</strong> aceitou a entrega das fotografias. Um pagamento de <strong style="color:#16A34A;">${amount}</strong> foi transferido para a sua conta Stripe.`, body2: "Os fundos chegam à sua conta bancária em 2-7 dias úteis, consoante o seu calendário de pagamentos Stripe.", cta: "Ver Dashboard", reviewPrompt: "Gostou de trabalhar com este cliente? Deixe uma avaliação para reforçar a sua reputação na plataforma:", reviewCta: "Deixar Avaliação" },
    de: { subject: `${clientFirstName} hat die Lieferung angenommen — €${payoutAmount.toFixed(2)} an Sie überwiesen`, h2: "Zahlung überwiesen!", greeting: `Hallo ${photographerName},`, body1: `<strong>${clientFirstName}</strong> hat die Fotolieferung angenommen. Eine Zahlung von <strong style="color:#16A34A;">${amount}</strong> wurde auf Ihr Stripe-Konto überwiesen.`, body2: "Die Mittel sollten innerhalb von 2-7 Werktagen auf Ihrem Bankkonto eintreffen, je nach Ihrem Stripe-Auszahlungsplan.", cta: "Dashboard ansehen", reviewPrompt: "Hat Ihnen die Zusammenarbeit gefallen? Hinterlassen Sie eine kurze Bewertung, um Ihre Reputation auf der Plattform zu stärken:", reviewCta: "Bewertung abgeben" },
    es: { subject: `${clientFirstName} aceptó la entrega — €${payoutAmount.toFixed(2)} transferidos a usted`, h2: "¡Pago transferido!", greeting: `Hola ${photographerName},`, body1: `<strong>${clientFirstName}</strong> ha aceptado la entrega de las fotos. Un pago de <strong style="color:#16A34A;">${amount}</strong> ha sido transferido a su cuenta de Stripe.`, body2: "Los fondos deberían llegar a su cuenta bancaria en 2-7 días hábiles, según el calendario de pagos de Stripe.", cta: "Ver dashboard", reviewPrompt: "¿Disfrutó trabajando con este cliente? Deje una breve reseña para reforzar su reputación en la plataforma:", reviewCta: "Dejar reseña" },
    fr: { subject: `${clientFirstName} a accepté la livraison — €${payoutAmount.toFixed(2)} transférés vers vous`, h2: "Paiement transféré !", greeting: `Bonjour ${photographerName},`, body1: `<strong>${clientFirstName}</strong> a accepté la livraison des photos. Un paiement de <strong style="color:#16A34A;">${amount}</strong> a été transféré sur votre compte Stripe.`, body2: "Les fonds devraient arriver sur votre compte bancaire sous 2-7 jours ouvrés, selon votre calendrier de versement Stripe.", cta: "Voir le tableau de bord", reviewPrompt: "Vous avez apprécié travailler avec ce client ? Laissez un court avis pour renforcer votre réputation sur la plateforme :", reviewCta: "Laisser un avis" },
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
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.reviewPrompt}</p>
      ${emailButton(localizedUrl("/dashboard/bookings", locale, BASE_URL), T.reviewCta, "#3B82F6")}
    `, locale)
  );
}

export async function sendDeliveryAcceptedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  const firstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `Delivery accepted — thank you!`,
      h2: "Thank You!",
      greeting: `Hi ${firstName},`,
      body: `You've accepted the photo delivery from <strong>${photographerName}</strong>. We hope you love your photos!`,
      downloadNote: `Your photos will be available for download for <strong>90 days</strong>. Make sure to download them before then!`,
      reviewIntro: "If you enjoyed your experience, we'd love to hear from you! Reviews help other travelers discover Photo Portugal.",
      reviewOnLabel: "Leave a review on:",
      googleCta: "⭐ Review us on Google",
      ppCta: `Review ${photographerName} on Photo Portugal`,
    },
    pt: {
      subject: `Entrega aceite — obrigado!`,
      h2: "Obrigado!",
      greeting: `Olá ${firstName},`,
      body: `Aceitou a entrega das fotos de <strong>${photographerName}</strong>. Esperamos que adore as suas fotos!`,
      downloadNote: `As suas fotos ficarão disponíveis para download durante <strong>90 dias</strong>. Não se esqueça de as descarregar antes desse prazo!`,
      reviewIntro: "Se gostou da experiência, adorávamos ouvir a sua opinião! As avaliações ajudam outros viajantes a descobrir a Photo Portugal.",
      reviewOnLabel: "Deixe uma avaliação em:",
      googleCta: "⭐ Avalie-nos no Google",
      ppCta: `Avaliar ${photographerName} na Photo Portugal`,
    },
    de: {
      subject: `Lieferung angenommen — vielen Dank!`,
      h2: "Vielen Dank!",
      greeting: `Hallo ${firstName},`,
      body: `Sie haben die Fotolieferung von <strong>${photographerName}</strong> angenommen. Wir hoffen, dass Ihnen Ihre Fotos gefallen!`,
      downloadNote: `Ihre Fotos stehen <strong>90 Tage</strong> zum Download bereit. Bitte laden Sie sie vorher herunter!`,
      reviewIntro: "Wenn Ihnen die Erfahrung gefallen hat, würden wir gerne von Ihnen hören! Bewertungen helfen anderen Reisenden, Photo Portugal zu entdecken.",
      reviewOnLabel: "Bewertung abgeben auf:",
      googleCta: "⭐ Bewerten Sie uns auf Google",
      ppCta: `${photographerName} auf Photo Portugal bewerten`,
    },
    fr: {
      subject: `Livraison acceptée — merci !`,
      h2: "Merci !",
      greeting: `Bonjour ${firstName},`,
      body: `Vous avez accepté la livraison des photos de <strong>${photographerName}</strong>. Nous espérons que vous adorez vos photos !`,
      downloadNote: `Vos photos seront disponibles au téléchargement pendant <strong>90 jours</strong>. Pensez à les télécharger avant cette date !`,
      reviewIntro: "Si vous avez aimé votre expérience, nous serions ravis d'avoir votre retour ! Les avis aident d'autres voyageurs à découvrir Photo Portugal.",
      reviewOnLabel: "Laissez un avis sur :",
      googleCta: "⭐ Évaluez-nous sur Google",
      ppCta: `Évaluer ${photographerName} sur Photo Portugal`,
    },
    es: {
      subject: `Entrega aceptada — ¡gracias!`,
      h2: "¡Gracias!",
      greeting: `Hola ${firstName},`,
      body: `Ha aceptado la entrega de las fotos de <strong>${photographerName}</strong>. ¡Esperamos que le encanten sus fotos!`,
      downloadNote: `Sus fotos estarán disponibles para descarga durante <strong>90 días</strong>. ¡Asegúrese de descargarlas antes!`,
      reviewIntro: "Si disfrutó la experiencia, ¡nos encantaría conocer su opinión! Las reseñas ayudan a otros viajeros a descubrir Photo Portugal.",
      reviewOnLabel: "Deje una reseña en:",
      googleCta: "⭐ Reséñenos en Google",
      ppCta: `Reseñar a ${photographerName} en Photo Portugal`,
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
  photographerName: string
) {
  const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
  const firstName = clientName.split(" ")[0];
  const T = pickT({
    en: {
      subject: `One last thing, ${clientName} — it means a lot to us`,
      h2: "Thank You for Your Review!",
      greeting: `Hi ${firstName},`,
      body1: `We really appreciate you sharing your experience with <strong>${photographerName}</strong> on our platform.`,
      body2: "We have one small favour to ask — it would mean the world to our small business if you could leave a quick review on Google or Trustpilot. It takes less than a minute and helps other travelers discover Photo Portugal:",
      googleCta: "Review Us on Google",
      trustpilotCta: "Review Us on Trustpilot",
      footer: "Even a few words make a huge difference. Thank you for supporting independent photography in Portugal!",
    },
    pt: {
      subject: `Mais uma coisa, ${clientName} — significa muito para nós`,
      h2: "Obrigado pela Sua Avaliação!",
      greeting: `Olá ${firstName},`,
      body1: `Agradecemos imenso por partilhar a sua experiência com <strong>${photographerName}</strong> na nossa plataforma.`,
      body2: "Temos um pequeno favor a pedir — significaria o mundo para o nosso pequeno negócio se pudesse deixar uma breve avaliação no Google ou Trustpilot. Demora menos de um minuto e ajuda outros viajantes a descobrir a Photo Portugal:",
      googleCta: "Avalie-nos no Google",
      trustpilotCta: "Avalie-nos no Trustpilot",
      footer: "Mesmo algumas palavras fazem uma enorme diferença. Obrigado por apoiar a fotografia independente em Portugal!",
    },
    de: {
      subject: `Eine letzte Sache, ${clientName} — es bedeutet uns viel`,
      h2: "Vielen Dank für Ihre Bewertung!",
      greeting: `Hallo ${firstName},`,
      body1: `Wir freuen uns sehr, dass Sie Ihre Erfahrung mit <strong>${photographerName}</strong> auf unserer Plattform geteilt haben.`,
      body2: "Wir haben eine kleine Bitte — es würde unserem kleinen Unternehmen sehr viel bedeuten, wenn Sie eine kurze Bewertung auf Google oder Trustpilot hinterlassen könnten. Es dauert weniger als eine Minute und hilft anderen Reisenden, Photo Portugal zu entdecken:",
      googleCta: "Bewerten Sie uns auf Google",
      trustpilotCta: "Bewerten Sie uns auf Trustpilot",
      footer: "Schon ein paar Worte machen einen riesigen Unterschied. Vielen Dank, dass Sie unabhängige Fotografie in Portugal unterstützen!",
    },
    fr: {
      subject: `Une dernière chose, ${clientName} — cela compte beaucoup pour nous`,
      h2: "Merci pour votre avis !",
      greeting: `Bonjour ${firstName},`,
      body1: `Nous apprécions vraiment que vous ayez partagé votre expérience avec <strong>${photographerName}</strong> sur notre plateforme.`,
      body2: "Nous avons une petite faveur à demander — cela signifierait énormément pour notre petite entreprise si vous pouviez laisser un court avis sur Google ou Trustpilot. Cela prend moins d'une minute et aide d'autres voyageurs à découvrir Photo Portugal :",
      googleCta: "Évaluez-nous sur Google",
      trustpilotCta: "Évaluez-nous sur Trustpilot",
      footer: "Même quelques mots font une énorme différence. Merci de soutenir la photographie indépendante au Portugal !",
    },
    es: {
      subject: `Una última cosa, ${clientName} — significa mucho para nosotros`,
      h2: "¡Gracias por su reseña!",
      greeting: `Hola ${firstName},`,
      body1: `Apreciamos enormemente que haya compartido su experiencia con <strong>${photographerName}</strong> en nuestra plataforma.`,
      body2: "Tenemos un pequeño favor que pedirle — significaría muchísimo para nuestro pequeño negocio si pudiera dejar una breve reseña en Google o Trustpilot. Lleva menos de un minuto y ayuda a otros viajeros a descubrir Photo Portugal:",
      googleCta: "Reséñenos en Google",
      trustpilotCta: "Reséñenos en Trustpilot",
      footer: "Incluso unas pocas palabras marcan una gran diferencia. ¡Gracias por apoyar la fotografía independiente en Portugal!",
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
      ${emailButton("https://www.trustpilot.com/evaluate/photoportugal.com", T.trustpilotCta, "#16A34A")}
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
    en: { subject: `Quick favour, ${photographerName}?`, h2: "Help Us Grow!", greeting: `Hi ${photographerName},`, body1: "Thank you for being part of Photo Portugal. Your work is what makes this platform great.", body2: "We'd love it if you could share your experience as a photographer on Google or Trustpilot. A genuine review from a professional like you helps build trust and brings more clients to the platform — which means more bookings for everyone:", googleCta: "Review Us on Google", trustpilotCta: "Review Us on Trustpilot", footer: "It takes less than a minute. Thank you for your support!" },
    pt: { subject: `Pequeno favor, ${photographerName}?`, h2: "Ajude-nos a Crescer!", greeting: `Olá ${photographerName},`, body1: "Obrigado por fazer parte da Photo Portugal. O seu trabalho é o que torna esta plataforma especial.", body2: "Adorávamos que partilhasse a sua experiência como fotógrafo no Google ou Trustpilot. Uma avaliação genuína de um profissional como o(a) ajuda a construir confiança e atrai mais clientes — o que significa mais reservas para todos:", googleCta: "Avalie-nos no Google", trustpilotCta: "Avalie-nos no Trustpilot", footer: "Demora menos de um minuto. Obrigado pelo seu apoio!" },
    de: { subject: `Kleiner Gefallen, ${photographerName}?`, h2: "Helfen Sie uns zu wachsen!", greeting: `Hallo ${photographerName},`, body1: "Vielen Dank, dass Sie Teil von Photo Portugal sind. Ihre Arbeit macht diese Plattform großartig.", body2: "Wir würden uns sehr freuen, wenn Sie Ihre Erfahrung als Fotograf auf Google oder Trustpilot teilen. Eine ehrliche Bewertung von einem Profi wie Ihnen schafft Vertrauen und bringt mehr Kunden auf die Plattform — was mehr Buchungen für alle bedeutet:", googleCta: "Bewerten Sie uns auf Google", trustpilotCta: "Bewerten Sie uns auf Trustpilot", footer: "Es dauert weniger als eine Minute. Danke für Ihre Unterstützung!" },
    es: { subject: `Un pequeño favor, ${photographerName}`, h2: "¡Ayúdenos a crecer!", greeting: `Hola ${photographerName},`, body1: "Gracias por formar parte de Photo Portugal. Su trabajo es lo que hace que esta plataforma sea genial.", body2: "Nos encantaría que compartiera su experiencia como fotógrafo en Google o Trustpilot. Una reseña genuina de un profesional como usted genera confianza y atrae más clientes a la plataforma — lo que significa más reservas para todos:", googleCta: "Reséñenos en Google", trustpilotCta: "Reséñenos en Trustpilot", footer: "Lleva menos de un minuto. ¡Gracias por su apoyo!" },
    fr: { subject: `Un petit service, ${photographerName} ?`, h2: "Aidez-nous à grandir !", greeting: `Bonjour ${photographerName},`, body1: "Merci de faire partie de Photo Portugal. Votre travail est ce qui fait la grandeur de cette plateforme.", body2: "Nous adorerions que vous partagiez votre expérience en tant que photographe sur Google ou Trustpilot. Un avis authentique d'un professionnel comme vous renforce la confiance et attire plus de clients — ce qui signifie plus de réservations pour tout le monde :", googleCta: "Évaluez-nous sur Google", trustpilotCta: "Évaluez-nous sur Trustpilot", footer: "Cela prend moins d'une minute. Merci de votre soutien !" },
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
      ${emailButton("https://www.trustpilot.com/evaluate/photoportugal.com", T.trustpilotCta, "#16A34A")}
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
      subject: "Reset your Photo Portugal password",
      h2: "Reset Your Password",
      greeting: `Hi ${firstName},`,
      body: "We received a request to reset your password. Click the button below to set a new one:",
      cta: "Reset Password",
      footer: "This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.",
    },
    pt: {
      subject: "Redefinir a sua palavra-passe da Photo Portugal",
      h2: "Redefinir a Sua Palavra-passe",
      greeting: `Olá ${firstName},`,
      body: "Recebemos um pedido para redefinir a sua palavra-passe. Clique no botão abaixo para definir uma nova:",
      cta: "Redefinir Palavra-passe",
      footer: "Esta ligação expira em 30 minutos. Se não pediu a redefinição da palavra-passe, pode ignorar este email.",
    },
    de: {
      subject: "Setzen Sie Ihr Photo Portugal Passwort zurück",
      h2: "Passwort zurücksetzen",
      greeting: `Hallo ${firstName},`,
      body: "Wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf die Schaltfläche unten, um ein neues festzulegen:",
      cta: "Passwort zurücksetzen",
      footer: "Dieser Link läuft in 30 Minuten ab. Wenn Sie kein Zurücksetzen des Passworts angefordert haben, können Sie diese E-Mail ignorieren.",
    },
    fr: {
      subject: "Réinitialisez votre mot de passe Photo Portugal",
      h2: "Réinitialisez votre mot de passe",
      greeting: `Bonjour ${firstName},`,
      body: "Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau :",
      cta: "Réinitialiser le mot de passe",
      footer: "Ce lien expire dans 30 minutes. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail.",
    },
    es: {
      subject: "Restablezca su contraseña de Photo Portugal",
      h2: "Restablezca su contraseña",
      greeting: `Hola ${firstName},`,
      body: "Hemos recibido una solicitud para restablecer su contraseña. Haga clic en el botón de abajo para crear una nueva:",
      cta: "Restablecer contraseña",
      footer: "Este enlace caduca en 30 minutos. Si no solicitó el restablecimiento, puede ignorar este correo.",
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
      subject: "Verify your email — Photo Portugal",
      h2: "Verify Your Email",
      greeting: `Hi ${firstName},`,
      body: "Thank you for signing up! Please verify your email address to activate your account:",
      cta: "Verify Email Address",
      footer: "This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.",
    },
    pt: {
      subject: "Verifique o seu email — Photo Portugal",
      h2: "Verifique o Seu Email",
      greeting: `Olá ${firstName},`,
      body: "Obrigado por se registar! Por favor, verifique o seu endereço de email para activar a sua conta:",
      cta: "Verificar Endereço de Email",
      footer: "Esta ligação expira em 24 horas. Se não criou uma conta, pode ignorar este email.",
    },
    de: {
      subject: "Bestätigen Sie Ihre E-Mail — Photo Portugal",
      h2: "Bestätigen Sie Ihre E-Mail",
      greeting: `Hallo ${firstName},`,
      body: "Vielen Dank für Ihre Anmeldung! Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren:",
      cta: "E-Mail-Adresse bestätigen",
      footer: "Dieser Link läuft in 24 Stunden ab. Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.",
    },
    fr: {
      subject: "Vérifiez votre e-mail — Photo Portugal",
      h2: "Vérifiez votre e-mail",
      greeting: `Bonjour ${firstName},`,
      body: "Merci de votre inscription ! Veuillez vérifier votre adresse e-mail pour activer votre compte :",
      cta: "Vérifier l'adresse e-mail",
      footer: "Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
    },
    es: {
      subject: "Verifique su correo — Photo Portugal",
      h2: "Verifique su correo",
      greeting: `Hola ${firstName},`,
      body: "¡Gracias por registrarse! Verifique su dirección de correo para activar su cuenta:",
      cta: "Verificar dirección de correo",
      footer: "Este enlace caduca en 24 horas. Si no creó una cuenta, puede ignorar este correo.",
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
      "Welcome to Photo Portugal — Let's get you started!",
      emailLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Welcome to Photo Portugal!</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${name.split(" ")[0]},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for joining Photo Portugal! We're excited to have you on the platform. Here's how to get your profile live and start receiving bookings:</p>

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
            <tr><td style="padding:4px 0;vertical-align:top;">2.</td><td style="padding:4px 8px;"><strong>Never work with clients off-platform</strong> — soliciting clients outside Photo Portugal or accepting direct payments results in a permanent ban</td></tr>
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
        subject: "Welcome to Photo Portugal!",
        h2: "Welcome to Photo Portugal!",
        greeting: `Hi ${firstName},`,
        intro: "You're all set! Here's how to book your perfect photoshoot in Portugal:",
        s1Title: "Browse photographers",
        s1Body: "Find your style in Lisbon, Porto, Algarve, and 20 more locations",
        s2Title: "Pick a package",
        s2Body: "Choose the session length and number of photos",
        s3Title: "Book &amp; pay securely",
        s3Body: "Your payment is held in escrow until you approve the photos",
        cta: "Browse Photographers",
        footerHtml: `Questions? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visit our Help Center</a> or <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contact us</a>.`,
      },
      pt: {
        subject: "Bem-vindo à Photo Portugal!",
        h2: "Bem-vindo à Photo Portugal!",
        greeting: `Olá ${firstName},`,
        intro: "Está tudo pronto! Veja como reservar a sua sessão fotográfica perfeita em Portugal:",
        s1Title: "Explore os fotógrafos",
        s1Body: "Encontre o seu estilo em Lisboa, Porto, Algarve e mais 20 localizações",
        s2Title: "Escolha um pacote",
        s2Body: "Escolha a duração da sessão e o número de fotos",
        s3Title: "Reserve e pague em segurança",
        s3Body: "O seu pagamento fica em garantia até aprovar as fotos",
        cta: "Explorar Fotógrafos",
        footerHtml: `Dúvidas? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visite o nosso Centro de Ajuda</a> ou <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contacte-nos</a>.`,
      },
      de: {
        subject: "Willkommen bei Photo Portugal!",
        h2: "Willkommen bei Photo Portugal!",
        greeting: `Hallo ${firstName},`,
        intro: "Alles bereit! So buchen Sie Ihr perfektes Fotoshooting in Portugal:",
        s1Title: "Fotografen entdecken",
        s1Body: "Finden Sie Ihren Stil in Lissabon, Porto, Algarve und 20 weiteren Orten",
        s2Title: "Paket auswählen",
        s2Body: "Wählen Sie Dauer und Anzahl der Fotos",
        s3Title: "Sicher buchen und bezahlen",
        s3Body: "Ihre Zahlung wird treuhänderisch verwahrt, bis Sie die Fotos freigeben",
        cta: "Fotografen entdecken",
        footerHtml: `Fragen? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Besuchen Sie unser Hilfecenter</a> oder <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">kontaktieren Sie uns</a>.`,
      },
      fr: {
        subject: "Bienvenue sur Photo Portugal !",
        h2: "Bienvenue sur Photo Portugal !",
        greeting: `Bonjour ${firstName},`,
        intro: "Tout est prêt ! Voici comment réserver votre séance photo idéale au Portugal :",
        s1Title: "Parcourir les photographes",
        s1Body: "Trouvez votre style à Lisbonne, Porto, Algarve et 20+ autres lieux",
        s2Title: "Choisir un forfait",
        s2Body: "Sélectionnez la durée de la séance et le nombre de photos",
        s3Title: "Réserver et payer en sécurité",
        s3Body: "Votre paiement est conservé sous séquestre jusqu'à validation des photos",
        cta: "Parcourir les photographes",
        footerHtml: `Des questions ? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visitez notre Centre d'aide</a> ou <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contactez-nous</a>.`,
      },
      es: {
        subject: "¡Bienvenido a Photo Portugal!",
        h2: "¡Bienvenido a Photo Portugal!",
        greeting: `Hola ${firstName},`,
        intro: "¡Todo listo! Así puede reservar su sesión fotográfica ideal en Portugal:",
        s1Title: "Explorar fotógrafos",
        s1Body: "Encuentre su estilo en Lisboa, Oporto, Algarve y 20+ ubicaciones más",
        s2Title: "Elegir un paquete",
        s2Body: "Seleccione la duración de la sesión y el número de fotos",
        s3Title: "Reservar y pagar de forma segura",
        s3Body: "Su pago queda en custodia hasta que apruebe las fotos",
        cta: "Explorar fotógrafos",
        footerHtml: `¿Preguntas? <a href="${localizedUrl("/support", locale, BASE_URL)}" style="color:#C94536;">Visite nuestro Centro de ayuda</a> o <a href="${localizedUrl("/contact", locale, BASE_URL)}" style="color:#C94536;">contáctenos</a>.`,
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
    upgraded: `Welcome to Photo Portugal ${plan}!`,
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
async function sendToAllAdmins(subject: string, html: string) {
  const adminEmail = await getAdminEmail();
  const emails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
  await Promise.allSettled(emails.map((email) => sendEmail(email, subject, html)));
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
  shootDate: string | null
) {
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
      `)
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
  const priceStr = totalPrice ? formatPrice(Number(totalPrice), locale) : "";
  const T = pickT({
    en: {
      subject: `Reminder: Complete your payment for the session with ${photographerName}`,
      h2: "Payment Reminder",
      greeting: `Hi ${firstName},`,
      body1: `Your booking with <strong>${photographerName}</strong> has been confirmed, but we haven't received your payment yet.`,
      body2: "Please complete your payment to secure your photoshoot session.",
      payNow: `Pay Now — ${priceStr}`,
      viewBooking: "View Booking",
    },
    pt: {
      subject: `Lembrete: complete o pagamento da sessão com ${photographerName}`,
      h2: "Lembrete de pagamento",
      greeting: `Olá ${firstName},`,
      body1: `A sua reserva com <strong>${photographerName}</strong> foi confirmada, mas ainda não recebemos o pagamento.`,
      body2: "Por favor complete o pagamento para garantir a sua sessão fotográfica.",
      payNow: `Pagar agora — ${priceStr}`,
      viewBooking: "Ver reserva",
    },
    de: {
      subject: `Erinnerung: Schließen Sie die Zahlung für die Session mit ${photographerName} ab`,
      h2: "Zahlungserinnerung",
      greeting: `Hallo ${firstName},`,
      body1: `Ihre Buchung mit <strong>${photographerName}</strong> wurde bestätigt, aber wir haben die Zahlung noch nicht erhalten.`,
      body2: "Bitte schließen Sie die Zahlung ab, um Ihren Fototermin zu sichern.",
      payNow: `Jetzt bezahlen — ${priceStr}`,
      viewBooking: "Buchung anzeigen",
    },
    es: {
      subject: `Recordatorio: complete el pago de la sesión con ${photographerName}`,
      h2: "Recordatorio de pago",
      greeting: `Hola ${firstName},`,
      body1: `Su reserva con <strong>${photographerName}</strong> ha sido confirmada, pero aún no hemos recibido el pago.`,
      body2: "Por favor complete el pago para asegurar su sesión de fotos.",
      payNow: `Pagar ahora — ${priceStr}`,
      viewBooking: "Ver reserva",
    },
    fr: {
      subject: `Rappel : complétez le paiement de la séance avec ${photographerName}`,
      h2: "Rappel de paiement",
      greeting: `Bonjour ${firstName},`,
      body1: `Votre réservation avec <strong>${photographerName}</strong> a été confirmée, mais nous n'avons pas encore reçu le paiement.`,
      body2: "Veuillez compléter le paiement pour sécuriser votre séance photo.",
      payNow: `Payer maintenant — ${priceStr}`,
      viewBooking: "Voir la réservation",
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
      ${ctaSection}
    `, locale)
  );
}

export async function sendShootReminderToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string,
  shootDate: string
) {
  const { getUserLocaleByEmail, pickT, localizedUrl } = await import("@/lib/email-locale");
  const locale = await getUserLocaleByEmail(clientEmail);
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
  const ctaSection = paymentUrl && totalPrice
    ? emailButton(paymentUrl, `Pay Now — €${totalPrice}`, "#16A34A")
    : emailButton(`${BASE_URL}/dashboard/bookings`, "View Booking");
  return {
    subject: `Reminder: Complete your payment for the session with ${photographerName}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Reminder</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your booking with <strong>${photographerName}</strong> has been confirmed, but we haven't received your payment yet.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Please complete your payment to secure your photoshoot session.</p>
      ${ctaSection}
    `),
  };
}

export function renderShootReminderToClient(
  clientName: string, photographerName: string, shootDate: string
): { subject: string; html: string } {
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
    subject: `One last thing, ${clientName} — it means a lot to us`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Thank You for Your Review!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We really appreciate you sharing your experience with <strong>${photographerName}</strong> on our platform.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We have one small favour to ask — it would mean the world to our small business if you could leave a quick review on Google or Trustpilot. It takes less than a minute and helps other travelers discover Photo Portugal:</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", "Review Us on Google", "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton("https://www.trustpilot.com/evaluate/photoportugal.com", "Review Us on Trustpilot", "#16A34A")}
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
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Thank you for being part of Photo Portugal. Your work is what makes this platform great.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We'd love it if you could share your experience as a photographer on Google or Trustpilot. A genuine review from a professional like you helps build trust and brings more clients to the platform — which means more bookings for everyone:</p>
      ${emailButton("https://g.page/r/CbWG7PogT_K2EBM/review", "Review Us on Google", "#4285F4")}
      <div style="height:8px"></div>
      ${emailButton("https://www.trustpilot.com/evaluate/photoportugal.com", "Review Us on Trustpilot", "#16A34A")}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">It takes less than a minute. Thank you for your support!</p>
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
  const dateStr = shootDate
    ? new Date(shootDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Flexible dates";
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
  messagePreview: string
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
    `)
  );
}

export async function sendPaymentFailedToClient(
  clientEmail: string,
  clientName: string,
  photographerName: string
) {
  await sendEmail(
    clientEmail,
    `Payment failed for your booking with ${photographerName}`,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Payment Failed</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your payment for the photoshoot with <strong>${photographerName}</strong> could not be processed.</p>
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
  const subject = single
    ? `Still thinking about your photoshoot with ${photographers[0].name}?`
    : `Still looking for a photographer in Portugal?`;
  const photographerLinks = photographers
    .map(p => `<a href="${BASE_URL}/photographers/${p.slug}" style="color:#C94536;font-weight:600;text-decoration:none;">${p.name}</a>`)
    .join(", ");
  await sendEmail(
    clientEmail,
    subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Hi ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We noticed you were checking out ${single ? `<strong>${photographers[0].name}</strong>` : `some of our photographers: ${photographerLinks}`}. Great taste!</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Schedules fill up quickly during peak season. You can message any photographer directly with questions before booking.</p>
      ${emailButton(`${BASE_URL}/photographers/${photographers[0].slug}`, single ? "View " + photographers[0].name + "'s Profile" : "View Photographers")}
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
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Welcome to Photo Portugal! We noticed you signed up but haven't booked a session yet.</p>
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
