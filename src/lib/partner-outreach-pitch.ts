import { country } from "@/lib/country";
import { emailLayout } from "@/lib/email";

/**
 * The cold-outreach letter sent to accommodation-side partners.
 *
 * One builder, used by the cron sender and by its own dry-run preview, so the
 * preview shows exactly what leaves the server.
 *
 * Portuguese is the default (decided 2026-08-13): the recipients are lodging
 * businesses in Portugal, and a cold email in English to a guest house in
 * Nazaré announces itself as a mail-merge before the first line is read. Rows
 * whose business is run in English — the international villa aggregators, the
 * UK-managed agencies — carry language='en' and get the English version.
 *
 * What we offer is deliberately not money: no discount to their guests, no
 * commission to them. The trade is a ready-made block for their
 * recommendations page, priority handling for their guests, and a mention in
 * our own guide — offered, never promised up front, because at this list size
 * we cannot pre-commit a link to every recipient.
 */

export interface OutreachPartner {
  company_name: string;
  contact_name?: string | null;
  region?: string | null;
  segment: string;
  language?: string | null;
}

export interface Pitch {
  subject: string;
  html: string;
  text: string;
}

/**
 * How many photographers we claim in the first line.
 *
 * Read from the database at send time and never written into the copy: the
 * roster grows, and a letter that says "fifty" a year from now is a letter
 * that lies. Absent or zero, the sentence loses the number rather than
 * shipping a wrong one.
 */
export interface PitchOptions {
  photographerCount?: number;
}

function rosterPt(opts?: PitchOptions): string {
  return opts?.photographerCount
    ? `${opts.photographerCount} fotógrafos`
    : "Fotógrafos locais";
}

function rosterEn(opts?: PitchOptions): string {
  return opts?.photographerCount
    ? `${opts.photographerCount} photographers`
    : "Local photographers";
}

interface RawPitch {
  subject: string;
  body: string;
}

/**
 * Portuguese needs the preposition fused with the article, and which article a
 * place takes is not derivable from the string: em Lisboa, but no Porto, na
 * Madeira, nos Açores. Getting this wrong is the exact tell we are trying to
 * avoid, so every region actually present in the list is spelled out — along
 * with its properly accented name, since the stored values are ASCII.
 *
 * `em` = "in ___", `de` = "of ___" (…our guide OF Lisbon).
 */
const REGION_PT: Record<string, { name: string; em: string; de: string }> = {
  lisbon: { name: "Lisboa", em: "em Lisboa", de: "de Lisboa" },
  porto: { name: "Porto", em: "no Porto", de: "do Porto" },
  madeira: { name: "Madeira", em: "na Madeira", de: "da Madeira" },
  lagos: { name: "Lagos", em: "em Lagos", de: "de Lagos" },
  "douro valley": { name: "Douro", em: "no Douro", de: "do Douro" },
  douro: { name: "Douro", em: "no Douro", de: "do Douro" },
  braga: { name: "Braga", em: "em Braga", de: "de Braga" },
  "ponta delgada": { name: "Ponta Delgada", em: "em Ponta Delgada", de: "de Ponta Delgada" },
  portimao: { name: "Portimão", em: "em Portimão", de: "de Portimão" },
  coimbra: { name: "Coimbra", em: "em Coimbra", de: "de Coimbra" },
  albufeira: { name: "Albufeira", em: "em Albufeira", de: "de Albufeira" },
  azores: { name: "Açores", em: "nos Açores", de: "dos Açores" },
  leiria: { name: "Leiria", em: "em Leiria", de: "de Leiria" },
  aveiro: { name: "Aveiro", em: "em Aveiro", de: "de Aveiro" },
  vilamoura: { name: "Vilamoura", em: "em Vilamoura", de: "de Vilamoura" },
  nazare: { name: "Nazaré", em: "na Nazaré", de: "da Nazaré" },
  evora: { name: "Évora", em: "em Évora", de: "de Évora" },
  cascais: { name: "Cascais", em: "em Cascais", de: "de Cascais" },
  guimaraes: { name: "Guimarães", em: "em Guimarães", de: "de Guimarães" },
  tavira: { name: "Tavira", em: "em Tavira", de: "de Tavira" },
  tomar: { name: "Tomar", em: "em Tomar", de: "de Tomar" },
  sintra: { name: "Sintra", em: "em Sintra", de: "de Sintra" },
  algarve: { name: "Algarve", em: "no Algarve", de: "do Algarve" },
  setubal: { name: "Setúbal", em: "em Setúbal", de: "de Setúbal" },
  obidos: { name: "Óbidos", em: "em Óbidos", de: "de Óbidos" },
  faro: { name: "Faro", em: "em Faro", de: "de Faro" },
  comporta: { name: "Comporta", em: "na Comporta", de: "da Comporta" },
  ericeira: { name: "Ericeira", em: "na Ericeira", de: "da Ericeira" },
  peniche: { name: "Peniche", em: "em Peniche", de: "de Peniche" },
  sesimbra: { name: "Sesimbra", em: "em Sesimbra", de: "de Sesimbra" },
  almada: { name: "Almada", em: "em Almada", de: "de Almada" },
  "costa da caparica": { name: "Costa da Caparica", em: "na Costa da Caparica", de: "da Costa da Caparica" },
  caparica: { name: "Caparica", em: "na Caparica", de: "da Caparica" },
  carvoeiro: { name: "Carvoeiro", em: "em Carvoeiro", de: "de Carvoeiro" },
  alentejo: { name: "Alentejo", em: "no Alentejo", de: "do Alentejo" },
};

// English regions that read as "the ___". Islands and cities take no article.
const ARTICLE_REGIONS = /^(algarve|douro( valley)?|alentejo|azores|silver coast)$/i;

/** Stored regions can hold a list ("Carvoeiro, Algarve") — the first wins. */
function primaryRegion(p: OutreachPartner): string {
  const raw = (p.region || "").trim();
  if (!raw || raw.toLowerCase() === "national") return "";
  return raw.split(",")[0].trim();
}

function ptRegion(p: OutreachPartner): { name: string; em: string; de: string } | null {
  const region = primaryRegion(p);
  if (!region) return null;
  const known = REGION_PT[region.toLowerCase()];
  if (known) return known;
  // Most Portuguese place names take the bare preposition; falling back to it
  // is wrong far less often than dropping the sentence would be dull.
  return { name: region, em: `em ${region}`, de: `de ${region}` };
}

function enRegion(p: OutreachPartner): string {
  const region = primaryRegion(p);
  if (!region) return "";
  return ARTICLE_REGIONS.test(region) ? `the ${region}` : region;
}

function firstName(p: OutreachPartner): string | null {
  const first = (p.contact_name || "").trim().split(/\s+/)[0];
  // Only greet by name when it looks like one. Harvested contact fields hold
  // things like "Reservations" and "Front Desk", and "Olá Reservations," is
  // worse than no name at all.
  return first && /^[A-ZÀ-Ý][a-zà-ÿ'’-]+$/.test(first) ? first : null;
}

// ---------------------------------------------------------------- Portuguese

function signPt(): string {
  return `<p>Com os melhores cumprimentos,<br>Equipa ${country.brand}<br><a href="${country.baseUrl}">${country.host}</a></p>
<p style="color:#9B8E82;font-size:13px;">Se preferirem inglês, é só responder em inglês — continuamos assim.<br>
Se não quiserem voltar a receber mensagens nossas, respondam &laquo;não, obrigado&raquo; e retiramos o vosso contacto da lista.</p>`;
}

function lodgingPt(p: OutreachPartner, opts?: PitchOptions): RawPitch {
  const r = ptRegion(p);
  const name = firstName(p);
  return {
    subject: `Um fotógrafo para os vossos hóspedes${r ? ` ${r.em}` : ""}`,
    body: `<p>${name ? `Olá ${name},` : "Olá,"}</p>

<p>Somos a ${country.brand} — os viajantes reservam connosco fotógrafos locais por todo o país${r ? `, também ${r.em}` : ""}. ${rosterPt(opts)}, calendários atualizados, preço fixo, pagamento no site.</p>

<p>São os vossos hóspedes que pedem isto. A família que finalmente conseguiu juntar toda a gente em Portugal, o casal com um pedido de casamento marcado para a segunda noite — e a pessoa a quem perguntam por um fotógrafo são vocês.</p>

<p>Se quiserem, tratamos disso, e não vos custa nada:</p>

<ul>
  <li>um bloco curto para a vossa página de recomendações ou para o livro de boas-vindas — texto e fotografias, prontos a colar;</li>
  <li>os vossos hóspedes tratados primeiro: fotógrafo confirmado para a data, e não um pedido que fica sem resposta;</li>
  <li>e acrescentamos ${p.company_name} à secção &laquo;onde ficar&raquo; do nosso guia ${r ? r.de : "de Portugal"}, para funcionar nos dois sentidos.</li>
</ul>

<p>Tudo o que vem depois do clique é connosco — marcação, pagamento, entrega. Ninguém vos volta a procurar por causa de logística.</p>

<p>Vale a pena? Respondam e enviamos o bloco e o link do guia.</p>

${signPt()}`,
  };
}

function managerPt(p: OutreachPartner): RawPitch {
  const r = ptRegion(p);
  const name = firstName(p);
  return {
    subject: "A pergunta sobre fotógrafos que os vossos hóspedes vos fazem",
    body: `<p>${name ? `Olá ${name},` : "Olá,"}</p>

<p>Somos a ${country.brand} — fotógrafos para quem está de viagem, por todo o país${r ? `, também ${r.em}` : ""}, reservados como os vossos hóspedes reservam tudo o resto: escolher a data, ver o preço, pagar no site.</p>

<p>Quem está numa villa pede um fotógrafo ao anfitrião com mais frequência do que o anfitrião tem resposta. É a família que não se juntava há anos, ou quem tem um pedido de casamento planeado para quinta-feira ao fim do dia. Esse pedido costuma ficar por ali.</p>

<p>Gostávamos de ser essa resposta, e fizemos com que não vos custe nada:</p>

<ul>
  <li>enviamos o bloco para a vossa página de experiências — texto e imagens, no formato que usarem. Vocês só colam;</li>
  <li>os vossos hóspedes são tratados primeiro: fotógrafo confirmado para a data, e não um pedido que fica sem resposta;</li>
  <li>tudo o que vem depois do clique é connosco — marcação, pagamento, entrega. Ninguém vos volta a procurar por causa de logística.</li>
</ul>

<p>E funciona nos dois sentidos: os nossos guias ${r ? r.de : "de Portugal"} recebem muita gente à procura exatamente do tipo de casas que gerem, e teremos todo o gosto em indicá-las.</p>

<p>Só pedimos que a menção tenha link, para ambos percebermos se a apresentação resulta.</p>

<p>Respondam e enviamos o bloco tal como ficaria no vosso site — decidem depois de ver.</p>

${signPt()}`,
  };
}

function aggregatorPt(p: OutreachPartner): RawPitch {
  const r = ptRegion(p);
  const name = firstName(p);
  return {
    subject: `Um capítulo sobre fotografia para os vossos guias ${r ? r.de : "de Portugal"}`,
    body: `<p>${name ? `Olá ${name},` : "Olá,"}</p>

<p>Somos a ${country.brand} — fotógrafos para quem está de viagem, por todo o país${r ? `, também ${r.em}` : ""}, com data, preço fixo e pagamento no site.</p>

<p>São os vossos hóspedes que pedem isto. Uma semana numa casa é a viagem que as pessoas querem fotografada — o reencontro de família, o aniversário, o pedido de casamento na segunda noite — e é a única coisa a que as vossas páginas ${r ? r.de : "de Portugal"} ainda não respondem.</p>

<p>Escrevíamos essa secção para vocês: que sítios perto das vossas casas funcionam a que hora, quanto custa uma sessão, com que antecedência planear. Fica vossa para editar, sem compromisso, e teremos todo o gosto em apontar os nossos guias ${r ? r.de : "de Portugal"} para as vossas casas.</p>

<p>Só pedimos que a menção tenha link, para ambos percebermos se resulta.</p>

<p>Vale a pena ver? Respondam e enviamos o rascunho.</p>

${signPt()}`,
  };
}

// ------------------------------------------------------------------- English

function signEn(): string {
  return `<p>Best,<br>The ${country.brand} team<br><a href="${country.baseUrl}">${country.host}</a></p>
<p style="color:#9B8E82;font-size:13px;">If you'd rather not hear from us again, just reply with &quot;no thanks&quot; and we'll take you off the list.</p>`;
}

function lodgingEn(p: OutreachPartner, opts?: PitchOptions): RawPitch {
  const where = enRegion(p);
  const name = firstName(p);
  return {
    subject: `A photographer for your guests${where ? ` in ${where}` : ""}`,
    body: `<p>${name ? `Hi ${name},` : "Hello,"}</p>

<p>We're ${country.brand} — travellers book local photographers through us across ${country.areaServed}${where ? `, ${where} included` : ""}. ${rosterEn(opts)}, live calendars, one fixed price, paid on the site.</p>

<p>Your guests are the ones asking for this. The family that finally got everyone to ${country.areaServed}, the couple with a proposal planned for the second evening — and the person they ask for a photographer is you.</p>

<p>If you'd like, we'll make that easy, and it costs you nothing:</p>

<ul>
  <li>a short block for your recommendations page or welcome book — copy and photos, ready to paste;</li>
  <li>your guests handled first: a confirmed photographer for the date, not a request into the void;</li>
  <li>and we'll add ${p.company_name} to the where-to-stay section of our ${where || country.areaServed} guide, so it runs both ways.</li>
</ul>

<p>Everything after the click is ours — scheduling, payment, delivery. Nobody comes back to you about logistics.</p>

<p>Worth a look? Reply and we'll send the block and the guide link.</p>

${signEn()}`,
  };
}

function managerEn(p: OutreachPartner): RawPitch {
  const where = enRegion(p);
  const name = firstName(p);
  return {
    subject: "The photographer question your guests ask you",
    body: `<p>${name ? `Hi ${name},` : "Hello,"}</p>

<p>We're ${country.brand} — vacation photographers across ${country.areaServed}${where ? `, ${where} included` : ""}, booked the way your guests book everything else: pick a date, see the price, pay on the site.</p>

<p>Guests in a villa ask their host for a photographer more often than the host has an answer ready. It's the family that hasn't been in one place together in years, or the one planning a proposal on the terrace on Thursday. That request usually goes nowhere.</p>

<p>We'd like to be the answer, and we've made it cost you nothing to give:</p>

<ul>
  <li>We send you the block for your experiences page — copy and images, in whatever format you use. You paste it.</li>
  <li>Your guests get handled first: a confirmed photographer for the date, not a request into the void.</li>
  <li>Everything after the click is ours — scheduling, payment, delivery. Nobody comes back to you about logistics.</li>
</ul>

<p>And it runs both ways: our ${where || country.areaServed} guides send a lot of people looking for exactly the kind of houses you manage, and we're glad to point them at you.</p>

<p>All we ask is that the mention links through, so we can both see whether the introduction actually works.</p>

<p>Reply and we'll send the block exactly as it would look on your site — decide after you've seen it.</p>

${signEn()}`,
  };
}

function aggregatorEn(p: OutreachPartner): RawPitch {
  const where = enRegion(p);
  const name = firstName(p);
  return {
    subject: `A photographer chapter for your ${where || country.areaServed} guides`,
    body: `<p>${name ? `Hi ${name},` : "Hello,"}</p>

<p>We're ${country.brand} — vacation photographers across ${country.areaServed}${where ? `, ${where} included` : ""}, bookable with a date, a fixed price and payment on the site.</p>

<p>Your guests are the ones who ask for this. A week in a villa is the trip people want photographed — the family reunion, the anniversary, the proposal on the second evening — and it's the one thing your ${where || country.areaServed} pages don't yet answer.</p>

<p>We'd write that section for you: which spots near your properties actually work at which hour, what a session costs, how far ahead to plan. Yours to edit, no obligation, and we're glad to point our own ${where || country.areaServed} guides at your houses in return.</p>

<p>The only thing we'd ask is that the mention links through, so we can both tell whether it works.</p>

<p>Worth a look? Reply and we'll send the draft.</p>

${signEn()}`,
  };
}

/** Plain-text alternative — a cold email without one is scored as bulk. */
export function toText(html: string): string {
  return html
    .replace(/<li>/g, "  - ")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>|<\/li>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Portuguese unless the row says otherwise. Only PT and EN copy exists, so any
 * other market falls back to English rather than shipping the wrong language.
 */
export function pitchLanguage(p: OutreachPartner): "pt" | "en" {
  const stated = (p.language || "").toLowerCase();
  if (stated === "pt") return "pt";
  if (stated === "en") return "en";
  return country.code === "pt" ? "pt" : "en";
}

export function buildPitch(p: OutreachPartner, opts?: PitchOptions): Pitch {
  const pt = pitchLanguage(p) === "pt";
  const isAggregator = p.segment === "villa_aggregator";
  const isManager = p.segment === "property_manager" || p.segment === "concierge";

  const raw = isAggregator
    ? (pt ? aggregatorPt(p) : aggregatorEn(p))
    : isManager
      ? (pt ? managerPt(p) : managerEn(p))
      : pt
        ? lodgingPt(p, opts)
        : lodgingEn(p, opts);

  return {
    subject: raw.subject,
    html: emailLayout(raw.body, pt ? "pt" : "en"),
    text: toText(raw.body),
  };
}

/** Opt-out mailbox rather than a URL: there is no unsubscribe endpoint. */
export function outreachHeaders(): Record<string, string> {
  return {
    "List-Unsubscribe": `<mailto:${country.supportEmail}?subject=unsubscribe>`,
  };
}
