import OpenAI from "openai";
import { country } from "@/lib/country";

// ---------------------------------------------------------------------------
// Off-platform payment detection for chat.
//
// The gap this closes: content-filter.ts catches contact details (email, phone,
// links, social handles), but nothing about MONEY. A message like
//   "Kann ich bei dir auch direkt per PayPal bezahlen?"
// contains no contact info at all and sailed straight through — the only trace
// was a line in the generic Telegram message feed.
//
// WHY THIS IS NOT A REGEX. Measured against the full 1945-message history:
//   - A keyword list produced 11 hits, 9 of them junk — "wise" matches inside
//     "otherwise" ("Otherwise we'd be happy to travel"), which is common in
//     ordinary scheduling chat.
//   - Tightening it to "payment rail + intent word" dropped the junk but also
//     lost two real ones ("Please send me your PayPal!" has no intent word at
//     all — "pay" only appears inside "PayPal").
//   - And the single clearest violation in the whole corpus names no payment
//     method whatsoever: "I am ready to pay, but I do not want to pay crazy
//     extra service taxes from the site."
// No pattern set covers that across five languages. The signal is intent, so
// stage 2 is a classifier.
//
// Stage 1 (regex) exists only to keep the classifier off the hot path: it is
// deliberately over-broad and cheap. ~0.6% of messages get past it.
// ---------------------------------------------------------------------------

const MODEL = "gpt-5.6-luna";

// Over-broad on purpose — a false positive here costs one cheap LLM call, a
// false negative costs a booking. Word-anchored so "otherwise" can't match
// "wise" (that single bug accounted for 7 of the 9 junk hits).
const RAIL = new RegExp(
  String.raw`(?<![\p{L}])(` +
    [
      String.raw`pay\s?pal`,
      String.raw`revolut`,
      String.raw`wise|transferwise`,
      String.raw`mb\s?way`,
      String.raw`bizum`,
      String.raw`venmo|zelle|cash\s?app|western\s?union`,
      String.raw`iban|swift`,
      String.raw`bank\s?transfer|banküberweisung|überweisung`,
      String.raw`transferencia|transfer[êe]ncia|virement`,
      String.raw`bar\s?zahl\w*|bar\s?bezahl\w*`,
      String.raw`cash`,
      String.raw`dinheiro|efectivo|efetivo|espèces|contant`,
      String.raw`нал\w*|перевод\w*`,
      // Fee-avoidance talk with no rail named — the case every keyword list missed.
      String.raw`geb[üu]hr\w*`,
      String.raw`service\s+(?:fee|tax|charge)\w*`,
      String.raw`comisi[óo]n|sem\s+taxa|sin\s+comisi[óo]n`,
      String.raw`off[-\s]?platform|outside\s+the\s+(?:platform|site|website)`,
      String.raw`комисс\w*`,
    ].join("|") +
    String.raw`)(?![\p{L}])`,
  "iu",
);

/** Cheap gate. Returns the matched token, or null when the message is clearly unrelated. */
export function mentionsPaymentRail(text: string): string | null {
  const m = RAIL.exec(text || "");
  return m ? m[0].toLowerCase() : null;
}

export interface OffPlatformVerdict {
  violation: boolean;
  /** "solicit" = asking to go off-platform, "offer" = volunteering details. */
  kind: "solicit" | "offer" | "none";
  reason: string;
}

const SYSTEM_PROMPT = `You moderate chat on ${country.brand}, a marketplace where clients book photographers. The platform takes a 15% service fee and ALL payment must go through the site.

Decide whether the message is an attempt to move payment OFF the platform.

A VIOLATION is: asking to pay the photographer directly; offering or requesting PayPal / Revolut / Wise / MB Way / Bizum / Venmo / Zelle / bank transfer / IBAN / cash; proposing to avoid, split or discount the service fee by paying outside; or steering the deal off the site to save money.

NOT a violation — be strict about these, they are common and must pass:
- REFUSING off-platform payment or pointing someone back to the site. "I don't accept cash payments, all payments are made securely through the website" is the photographer enforcing the rules. Never flag it.
- Discussing money that is not about paying the photographer: parking fees, museum or venue entry, tips already handled, travel costs, prices of packages on the site.
- Complaining that the price or fee is HIGH, without any move to get out of it. "The 15% feels steep, but I understand" is a sales problem, not a policy breach.
- Talking about a payment already correctly made through the platform.
- The word "otherwise", which contains "wise" but means nothing here.

Watch the line between the last two: calling a fee expensive is fine, but REFUSING to pay it is a violation even when no alternative method is named. "I am ready to pay, but I do not want to pay the service fee from the site" is asking to restructure the payment — flag it.

Reply ONLY with JSON: {"violation": true|false, "kind": "solicit"|"offer"|"none", "reason": "<10 words max>"}`;

/**
 * Stage 2. Returns a non-violating verdict when the classifier is unavailable:
 * an API hiccup must never silently eat a legitimate message. Callers that need
 * to know the difference should check `reason === "classifier_unavailable"`.
 */
export async function classifyOffPlatformPayment(
  text: string,
  senderRole: "client" | "photographer",
): Promise<OffPlatformVerdict> {
  const clean = (text || "").trim();
  if (!clean) return { violation: false, kind: "none", reason: "empty" };
  if (!mentionsPaymentRail(clean)) return { violation: false, kind: "none", reason: "no rail mentioned" };
  if (!process.env.OPENAI_API_KEY) {
    return { violation: false, kind: "none", reason: "classifier_unavailable" };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Sender is the ${senderRole}.\n\nMessage:\n"""${clean.slice(0, 1500)}"""` },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return { violation: false, kind: "none", reason: "classifier_unavailable" };
    const parsed = JSON.parse(raw) as Partial<OffPlatformVerdict>;
    return {
      violation: parsed.violation === true,
      kind: parsed.kind === "solicit" || parsed.kind === "offer" ? parsed.kind : "none",
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 120) : "",
    };
  } catch (err) {
    console.error("[off-platform] classify failed:", err);
    return { violation: false, kind: "none", reason: "classifier_unavailable" };
  }
}

// --- Blocked-message copy ---------------------------------------------------
// Returned by the API and rendered straight into the thread, so it is written
// out per locale here rather than going through next-intl — there is no key to
// forget and no path to leak (see CLAUDE.md).

import { type Locale } from "@/lib/email-locale";

// The post-delivery scan can't un-send, so its notice must not claim it did.
// Same body, different opening line.
const LEAD_BLOCKED: Record<Locale, string> = {
  en: `Payments can only be made through ${country.brand}, so this message wasn't sent.`,
  pt: `Os pagamentos só podem ser feitos através da ${country.brand}, por isso esta mensagem não foi enviada.`,
  de: `Zahlungen sind ausschließlich über ${country.brand} möglich, deshalb wurde diese Nachricht nicht gesendet.`,
  es: `Los pagos solo pueden realizarse a través de ${country.brand}, por eso este mensaje no se ha enviado.`,
  fr: `Les paiements ne peuvent se faire que via ${country.brand}, ce message n'a donc pas été envoyé.`,
  it: `I pagamenti si possono fare solo tramite ${country.brand}, quindi questo messaggio non è stato inviato.`,
};

const LEAD_DELIVERED: Record<Locale, string> = {
  en: `A note from ${country.brand}: payments can only be made through the platform.`,
  pt: `Uma nota da ${country.brand}: os pagamentos só podem ser feitos através da plataforma.`,
  de: `Ein Hinweis von ${country.brand}: Zahlungen sind ausschließlich über die Plattform möglich.`,
  es: `Un aviso de ${country.brand}: los pagos solo pueden realizarse a través de la plataforma.`,
  fr: `Un mot de ${country.brand} : les paiements ne peuvent se faire que via la plateforme.`,
  it: `Una nota da ${country.brand}: i pagamenti si possono fare solo tramite la piattaforma.`,
};

const CLIENT_COPY: Record<Locale, string> = {
  en: `\n\nThat isn't red tape. Booking through the platform is what gives you a guaranteed photographer, a refund if the shoot falls through, cover if something goes wrong on the day, and a team you can reach if it does. Pay privately and none of that exists.\n\nIf the total is more than you wanted to spend, tell the photographer your budget — many have shorter sessions or quieter time slots that aren't listed. That conversation is welcome here; moving the payment off the site is not, and it puts the photographer's account at risk.`,
  pt: `\n\nNão é burocracia. Reservar pela plataforma é o que lhe garante o fotógrafo, o reembolso caso a sessão não se realize, cobertura se algo correr mal no dia e uma equipa contactável se isso acontecer. Pagando por fora, nada disso existe.\n\nSe o total ficou acima do que pretendia gastar, diga o seu orçamento ao fotógrafo — muitos têm sessões mais curtas ou horários menos concorridos que não estão listados. Essa conversa é bem-vinda aqui; tirar o pagamento do site não é, e coloca a conta do fotógrafo em risco.`,
  de: `\n\nDas ist keine Formsache. Die Buchung über die Plattform sichert Ihnen den Fotografen zu, erstattet Ihnen den Betrag, falls das Shooting ausfällt, deckt Sie ab, wenn am Tag selbst etwas schiefgeht, und gibt Ihnen ein Team, das dann erreichbar ist. Bei einer privaten Zahlung entfällt das alles.\n\nWenn der Gesamtbetrag über Ihrem Budget liegt, nennen Sie dem Fotografen Ihr Budget — viele bieten kürzere Sessions oder ruhigere Zeitfenster an, die nicht ausgeschrieben sind. Dieses Gespräch ist hier willkommen; die Zahlung von der Plattform wegzuleiten ist es nicht und gefährdet das Konto des Fotografen.`,
  es: `\n\nNo es burocracia. Reservar por la plataforma es lo que le garantiza el fotógrafo, el reembolso si la sesión no se celebra, cobertura si algo sale mal ese día y un equipo al que acudir si ocurre. Pagando por fuera, nada de eso existe.\n\nSi el total supera lo que quería gastar, dígale su presupuesto al fotógrafo: muchos tienen sesiones más cortas u horarios menos solicitados que no están publicados. Esa conversación es bienvenida aquí; sacar el pago del sitio no lo es, y pone en riesgo la cuenta del fotógrafo.`,
  fr: `\n\nCe n'est pas de la paperasse. Réserver par la plateforme est ce qui vous garantit le photographe, le remboursement si la séance n'a pas lieu, une couverture si quelque chose se passe mal le jour J, et une équipe joignable le cas échéant. En payant en privé, plus rien de tout cela n'existe.\n\nSi le total dépasse ce que vous vouliez dépenser, indiquez votre budget au photographe : beaucoup proposent des séances plus courtes ou des créneaux plus calmes qui ne sont pas affichés. Cette conversation est la bienvenue ici ; sortir le paiement du site ne l'est pas, et met en danger le compte du photographe.`,
  it: `\n\nNon è burocrazia. Prenotare tramite la piattaforma è ciò che ti garantisce il fotografo, il rimborso se il servizio salta, una copertura se qualcosa va storto quel giorno e un team a cui rivolgerti se succede. Pagando privatamente, niente di tutto questo esiste.\n\nSe il totale è più di quanto volevi spendere, dì al fotografo il tuo budget: molti hanno sessioni più brevi o fasce orarie meno richieste che non sono in listino. Quella conversazione qui è benvenuta; spostare il pagamento fuori dal sito no, e mette a rischio l'account del fotografo.`,
};

const PHOTOGRAPHER_COPY: Record<Locale, string> = {
  en: `This message wasn't sent: it points the client at a payment method outside ${country.brand}.\n\nTaking a booking off-platform removes the client's refund and cover, and it breaches your agreement with us — repeat cases end in removal from the platform. If the client is pushing for it, say no and tell us; you won't be penalised for their ask.\n\nIf the issue is the price, you can send the client a custom offer at any amount from your dashboard.`,
  pt: `Esta mensagem não foi enviada: encaminha o cliente para um método de pagamento fora da ${country.brand}.\n\nTirar uma reserva da plataforma elimina o reembolso e a cobertura do cliente e viola o seu acordo connosco — casos repetidos terminam com a remoção da plataforma. Se for o cliente a insistir, recuse e avise-nos; não será penalizado pelo pedido dele.\n\nSe a questão for o preço, pode enviar ao cliente uma proposta personalizada com o valor que quiser, a partir do seu painel.`,
  de: `Diese Nachricht wurde nicht gesendet: Sie verweist die Kundschaft auf eine Zahlungsmethode außerhalb von ${country.brand}.\n\nEine Buchung von der Plattform zu nehmen, streicht Erstattung und Absicherung der Kundschaft und verstößt gegen Ihre Vereinbarung mit uns — Wiederholungsfälle enden mit dem Ausschluss. Wenn die Kundschaft darauf drängt, lehnen Sie ab und sagen Sie uns Bescheid; für deren Anfrage werden Sie nicht belangt.\n\nGeht es um den Preis, können Sie jederzeit ein individuelles Angebot in beliebiger Höhe aus Ihrem Dashboard senden.`,
  es: `Este mensaje no se ha enviado: dirige al cliente a un método de pago fuera de ${country.brand}.\n\nSacar una reserva de la plataforma elimina el reembolso y la cobertura del cliente, e incumple su acuerdo con nosotros; los casos repetidos acaban en expulsión. Si es el cliente quien insiste, niéguese y avísenos; no será penalizado por lo que él pida.\n\nSi el problema es el precio, puede enviar al cliente una oferta personalizada por el importe que quiera desde su panel.`,
  fr: `Ce message n'a pas été envoyé : il oriente le client vers un moyen de paiement hors ${country.brand}.\n\nSortir une réservation de la plateforme supprime le remboursement et la couverture du client, et enfreint votre accord avec nous — les cas répétés se terminent par une exclusion. Si c'est le client qui insiste, refusez et prévenez-nous ; sa demande ne vous sera pas reprochée.\n\nSi le sujet est le prix, vous pouvez envoyer au client une offre personnalisée du montant de votre choix depuis votre tableau de bord.`,
  it: `Questo messaggio non è stato inviato: indirizza il cliente verso un metodo di pagamento fuori da ${country.brand}.\n\nPortare una prenotazione fuori dalla piattaforma toglie al cliente rimborso e copertura e viola il tuo accordo con noi — i casi ripetuti finiscono con la rimozione dalla piattaforma. Se è il cliente a insistere, rifiuta e avvisaci: non sarai penalizzato per la sua richiesta.\n\nSe il problema è il prezzo, puoi inviare al cliente un'offerta personalizzata dell'importo che vuoi dalla tua dashboard.`,
};

/**
 * @param mode "blocked" when the send was refused, "delivered" when the
 *   post-delivery scan caught it and the message is already in the thread.
 *   Getting this wrong tells the sender their message wasn't sent when it was.
 */
export function blockedCopy(
  role: "client" | "photographer",
  locale: string,
  mode: "blocked" | "delivered" = "blocked",
): string {
  const l: Locale = (["en", "pt", "de", "es", "fr", "it"] as const).includes(locale as Locale)
    ? (locale as Locale)
    : "en";
  if (role === "photographer") {
    return mode === "blocked"
      ? PHOTOGRAPHER_COPY[l]
      : `${LEAD_DELIVERED[l]}\n\n${PHOTOGRAPHER_COPY[l].split("\n\n").slice(1).join("\n\n")}`;
  }
  const lead = mode === "blocked" ? LEAD_BLOCKED[l] : LEAD_DELIVERED[l];
  return `${lead}${CLIENT_COPY[l]}`;
}
