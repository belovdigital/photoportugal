// Phase D — post-match follow-up email templates.
// Triggered by /api/cron/concierge-followups when a chat has email +
// matches shown but the visitor hasn't booked or replied. Two stages:
//   - "30min": gentle nudge ("did you have a chance to look?") with the
//     same matches re-rendered so they don't have to find the chat
//   - "24h": last-touch ("still deciding? happy to help") + offer human
//
// Localised through pickT (en, pt, de, es, fr).

import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { pickT, normalizeLocale, localizedUrl, type Locale } from "@/lib/email-locale";

interface FollowupMatch {
  slug: string;
  name: string;
  cover_url: string | null;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  min_price: number | null;
  reasoning?: string;
}

function matchCardHtml(m: FollowupMatch, profileUrl: string, t: { from: string; viewProfile: string }): string {
  const cover = m.cover_url || m.avatar_url;
  const coverHtml = cover
    ? `<img src="${cover}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px 12px 0 0;" />`
    : "";
  const ratingHtml =
    m.review_count > 0
      ? `<span style="font-size:13px;color:#6B6056;">⭐ ${m.rating.toFixed(1)} <span style="color:#9B8E82;">(${m.review_count})</span></span>`
      : "";
  const priceHtml = m.min_price
    ? `<span style="font-size:13px;font-weight:600;color:#1F1F1F;">${t.from} €${m.min_price}</span>`
    : "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #F3EDE6;border-radius:12px;overflow:hidden;">
      <tr><td>${coverHtml}</td></tr>
      <tr><td style="padding:14px 16px;">
        <div style="font-size:16px;font-weight:700;color:#1F1F1F;">${m.name}</div>
        <div style="margin-top:4px;display:flex;justify-content:space-between;">
          ${ratingHtml}${priceHtml ? `<span style="margin-left:8px;">${priceHtml}</span>` : ""}
        </div>
        ${m.reasoning ? `<div style="margin-top:8px;font-size:13px;color:#6B6056;line-height:1.5;">${escapeHtml(m.reasoning)}</div>` : ""}
        <div style="margin-top:12px;">
          <a href="${profileUrl}" style="color:#C94536;font-weight:600;text-decoration:none;font-size:14px;">${t.viewProfile} →</a>
        </div>
      </td></tr>
    </table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendConciergeFollowup30min(opts: {
  to: string;
  firstName: string | null;
  locale: string | null;
  matches: FollowupMatch[];
}): Promise<void> {
  const loc: Locale = normalizeLocale(opts.locale);
  const T = pickT(
    {
      en: {
        subject: "Your photographer matches — still thinking?",
        h1: opts.firstName ? `Hey ${opts.firstName}` : "Hey there",
        intro: "Just dropping these back in your inbox in case you closed the chat. Here are your matches again — tap any of them to see their full profile and book.",
        cta: "Open chat to compare",
        ps: "If you'd rather chat with a real person, just reply to this email — we read every one.",
        from: "From",
        viewProfile: "View profile",
      },
      pt: {
        subject: "Os seus fotógrafos selecionados — ainda a pensar?",
        h1: opts.firstName ? `Olá ${opts.firstName}` : "Olá",
        intro: "Deixo aqui novamente, caso tenha fechado o chat. Aqui estão as suas escolhas — toque numa delas para ver o perfil completo e reservar.",
        cta: "Abrir chat para comparar",
        ps: "Se preferir falar com uma pessoa real, basta responder a este email — lemos todas.",
        from: "Desde",
        viewProfile: "Ver perfil",
      },
      de: {
        subject: "Ihre Fotografen-Auswahl — noch am Überlegen?",
        h1: opts.firstName ? `Hallo ${opts.firstName}` : "Hallo",
        intro: "Falls Sie den Chat geschlossen haben — hier sind Ihre Treffer noch einmal. Tippen Sie auf einen, um das vollständige Profil zu sehen und zu buchen.",
        cta: "Chat öffnen, um zu vergleichen",
        ps: "Wenn Sie lieber mit einer echten Person sprechen möchten, antworten Sie einfach auf diese E-Mail — wir lesen jede.",
        from: "Ab",
        viewProfile: "Profil ansehen",
      },
      es: {
        subject: "Tus fotógrafos seleccionados — ¿aún decidiendo?",
        h1: opts.firstName ? `Hola ${opts.firstName}` : "Hola",
        intro: "Te los dejo aquí por si cerraste el chat. Aquí están tus opciones — toca cualquiera para ver el perfil completo y reservar.",
        cta: "Abrir chat para comparar",
        ps: "Si prefieres hablar con una persona real, responde a este correo — leemos todos.",
        from: "Desde",
        viewProfile: "Ver perfil",
      },
      fr: {
        subject: "Vos photographes sélectionnés — encore à réfléchir ?",
        h1: opts.firstName ? `Bonjour ${opts.firstName}` : "Bonjour",
        intro: "Au cas où vous auriez fermé le chat, voici à nouveau vos choix. Touchez l'un d'eux pour voir le profil complet et réserver.",
        cta: "Ouvrir le chat pour comparer",
        ps: "Si vous préférez parler à une vraie personne, répondez simplement à cet e-mail — nous les lisons toutes.",
        from: "À partir de",
        viewProfile: "Voir le profil",
      },
    },
    loc
  );

  const conciergeUrl = localizedUrl("/concierge", loc);
  const cards = opts.matches
    .slice(0, 3)
    .map((m) => matchCardHtml(m, localizedUrl(`/photographers/${m.slug}`, loc), { from: T.from, viewProfile: T.viewProfile }))
    .join("");

  const body = `
    <h1 style="font-size:22px;font-weight:700;color:#1F1F1F;margin:0 0 12px;">${T.h1}</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3A3A;margin:0 0 8px;">${T.intro}</p>
    ${cards}
    ${emailButton(conciergeUrl, T.cta)}
    <p style="font-size:13px;color:#9B8E82;line-height:1.5;margin:20px 0 0;">${T.ps}</p>
  `;
  await sendEmail(opts.to, T.subject, emailLayout(body, loc));
}

export async function sendConciergeFollowup24h(opts: {
  to: string;
  firstName: string | null;
  locale: string | null;
  matches: FollowupMatch[];
}): Promise<void> {
  const loc: Locale = normalizeLocale(opts.locale);
  const T = pickT(
    {
      en: {
        subject: "Want a hand picking your photographer?",
        h1: opts.firstName ? `Hi ${opts.firstName}` : "Hi",
        intro: "Yesterday Lens (our AI concierge) sent you a few photographer matches. If you're still on the fence, our team can help you compare or set up a call.",
        cta: "Reply and chat with a human",
        replyEmail: "info@photoportugal.com",
        humanLine: "Or reply to this email with any questions — we usually respond within an hour.",
        ps: "Not the right time? No worries — we'll be here when you're ready.",
        from: "From",
        viewProfile: "View profile",
      },
      pt: {
        subject: "Quer ajuda a escolher o fotógrafo?",
        h1: opts.firstName ? `Olá ${opts.firstName}` : "Olá",
        intro: "Ontem o Lens (o nosso concierge IA) enviou-lhe alguns fotógrafos. Se ainda está na dúvida, a nossa equipa pode ajudar a comparar ou marcar uma chamada.",
        cta: "Responder e falar com alguém",
        replyEmail: "info@photoportugal.com",
        humanLine: "Ou responda a este email com qualquer dúvida — costumamos responder em uma hora.",
        ps: "Não é o momento certo? Sem problema — estaremos aqui quando estiver pronto.",
        from: "Desde",
        viewProfile: "Ver perfil",
      },
      de: {
        subject: "Brauchen Sie Hilfe bei der Wahl?",
        h1: opts.firstName ? `Hallo ${opts.firstName}` : "Hallo",
        intro: "Gestern hat Lens (unser KI-Concierge) Ihnen ein paar Fotografen-Vorschläge gesendet. Wenn Sie noch unschlüssig sind, hilft Ihnen unser Team beim Vergleich oder organisiert ein Gespräch.",
        cta: "Antworten und mit jemandem sprechen",
        replyEmail: "info@photoportugal.com",
        humanLine: "Oder antworten Sie einfach auf diese E-Mail mit Ihren Fragen — wir antworten meistens innerhalb einer Stunde.",
        ps: "Falscher Zeitpunkt? Kein Problem — wir sind da, wenn Sie bereit sind.",
        from: "Ab",
        viewProfile: "Profil ansehen",
      },
      es: {
        subject: "¿Quiere ayuda para elegir al fotógrafo?",
        h1: opts.firstName ? `Hola ${opts.firstName}` : "Hola",
        intro: "Ayer Lens (nuestro concierge IA) le envió algunos fotógrafos. Si todavía está dudando, nuestro equipo puede ayudarle a comparar o organizar una llamada.",
        cta: "Responder y hablar con alguien",
        replyEmail: "info@photoportugal.com",
        humanLine: "O responda a este correo con cualquier duda — solemos responder en una hora.",
        ps: "¿No es el momento? Sin problema — estaremos aquí cuando esté listo.",
        from: "Desde",
        viewProfile: "Ver perfil",
      },
      fr: {
        subject: "Besoin d'aide pour choisir votre photographe ?",
        h1: opts.firstName ? `Bonjour ${opts.firstName}` : "Bonjour",
        intro: "Hier, Lens (notre concierge IA) vous a envoyé quelques propositions de photographes. Si vous hésitez encore, notre équipe peut vous aider à comparer ou organiser un appel.",
        cta: "Répondre et parler à quelqu'un",
        replyEmail: "info@photoportugal.com",
        humanLine: "Ou répondez à cet e-mail avec vos questions — nous répondons généralement en une heure.",
        ps: "Ce n'est pas le bon moment ? Pas de souci — nous serons là quand vous serez prêt(e).",
        from: "À partir de",
        viewProfile: "Voir le profil",
      },
    },
    loc
  );

  const replyHref = `mailto:${T.replyEmail}?subject=${encodeURIComponent(T.subject)}`;
  const cards = opts.matches
    .slice(0, 3)
    .map((m) => matchCardHtml(m, localizedUrl(`/photographers/${m.slug}`, loc), { from: T.from, viewProfile: T.viewProfile }))
    .join("");

  const body = `
    <h1 style="font-size:22px;font-weight:700;color:#1F1F1F;margin:0 0 12px;">${T.h1}</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3A3A;margin:0 0 8px;">${T.intro}</p>
    ${cards}
    ${emailButton(replyHref, T.cta)}
    <p style="font-size:13px;color:#6B6056;line-height:1.5;margin:0 0 16px;">${T.humanLine}</p>
    <p style="font-size:13px;color:#9B8E82;line-height:1.5;margin:0;">${T.ps}</p>
  `;
  await sendEmail(opts.to, T.subject, emailLayout(body, loc));
}

/** Helper: extract follow-up-friendly photographer rows from the latest
 *  show_matches action in a chat. We render whatever we have — covers and
 *  ratings come from the action data the chat already stored. */
export function extractMatchesFromChat(messages: Array<{ role: string; action?: { type?: string; data?: { matches?: unknown[] } } | null }>): FollowupMatch[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const a = messages[i].action;
    if (a?.type === "show_matches" && Array.isArray(a.data?.matches)) {
      return (a.data!.matches as Array<Record<string, unknown>>).map((m) => ({
        slug: String(m.slug || ""),
        name: String(m.name || ""),
        cover_url: (m.cover_url as string | null | undefined) ?? null,
        avatar_url: (m.avatar_url as string | null | undefined) ?? null,
        rating: Number(m.rating || 0),
        review_count: Number(m.review_count || 0),
        min_price: m.min_price ? Number(m.min_price) : null,
        reasoning: typeof m.reasoning === "string" ? m.reasoning : undefined,
      })).filter((m) => m.slug && m.name);
    }
  }
  return [];
}
