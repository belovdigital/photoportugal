import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { pickT, normalizeLocale } from "@/lib/email-locale";
import { signGiftCardClaimToken, GIFT_CARD_TIERS, type GiftCardTier } from "@/lib/gift-card";

const BASE_URL = "https://photoportugal.com";

export type GiftCardEmailPayload = {
  recipientUserId: string;
  giftCardId: string;
  recipientName: string;
  recipientEmail: string;
  buyerName: string;
  tier: GiftCardTier;
  personalMessage: string | null;
  expiresAt: string;       // ISO date for display
  locale: string;
  code: string;            // GIFT-XXXX-XXXX fallback identifier
};

/**
 * Sends the gift-card delivery email to the recipient. Magic-link drops
 * them on /gift-card/claim which sets a password + activates gift mode
 * for browsing photographers.
 */
export async function sendGiftCardEmail(p: GiftCardEmailPayload): Promise<void> {
  const loc = normalizeLocale(p.locale);
  const token = signGiftCardClaimToken(p.recipientUserId, p.giftCardId);
  const claimUrl = `${BASE_URL}/gift-card/claim?token=${token}`;
  const tierMeta = GIFT_CARD_TIERS[p.tier];
  const expiryStr = new Date(p.expiresAt).toLocaleDateString(loc, {
    month: "long", day: "numeric", year: "numeric",
  });

  const T = pickT({
    en: {
      subject: `🎁 ${p.buyerName} sent you a Photo Portugal gift card`,
      h1: `${p.buyerName} sent you a Photo Portugal gift card 🎁`,
      hi: `Hi ${p.recipientName.split(" ")[0]},`,
      body: `You've received a <strong>${tierMeta.label} photo session</strong> in Portugal — choose any participating photographer, anywhere in the country, and the entire session is on ${p.buyerName}.`,
      includes: "What's included",
      noteLabel: "A message for you",
      cta: "Open your gift",
      validity: `Valid until <strong>${expiryStr}</strong>. The card cannot be redeemed after this date.`,
      codeFallback: `Card code: <code>${p.code}</code>`,
      footer: "Click the button to set up your account, then browse our photographers and book your session whenever you're ready.",
    },
    pt: {
      subject: `🎁 ${p.buyerName} ofereceu-lhe um cartão Photo Portugal`,
      h1: `${p.buyerName} ofereceu-lhe um cartão Photo Portugal 🎁`,
      hi: `Olá ${p.recipientName.split(" ")[0]},`,
      body: `Recebeu uma <strong>sessão fotográfica ${tierMeta.label}</strong> em Portugal — escolha qualquer fotógrafo participante, em qualquer cidade, e ${p.buyerName} cobre tudo.`,
      includes: "O que está incluído",
      noteLabel: "Uma mensagem para si",
      cta: "Abrir o seu presente",
      validity: `Válido até <strong>${expiryStr}</strong>. O cartão não pode ser usado após esta data.`,
      codeFallback: `Código do cartão: <code>${p.code}</code>`,
      footer: "Clique no botão para configurar a sua conta, depois escolha um fotógrafo e marque a sessão quando quiser.",
    },
    de: {
      subject: `🎁 ${p.buyerName} hat Ihnen eine Photo Portugal Geschenkkarte geschenkt`,
      h1: `${p.buyerName} hat Ihnen eine Photo Portugal Geschenkkarte geschenkt 🎁`,
      hi: `Hallo ${p.recipientName.split(" ")[0]},`,
      body: `Sie haben eine <strong>${tierMeta.label} Fotoshooting-Session</strong> in Portugal erhalten — wählen Sie einen teilnehmenden Fotografen überall im Land, und ${p.buyerName} übernimmt die gesamte Session.`,
      includes: "Was ist enthalten",
      noteLabel: "Eine Nachricht für Sie",
      cta: "Geschenk öffnen",
      validity: `Gültig bis <strong>${expiryStr}</strong>. Die Karte kann nach diesem Datum nicht mehr eingelöst werden.`,
      codeFallback: `Kartencode: <code>${p.code}</code>`,
      footer: "Klicken Sie auf den Button, um Ihr Konto einzurichten, dann wählen Sie einen Fotografen und buchen Sie die Session, wann immer Sie bereit sind.",
    },
    es: {
      subject: `🎁 ${p.buyerName} le ha regalado una tarjeta Photo Portugal`,
      h1: `${p.buyerName} le ha regalado una tarjeta Photo Portugal 🎁`,
      hi: `Hola ${p.recipientName.split(" ")[0]},`,
      body: `Ha recibido una <strong>sesión fotográfica ${tierMeta.label}</strong> en Portugal — elija a cualquier fotógrafo participante, en cualquier ciudad, y ${p.buyerName} cubre toda la sesión.`,
      includes: "Qué se incluye",
      noteLabel: "Un mensaje para usted",
      cta: "Abrir su regalo",
      validity: `Válido hasta el <strong>${expiryStr}</strong>. La tarjeta no puede usarse después de esta fecha.`,
      codeFallback: `Código de la tarjeta: <code>${p.code}</code>`,
      footer: "Pulse el botón para configurar su cuenta, luego elija un fotógrafo y reserve la sesión cuando lo desee.",
    },
    fr: {
      subject: `🎁 ${p.buyerName} vous a offert une carte cadeau Photo Portugal`,
      h1: `${p.buyerName} vous a offert une carte cadeau Photo Portugal 🎁`,
      hi: `Bonjour ${p.recipientName.split(" ")[0]},`,
      body: `Vous avez reçu une <strong>séance photo ${tierMeta.label}</strong> au Portugal — choisissez n'importe quel photographe participant, dans n'importe quelle ville, et ${p.buyerName} couvre toute la séance.`,
      includes: "Ce qui est inclus",
      noteLabel: "Un message pour vous",
      cta: "Ouvrir votre cadeau",
      validity: `Valable jusqu'au <strong>${expiryStr}</strong>. La carte ne peut pas être utilisée après cette date.`,
      codeFallback: `Code de la carte : <code>${p.code}</code>`,
      footer: "Cliquez sur le bouton pour configurer votre compte, puis choisissez un photographe et réservez quand vous le souhaitez.",
    },
  }, loc);

  const includesItems = [
    `${tierMeta.durationMinutes} ${loc === "pt" ? "minutos" : loc === "de" ? "Minuten" : loc === "es" ? "minutos" : loc === "fr" ? "minutes" : "minutes"}`,
    `${tierMeta.photos} ${loc === "pt" ? "fotos editadas" : loc === "de" ? "bearbeitete Fotos" : loc === "es" ? "fotos editadas" : loc === "fr" ? "photos retouchées" : "edited photos"}`,
    `${tierMeta.locations} ${tierMeta.locations === 1 ? (loc === "pt" ? "localização" : loc === "de" ? "Ort" : loc === "es" ? "ubicación" : loc === "fr" ? "lieu" : "location") : (loc === "pt" ? "localizações" : loc === "de" ? "Orte" : loc === "es" ? "ubicaciones" : loc === "fr" ? "lieux" : "locations")}`,
    tierMeta.outfitChange ? (loc === "pt" ? "mudança de roupa incluída" : loc === "de" ? "ein Outfit-Wechsel" : loc === "es" ? "un cambio de atuendo" : loc === "fr" ? "un changement de tenue" : "one outfit change") : null,
  ].filter(Boolean).map((item) =>
    `<li style="margin:4px 0;font-size:14px;color:#4A4A4A;">${escapeHtml(String(item))}</li>`
  ).join("");

  const noteBlock = p.personalMessage && p.personalMessage.trim()
    ? `<div style="margin:20px 0;padding:16px;background:#FAF6F0;border-left:3px solid #C94536;border-radius:8px;">
         <p style="margin:0 0 6px;font-size:12px;color:#9B8E82;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${T.noteLabel}</p>
         <p style="margin:0;font-size:14px;line-height:1.6;color:#4A4A4A;font-style:italic;">"${escapeHtml(p.personalMessage.trim())}"</p>
       </div>`
    : "";

  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h1}</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#1F1F1F;">${T.hi}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>

    <div style="margin:16px 0;padding:16px;background:#FFF;border:1px solid #F3EDE6;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:12px;color:#9B8E82;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${T.includes}</p>
      <ul style="margin:0;padding-left:18px;">${includesItems}</ul>
    </div>

    ${noteBlock}
    ${emailButton(claimUrl, T.cta)}

    <p style="margin:16px 0 8px;font-size:13px;color:#4A4A4A;">${T.validity}</p>
    <p style="margin:0 0 0;font-size:12px;color:#9B8E82;">${T.codeFallback}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#9B8E82;">${escapeHtml(T.footer)}</p>
  `;

  await sendEmail(p.recipientEmail, T.subject, emailLayout(body, loc));
}

export type GiftCardBuyerReceiptPayload = {
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  recipientEmail: string;
  tier: GiftCardTier;
  amount: number;
  code: string;
  expiresAt: string;
  personalMessage: string | null;
  locale: string;
};

/**
 * Receipt-style confirmation email sent to the buyer right after the
 * Stripe charge succeeds. Stripe sends a card receipt automatically;
 * this one carries the Photo Portugal brand and the actual gift
 * details (tier, recipient, code) so the buyer has something to point
 * at if the recipient says "I never got it."
 */
export async function sendGiftCardBuyerReceipt(p: GiftCardBuyerReceiptPayload): Promise<void> {
  const loc = normalizeLocale(p.locale);
  const tierMeta = GIFT_CARD_TIERS[p.tier];
  const expiry = new Date(p.expiresAt).toLocaleDateString(loc, {
    month: "long", day: "numeric", year: "numeric",
  });

  // All user-supplied strings interpolated into HTML must be escaped to
  // prevent a buyer named e.g. `<script>` from breaking the template.
  const buyerFirst = escapeHtml(p.buyerName.split(" ")[0]);
  const recipientNameSafe = escapeHtml(p.recipientName);
  const recipientEmailSafe = escapeHtml(p.recipientEmail);
  const T = pickT({
    en: {
      subject: `Your gift was delivered to ${p.recipientName}`,
      h1: `Thanks for your gift, ${buyerFirst} 🎁`,
      body: `Your Photo Portugal gift card has been delivered to <strong>${recipientNameSafe}</strong> at <strong>${recipientEmailSafe}</strong>. They have 12 months to redeem it with any participating photographer in Portugal.`,
      detailsLabel: "Gift details",
      tierLabel: "Tier",
      amountLabel: "Amount paid",
      codeLabel: "Card code",
      expiresLabel: "Valid until",
      sentToLabel: "Sent to",
      noteLabel: "Your note",
      footer: `If the recipient didn&rsquo;t see the email, ask them to check spam — or forward your card code <code>${p.code}</code> to <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> and we&rsquo;ll personally help them claim it.`,
      cta: "View on Photo Portugal",
    },
    pt: {
      subject: `O seu presente foi entregue a ${p.recipientName}`,
      h1: `Obrigado pelo presente, ${buyerFirst} 🎁`,
      body: `O seu cartão Photo Portugal foi entregue a <strong>${recipientNameSafe}</strong> em <strong>${recipientEmailSafe}</strong>. Tem 12 meses para resgatá-lo com qualquer fotógrafo participante em Portugal.`,
      detailsLabel: "Detalhes do presente",
      tierLabel: "Plano",
      amountLabel: "Valor pago",
      codeLabel: "Código do cartão",
      expiresLabel: "Válido até",
      sentToLabel: "Enviado para",
      noteLabel: "A sua mensagem",
      footer: `Se a pessoa não viu o email, peça-lhe para verificar o spam — ou envie o código <code>${p.code}</code> para <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> e ajudamos a resgatar pessoalmente.`,
      cta: "Ver no Photo Portugal",
    },
    de: {
      subject: `Ihr Geschenk wurde an ${p.recipientName} geliefert`,
      h1: `Danke für Ihr Geschenk, ${buyerFirst} 🎁`,
      body: `Ihre Photo Portugal Geschenkkarte wurde an <strong>${recipientNameSafe}</strong> unter <strong>${recipientEmailSafe}</strong> geliefert. Sie hat 12 Monate Zeit, sie bei einem teilnehmenden Fotografen in Portugal einzulösen.`,
      detailsLabel: "Geschenkdetails",
      tierLabel: "Tier",
      amountLabel: "Bezahlter Betrag",
      codeLabel: "Kartencode",
      expiresLabel: "Gültig bis",
      sentToLabel: "Gesendet an",
      noteLabel: "Ihre Nachricht",
      footer: `Falls die Empfänger:in die E-Mail nicht sieht, bitten Sie sie, den Spam-Ordner zu prüfen — oder senden Sie den Code <code>${p.code}</code> an <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> und wir helfen persönlich.`,
      cta: "Auf Photo Portugal ansehen",
    },
    es: {
      subject: `Su regalo fue entregado a ${p.recipientName}`,
      h1: `Gracias por su regalo, ${buyerFirst} 🎁`,
      body: `Su tarjeta Photo Portugal ha sido entregada a <strong>${recipientNameSafe}</strong> en <strong>${recipientEmailSafe}</strong>. Tiene 12 meses para canjearla con cualquier fotógrafo participante en Portugal.`,
      detailsLabel: "Detalles del regalo",
      tierLabel: "Plan",
      amountLabel: "Importe pagado",
      codeLabel: "Código de la tarjeta",
      expiresLabel: "Válido hasta",
      sentToLabel: "Enviado a",
      noteLabel: "Su mensaje",
      footer: `Si la persona no ve el email, pídale que revise el spam — o envíe el código <code>${p.code}</code> a <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> y le ayudaremos personalmente.`,
      cta: "Ver en Photo Portugal",
    },
    fr: {
      subject: `Votre cadeau a été livré à ${p.recipientName}`,
      h1: `Merci pour votre cadeau, ${buyerFirst} 🎁`,
      body: `Votre carte cadeau Photo Portugal a été livrée à <strong>${recipientNameSafe}</strong> à <strong>${recipientEmailSafe}</strong>. Il/elle a 12 mois pour l&rsquo;utiliser auprès de n&rsquo;importe quel photographe participant au Portugal.`,
      detailsLabel: "Détails du cadeau",
      tierLabel: "Formule",
      amountLabel: "Montant payé",
      codeLabel: "Code de la carte",
      expiresLabel: "Valable jusqu&rsquo;au",
      sentToLabel: "Envoyé à",
      noteLabel: "Votre message",
      footer: `Si la personne ne voit pas l&rsquo;e-mail, demandez-lui de vérifier le spam — ou envoyez le code <code>${p.code}</code> à <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> et nous l&rsquo;aiderons personnellement.`,
      cta: "Voir sur Photo Portugal",
    },
  }, loc);

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#9B8E82;width:42%;">${label}</td><td style="padding:6px 0;font-size:14px;color:#1F1F1F;font-weight:500;">${value}</td></tr>`;

  const noteBlock = p.personalMessage && p.personalMessage.trim()
    ? `<div style="margin:20px 0;padding:16px;background:#FAF6F0;border-left:3px solid #C94536;border-radius:8px;">
         <p style="margin:0 0 6px;font-size:12px;color:#9B8E82;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${T.noteLabel}</p>
         <p style="margin:0;font-size:14px;line-height:1.6;color:#4A4A4A;font-style:italic;">"${escapeHtml(p.personalMessage.trim())}"</p>
       </div>`
    : "";

  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h1}</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>

    <div style="margin:16px 0;padding:16px;background:#FFF;border:1px solid #F3EDE6;border-radius:12px;">
      <p style="margin:0 0 10px;font-size:12px;color:#9B8E82;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${T.detailsLabel}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${row(T.tierLabel, `${tierMeta.label} (${tierMeta.durationMinutes} min · ${tierMeta.photos} ${loc === "pt" ? "fotos" : loc === "de" ? "Fotos" : loc === "es" ? "fotos" : loc === "fr" ? "photos" : "photos"})`)}
        ${row(T.amountLabel, `€${p.amount.toFixed(2)}`)}
        ${row(T.codeLabel, `<code style="background:#FAF6F0;padding:2px 6px;border-radius:4px;font-size:13px;">${p.code}</code>`)}
        ${row(T.expiresLabel, expiry)}
        ${row(T.sentToLabel, `${recipientNameSafe} &lt;${recipientEmailSafe}&gt;`)}
      </table>
    </div>

    ${noteBlock}
    ${emailButton("https://photoportugal.com", T.cta)}

    <p style="margin:16px 0 0;font-size:13px;color:#9B8E82;line-height:1.5;">${T.footer}</p>
  `;

  await sendEmail(p.buyerEmail, T.subject, emailLayout(body, loc));
}

/**
 * Short SMS notification — the email is the canonical delivery channel,
 * SMS is a "hey check your email" nudge that also works as a soft proof
 * of legitimacy (recipient sees the sender's first name + a Photo Portugal
 * URL, not a random gift-card phishing attempt).
 */
export function buildGiftCardSms(buyerName: string, tier: GiftCardTier, locale: string): string {
  const loc = normalizeLocale(locale);
  const tierLabel = GIFT_CARD_TIERS[tier].label;
  return pickT({
    en: `🎁 ${buyerName} sent you a Photo Portugal ${tierLabel} gift session. Check your email to claim it: photoportugal.com`,
    pt: `🎁 ${buyerName} ofereceu-lhe uma sessão Photo Portugal (${tierLabel}). Veja o seu email para resgatar: photoportugal.com`,
    de: `🎁 ${buyerName} hat Ihnen eine Photo Portugal ${tierLabel}-Session geschenkt. E-Mail prüfen zum Einlösen: photoportugal.com`,
    es: `🎁 ${buyerName} le ha regalado una sesión Photo Portugal (${tierLabel}). Revise su email para canjear: photoportugal.com`,
    fr: `🎁 ${buyerName} vous a offert une séance Photo Portugal (${tierLabel}). Vérifiez votre email pour l'utiliser : photoportugal.com`,
  }, loc);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
