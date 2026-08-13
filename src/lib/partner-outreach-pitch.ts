import { country } from "@/lib/country";
import { emailLayout } from "@/lib/email";

/**
 * The cold-outreach letter sent to accommodation-side partners.
 *
 * One builder, used by the cron sender and by its own dry-run preview, so the
 * preview shows exactly what leaves the server.
 *
 * What we offer is deliberately not money (decided 2026-08-13): no discount to
 * their guests, no commission to them. The trade is a ready-made block for
 * their recommendations page, priority handling for their guests, and a
 * mention in our own guide — offered, never promised up front, because at this
 * list size we cannot pre-commit a link to every recipient and a promise we
 * can't keep is worse than no letter.
 */

export interface OutreachPartner {
  company_name: string;
  contact_name?: string | null;
  region?: string | null;
  segment: string;
}

export interface Pitch {
  subject: string;
  html: string;
  text: string;
}

interface RawPitch {
  subject: string;
  body: string;
}

// A region needs two shapes in English and the wrong one is exactly what makes
// a letter read as mail-merge: "across THE Algarve" but "your Algarve guide".
const ARTICLE_REGIONS = /^(algarve|douro|alentejo|azores|madeira|silver coast|west|centro)$/i;

function regionParts(p: OutreachPartner): string[] {
  const raw = (p.region || "").trim();
  if (!raw || raw.toLowerCase() === "national") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2);
}

function joinList(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "across ___" — takes the article. Empty when the company is nationwide. */
function regionPhrase(p: OutreachPartner): string {
  const parts = regionParts(p).map((s) => (ARTICLE_REGIONS.test(s) ? `the ${s}` : s));
  return parts.length ? joinList(parts) : "";
}

/** "your ___ guide" — attributive, never takes the article. */
function regionAttr(p: OutreachPartner): string {
  const parts = regionParts(p);
  return parts.length ? joinList(parts) : country.areaServed;
}

function greeting(p: OutreachPartner): string {
  const first = (p.contact_name || "").trim().split(/\s+/)[0];
  // Only greet by name when it looks like one. Harvested contact fields hold
  // things like "Reservations" and "Front Desk", and "Hi Reservations," is
  // worse than no name at all.
  if (first && /^[A-ZÀ-Ý][a-zà-ÿ'’-]+$/.test(first)) return `Hi ${first},`;
  return "Hello,";
}

const OPT_OUT =
  'If you\'d rather not hear from us again, just reply with "no thanks" and we\'ll take you off the list.';

function sign(): string {
  return `<p>Best,<br>The ${country.brand} team<br><a href="${country.baseUrl}">${country.host}</a></p>
<p style="color:#9B8E82;font-size:13px;">${OPT_OUT}</p>`;
}

// Hotels, guest houses, apartments, hostels — the volume segment. The hook is
// that the guest asks THEM and they have no answer ready.
function lodgingPitch(p: OutreachPartner): RawPitch {
  const where = regionPhrase(p);
  const attr = regionAttr(p);
  return {
    subject: `A photographer for your guests in ${attr}`,
    body: `<p>${greeting(p)}</p>

<p>We're ${country.brand} — travellers book local photographers through us across ${country.areaServed}${where ? `, ${where} included` : ""}. Fifty photographers, live calendars, one fixed price, paid on the site.</p>

<p>Your guests are the ones asking for this. The family that finally got everyone to ${country.areaServed}, the couple with a proposal planned for the second evening — and the person they ask for a photographer is you.</p>

<p>If you'd like, we'll make that easy, and it costs you nothing:</p>

<ul>
  <li>a short block for your recommendations page or welcome book — copy and photos, ready to paste;</li>
  <li>your guests handled first: a confirmed photographer for the date, not a request into the void;</li>
  <li>and we'll add ${p.company_name} to the where-to-stay section of our ${attr} guide, so it runs both ways.</li>
</ul>

<p>Everything after the click is ours — scheduling, payment, delivery. Nobody comes back to you about logistics.</p>

<p>Worth a look? Reply and we'll send the block and the guide link.</p>

${sign()}`,
  };
}

// Property managers and concierge companies: they already sell the guest a
// private chef and a transfer, so this is one more line on an existing menu.
function managerPitch(p: OutreachPartner): RawPitch {
  const where = regionPhrase(p);
  const attr = regionAttr(p);
  return {
    subject: "The photographer question your guests ask you",
    body: `<p>${greeting(p)}</p>

<p>We're ${country.brand} — vacation photographers across ${country.areaServed}${where ? `, ${where} included` : ""}, booked the way your guests book everything else: pick a date, see the price, pay on the site.</p>

<p>Guests in a villa ask their host for a photographer more often than the host has an answer ready. It's the family that hasn't been in one place together in years, or the one planning a proposal on the terrace on Thursday. That request usually goes nowhere.</p>

<p>We'd like to be the answer, and we've made it cost you nothing to give:</p>

<ul>
  <li>We send you the block for your experiences page — copy and images, in whatever format you use. You paste it.</li>
  <li>Your guests get handled first: a confirmed photographer for the date, not a request into the void.</li>
  <li>Everything after the click is ours — scheduling, payment, delivery. Nobody comes back to you about logistics.</li>
</ul>

<p>And it runs both ways: our ${attr} guides send a lot of people looking for exactly the kind of houses you manage, and we're glad to point them at you.</p>

<p>All we ask is that the mention links through, so we can both see whether the introduction actually works.</p>

<p>Reply and we'll send the block exactly as it would look on your site — decide after you've seen it.</p>

${sign()}`,
  };
}

// Villa aggregators: editorial sites with destination pages. No concierge desk,
// so the offer is content for the guide rather than a line on a menu.
function aggregatorPitch(p: OutreachPartner): RawPitch {
  const where = regionPhrase(p);
  const attr = regionAttr(p);
  return {
    subject: `A photographer chapter for your ${attr} guides`,
    body: `<p>${greeting(p)}</p>

<p>We're ${country.brand} — vacation photographers across ${country.areaServed}${where ? `, ${where} included` : ""}, bookable with a date, a fixed price and payment on the site.</p>

<p>Your guests are the ones who ask for this. A week in a villa is the trip people want photographed — the family reunion, the anniversary, the proposal on the second evening — and it's the one thing your ${attr} pages don't yet answer.</p>

<p>We'd write that section for you: which spots near your properties actually work at which hour, what a session costs, how far ahead to plan. Yours to edit, no obligation, and we're glad to point our own ${attr} guides at your houses in return.</p>

<p>The only thing we'd ask is that the mention links through, so we can both tell whether it works.</p>

<p>Worth a look? Reply and we'll send the draft.</p>

${sign()}`,
  };
}

/** Plain-text alternative — a cold email without one is scored as bulk. */
export function toText(html: string): string {
  return html
    .replace(/<li>/g, "  - ")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>|<\/li>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildPitch(p: OutreachPartner): Pitch {
  const raw =
    p.segment === "villa_aggregator"
      ? aggregatorPitch(p)
      : p.segment === "property_manager" || p.segment === "concierge"
        ? managerPitch(p)
        : lodgingPitch(p);

  return {
    subject: raw.subject,
    html: emailLayout(raw.body),
    text: toText(raw.body),
  };
}

/** Opt-out mailbox rather than a URL: there is no unsubscribe endpoint. */
export function outreachHeaders(): Record<string, string> {
  return {
    "List-Unsubscribe": `<mailto:${country.supportEmail}?subject=unsubscribe>`,
  };
}
