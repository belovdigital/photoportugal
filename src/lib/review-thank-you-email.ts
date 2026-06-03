import { type Locale } from "@/lib/email-locale";

// Localised thank-you email for clients who left a review and earned
// a Stripe promo code. Photo reviews get 10%, video reviews get 15% and
// a noticeably different copy — video is real effort and the email
// should acknowledge that, not just substitute one word.
//
// Returns { subject, html }. Caller hands them to sendEmail().

interface Args {
  locale: Locale;
  firstName: string;
  code: string;
  percentOff: number; // 10 or 15
  isVideoReview: boolean;
}

const BUTTON = "background: #C94536; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;";

function wrap(inner: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; color: #1F1F1F;">
${inner}
<p style="color: #999; font-size: 12px; margin-top: 24px;">Photo Portugal — <a href="https://photoportugal.com" style="color: #999; text-decoration: underline;">photoportugal.com</a></p>
</div>`;
}

function codeBlock(code: string, validLabel: string, oneUseLabel: string, codeLabel: string): string {
  return `<div style="background: #FFF8E1; border: 2px dashed #FFCA28; border-radius: 12px; padding: 22px; text-align: center; margin: 22px 0;">
    <div style="font-size: 11px; color: #888; letter-spacing: 1px; text-transform: uppercase;">${codeLabel}</div>
    <div style="font-size: 30px; font-weight: 800; letter-spacing: 2px; color: #333; margin-top: 8px; font-family: 'SF Mono', Menlo, Consolas, monospace;">${code}</div>
    <div style="font-size: 12px; color: #666; margin-top: 10px;">${validLabel} · ${oneUseLabel}</div>
  </div>`;
}

// Photo-review thank-you (10% off)
function photoEmail(args: Args): { subject: string; html: string } {
  const { locale, firstName, code, percentOff } = args;
  const greet = firstName ? `, ${firstName}` : "";

  const variants = {
    en: {
      subject: `Your ${percentOff}% off code is here`,
      heading: `Thanks for the review${greet}!`,
      body: `Reviews like yours help travelers find the right photographer. Really, thank you.`,
      promise: `As promised, here's your <strong>${percentOff}% off code</strong> for any future booking on Photo Portugal:`,
      codeLabel: "YOUR CODE",
      validLabel: "Valid for 12 months",
      oneUseLabel: "One use",
      apply: `Apply it at checkout when you book your next session.`,
      cta: `Browse photographers`,
    },
    pt: {
      subject: `O seu código de ${percentOff}% de desconto chegou`,
      heading: `Obrigado pela avaliação${greet}!`,
      body: `Avaliações como a sua ajudam outros viajantes a encontrar o fotógrafo certo. Muito obrigado.`,
      promise: `Como prometido, aqui está o seu <strong>código de ${percentOff}% de desconto</strong> para a próxima reserva na Photo Portugal:`,
      codeLabel: "O SEU CÓDIGO",
      validLabel: "Válido por 12 meses",
      oneUseLabel: "Utilização única",
      apply: `Insira o código no checkout quando reservar a próxima sessão.`,
      cta: `Explorar fotógrafos`,
    },
    de: {
      subject: `Ihr ${percentOff}%-Rabattcode ist da`,
      heading: `Vielen Dank für die Bewertung${greet}!`,
      body: `Bewertungen wie Ihre helfen anderen Reisenden, den richtigen Fotografen zu finden. Wirklich, danke.`,
      promise: `Wie versprochen, hier ist Ihr <strong>${percentOff}%-Rabattcode</strong> für eine zukünftige Buchung bei Photo Portugal:`,
      codeLabel: "IHR CODE",
      validLabel: "12 Monate gültig",
      oneUseLabel: "Einmalig verwendbar",
      apply: `Geben Sie den Code beim Checkout Ihrer nächsten Session ein.`,
      cta: `Fotografen entdecken`,
    },
    es: {
      subject: `Aquí está su código de ${percentOff}% de descuento`,
      heading: `¡Gracias por la reseña${greet}!`,
      body: `Reseñas como la suya ayudan a otros viajeros a encontrar al fotógrafo adecuado. De verdad, gracias.`,
      promise: `Como prometido, aquí tiene su <strong>código de ${percentOff}% de descuento</strong> para su próxima reserva en Photo Portugal:`,
      codeLabel: "SU CÓDIGO",
      validLabel: "Válido durante 12 meses",
      oneUseLabel: "Un único uso",
      apply: `Introdúzcalo en el checkout cuando reserve su próxima sesión.`,
      cta: `Explorar fotógrafos`,
    },
    fr: {
      subject: `Votre code de réduction de ${percentOff}% est là`,
      heading: `Merci pour l'avis${greet} !`,
      body: `Des avis comme le vôtre aident les autres voyageurs à trouver le bon photographe. Vraiment, merci.`,
      promise: `Comme promis, voici votre <strong>code de réduction de ${percentOff}%</strong> pour votre prochaine réservation sur Photo Portugal :`,
      codeLabel: "VOTRE CODE",
      validLabel: "Valable 12 mois",
      oneUseLabel: "Utilisation unique",
      apply: `Saisissez-le au moment du paiement de votre prochaine séance.`,
      cta: `Découvrir les photographes`,
    },
  };

  const t = variants[locale] || variants.en;
  const html = wrap(`<h2 style="color: #C94536; margin: 0 0 12px;">${t.heading}</h2>
<p>${t.body}</p>
<p>${t.promise}</p>
${codeBlock(code, t.validLabel, t.oneUseLabel, t.codeLabel)}
<p>${t.apply}</p>
<p><a href="https://photoportugal.com" style="${BUTTON}">${t.cta}</a></p>`);
  return { subject: t.subject, html };
}

// Video-review thank-you (15% off — bigger reward, more personal copy)
function videoEmail(args: Args): { subject: string; html: string } {
  const { locale, firstName, code, percentOff } = args;
  const greet = firstName ? `, ${firstName}` : "";

  const variants = {
    en: {
      subject: `Your ${percentOff}% off code — thanks for the video review!`,
      heading: `That video meant a lot${greet} 🎥`,
      body: `Video reviews are real effort, and they make a real difference. Travelers trust a face and a voice in a way text can't match — yours is going to help someone book the right photographer.`,
      promise: `That's why your reward is <strong>${percentOff}% off</strong> — a little bigger than the standard thank-you. Use it on any future Photo Portugal booking:`,
      codeLabel: "YOUR CODE",
      validLabel: "Valid for 12 months",
      oneUseLabel: "One use",
      apply: `Apply it at checkout when you book your next session.`,
      cta: `Browse photographers`,
    },
    pt: {
      subject: `O seu código de ${percentOff}% — obrigado pelo vídeo!`,
      heading: `Esse vídeo significou muito${greet} 🎥`,
      body: `Avaliações em vídeo exigem esforço real e fazem uma diferença real. Os viajantes confiam num rosto e numa voz de uma forma que o texto não consegue — o seu vai ajudar alguém a reservar o fotógrafo certo.`,
      promise: `Por isso a sua recompensa é de <strong>${percentOff}% de desconto</strong> — um pouco maior que o agradecimento padrão. Use-o em qualquer reserva futura na Photo Portugal:`,
      codeLabel: "O SEU CÓDIGO",
      validLabel: "Válido por 12 meses",
      oneUseLabel: "Utilização única",
      apply: `Insira o código no checkout quando reservar a próxima sessão.`,
      cta: `Explorar fotógrafos`,
    },
    de: {
      subject: `Ihr ${percentOff}%-Code — danke für das Video!`,
      heading: `Dieses Video hat viel bedeutet${greet} 🎥`,
      body: `Video-Bewertungen sind echte Mühe und machen einen echten Unterschied. Reisende vertrauen einem Gesicht und einer Stimme auf eine Weise, die Text nicht erreicht — Ihres wird jemandem helfen, den richtigen Fotografen zu buchen.`,
      promise: `Deshalb ist Ihre Belohnung <strong>${percentOff}% Rabatt</strong> — etwas mehr als das übliche Dankeschön. Nutzbar bei jeder zukünftigen Buchung bei Photo Portugal:`,
      codeLabel: "IHR CODE",
      validLabel: "12 Monate gültig",
      oneUseLabel: "Einmalig verwendbar",
      apply: `Geben Sie den Code beim Checkout Ihrer nächsten Session ein.`,
      cta: `Fotografen entdecken`,
    },
    es: {
      subject: `Su código de ${percentOff}% — ¡gracias por el vídeo!`,
      heading: `Ese vídeo significó mucho${greet} 🎥`,
      body: `Las reseñas en vídeo requieren esfuerzo real y marcan una diferencia real. Los viajeros confían en una cara y una voz de un modo que el texto no logra — la suya va a ayudar a alguien a reservar al fotógrafo adecuado.`,
      promise: `Por eso su recompensa es <strong>${percentOff}% de descuento</strong> — un poco más que el agradecimiento estándar. Úselo en cualquier futura reserva en Photo Portugal:`,
      codeLabel: "SU CÓDIGO",
      validLabel: "Válido durante 12 meses",
      oneUseLabel: "Un único uso",
      apply: `Introdúzcalo en el checkout cuando reserve su próxima sesión.`,
      cta: `Explorar fotógrafos`,
    },
    fr: {
      subject: `Votre code de ${percentOff}% — merci pour la vidéo !`,
      heading: `Cette vidéo a beaucoup compté${greet} 🎥`,
      body: `Les avis vidéo demandent un vrai effort et font une vraie différence. Les voyageurs font confiance à un visage et à une voix d'une manière que le texte ne peut atteindre — le vôtre va aider quelqu'un à réserver le bon photographe.`,
      promise: `C'est pourquoi votre récompense est de <strong>${percentOff}% de réduction</strong> — un peu plus que le remerciement habituel. Utilisable sur toute future réservation Photo Portugal :`,
      codeLabel: "VOTRE CODE",
      validLabel: "Valable 12 mois",
      oneUseLabel: "Utilisation unique",
      apply: `Saisissez-le au moment du paiement de votre prochaine séance.`,
      cta: `Découvrir les photographes`,
    },
  };

  const t = variants[locale] || variants.en;
  const html = wrap(`<h2 style="color: #C94536; margin: 0 0 12px;">${t.heading}</h2>
<p>${t.body}</p>
<p>${t.promise}</p>
${codeBlock(code, t.validLabel, t.oneUseLabel, t.codeLabel)}
<p>${t.apply}</p>
<p><a href="https://photoportugal.com" style="${BUTTON}">${t.cta}</a></p>`);
  return { subject: t.subject, html };
}

export function buildReviewThankYouEmail(args: Args): { subject: string; html: string } {
  return args.isVideoReview ? videoEmail(args) : photoEmail(args);
}
