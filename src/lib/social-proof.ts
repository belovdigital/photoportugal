import { query } from "@/lib/db";
import { locations } from "@/lib/locations-data";

// ---------------------------------------------------------------------------
// Social-proof activity feed (TrustPulse-style, but tasteful).
//
// Powers the small bottom-left toaster with CONCRETE, named, real events:
//   "Sarah booked Isa in Algarve · yesterday"
//   "Isa delivered Sarah's gallery in Porto · 3 days ago"
//   "Sarah left Isa a ★★★★★ review · this week"
//
// Everything here runs SERVER-SIDE only and returns fully-localized strings —
// the client component is purely presentational. That deliberately avoids the
// next-intl raw-key-leak footgun (see CLAUDE.md): no `useTranslations`
// anywhere near this feature, so there are no keys to forget.
//
// Guardrails:
//   - First names only (client + photographer). No surnames, no emails.
//   - Proposal bookings are EXCLUDED entirely (same discretion we apply to
//     proposal SMS — a surprise must not leak via social proof).
//   - Cancelled bookings and banned/deactivated photographers are excluded
//     (don't advertise a shoot that fell through or a photographer who left).
//   - Rolling 14-45 day window, not "live" — real volume is ~1-2 events/day,
//     so a curated recent feed is both honest and avoids an empty/looping
//     widget. Relative time is concrete ("3 days ago"), never a fake "just now".
//
// ORDER MATTERS: the feed comes back strictly freshest-first. The wide query
// windows exist only as a tail fallback for slow weeks — on a normal week the
// head of the feed is all events from the last few days, and the client shows
// cards from the head. Do not reorder this by kind (see `freshestFirst`).
// ---------------------------------------------------------------------------

export type SocialProofLocale = "en" | "pt" | "de" | "es" | "fr";
export type SocialProofKind = "booked" | "delivered" | "review" | "aggregate";

// The photographer name is rendered as a clickable link, so the sentence
// comes back split around it: `${pre}${name->link}${post}`. For aggregate
// events (no photographer) `name`/`href` are null and `pre` holds the whole
// line. A private sentinel lets us locate the name slot regardless of any
// substring collisions with the client's name or city.
const NAME_SLOT = "\u0000";

export interface SocialProofEvent {
  id: string;
  kind: SocialProofKind;
  pre: string;
  name: string | null; // photographer first name (the link label)
  href: string | null; // /photographers/<slug>
  post: string;
  meta: string; // small secondary line — relative time, e.g. "Yesterday"
  ageDays: number; // whole days since the event; the feed is sorted by this
}

const LOCALES: SocialProofLocale[] = ["en", "pt", "de", "es", "fr"];

// --- city slug -> localized display name -----------------------------------
type CityNames = Record<SocialProofLocale, string>;
const CITY_MAP: Map<string, CityNames> = new Map(
  locations.map((l) => [
    l.slug,
    {
      en: l.name,
      pt: l.name_pt || l.name,
      de: l.name_de || l.name,
      es: l.name_es || l.name,
      fr: l.name_fr || l.name,
    },
  ])
);

function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w === "sao" ? "São" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const COUNTRY: CityNames = { en: "Portugal", pt: "Portugal", de: "Portugal", es: "Portugal", fr: "Portugal" };

function cityName(slug: string | null, locale: SocialProofLocale): string {
  if (!slug) return COUNTRY[locale];
  const found = CITY_MAP.get(slug);
  if (found) return found[locale];
  return prettifySlug(slug);
}

// --- sentence templates + relative-time labels ------------------------------
interface Strings {
  stats: string;
  today: string;
  yesterday: string;
  daysAgo: (n: number) => string;
  booked: (client: string, photographer: string, city: string) => string;
  delivered: (client: string, photographer: string, city: string) => string;
  review: (client: string, photographer: string, stars: number) => string;
  aggregate: (n: number) => string;
}

const STRINGS: Record<SocialProofLocale, Strings> = {
  en: {
    stats: "Live on Photo Portugal",
    today: "Today",
    yesterday: "Yesterday",
    daysAgo: (n) => `${n} days ago`,
    booked: (c, p, city) => `${c} booked ${p} in ${city}`,
    delivered: (c, p, city) => `${p} delivered ${c}’s gallery in ${city}`,
    review: (c, p, s) => `${c} left ${p} a ${s}-star review`,
    aggregate: (n) => `${n} shoots booked across Portugal in the last 30 days`,
  },
  pt: {
    stats: "Em direto na Photo Portugal",
    today: "Hoje",
    yesterday: "Ontem",
    daysAgo: (n) => `há ${n} dias`,
    booked: (c, p, city) => `${c} reservou ${p} em ${city}`,
    delivered: (c, p, city) => `${p} entregou a galeria de ${c} em ${city}`,
    review: (c, p, s) => `${c} deixou uma avaliação de ${s} estrelas a ${p}`,
    aggregate: (n) => `${n} sessões reservadas por todo Portugal nos últimos 30 dias`,
  },
  de: {
    stats: "Live auf Photo Portugal",
    today: "Heute",
    yesterday: "Gestern",
    daysAgo: (n) => `vor ${n} Tagen`,
    booked: (c, p, city) => `${c} hat ${p} in ${city} gebucht`,
    delivered: (c, p, city) => `${p} hat ${c}s Galerie in ${city} geliefert`,
    review: (c, p, s) => `${c} hat ${p} mit ${s} Sternen bewertet`,
    aggregate: (n) => `${n} Shootings in den letzten 30 Tagen in ganz Portugal gebucht`,
  },
  es: {
    stats: "En directo en Photo Portugal",
    today: "Hoy",
    yesterday: "Ayer",
    daysAgo: (n) => `hace ${n} días`,
    booked: (c, p, city) => `${c} reservó a ${p} en ${city}`,
    delivered: (c, p, city) => `${p} entregó la galería de ${c} en ${city}`,
    review: (c, p, s) => `${c} dejó una reseña de ${s} estrellas a ${p}`,
    aggregate: (n) => `${n} sesiones reservadas en todo Portugal en los últimos 30 días`,
  },
  fr: {
    stats: "En direct sur Photo Portugal",
    today: "Aujourd’hui",
    yesterday: "Hier",
    daysAgo: (n) => `il y a ${n} jours`,
    booked: (c, p, city) => `${c} a réservé ${p} à ${city}`,
    delivered: (c, p, city) => `${p} a livré la galerie de ${c} à ${city}`,
    review: (c, p, s) => `${c} a laissé un avis de ${s} étoiles à ${p}`,
    aggregate: (n) => `${n} séances réservées dans tout le Portugal ces 30 derniers jours`,
  },
};

function timeMeta(ageSec: number, s: Strings): string {
  const days = Math.floor(ageSec / 86400);
  if (days <= 0) return s.today;
  if (days === 1) return s.yesterday;
  return s.daysAgo(days);
}

// Freshest first — full stop. The previous version round-robined by kind
// (booked, delivered, review, booked, ...), which put a 40-day-old review in
// slot 3 while a 1-day-old booking sat at slot 5. Sorting globally by age is
// what makes the widget read as "this place is busy right now".
//
// The one concession to variety: never show three cards of the same kind in a
// row. When that's about to happen we look a SHORT distance ahead for a
// different kind — the lookahead is capped so an older event can only ever
// jump a couple of slots forward. Freshness always dominates.
const MAX_SAME_KIND_RUN = 2;
const KIND_LOOKAHEAD = 3;

function freshestFirst(events: SocialProofEvent[]): SocialProofEvent[] {
  const pool = [...events].sort((a, b) => a.ageDays - b.ageDays);
  const out: SocialProofEvent[] = [];
  let runKind: SocialProofKind | null = null;
  let runLen = 0;

  while (pool.length > 0) {
    let idx = 0;
    if (runKind !== null && runLen >= MAX_SAME_KIND_RUN && pool[0].kind === runKind) {
      const alt = pool.slice(0, KIND_LOOKAHEAD + 1).findIndex((e) => e.kind !== runKind);
      if (alt > 0) idx = alt;
    }
    const [ev] = pool.splice(idx, 1);
    out.push(ev);
    if (ev.kind === runKind) {
      runLen += 1;
    } else {
      runKind = ev.kind;
      runLen = 1;
    }
  }
  return out;
}

interface BookingRow { id: string; client: string | null; photographer: string | null; photog_slug: string | null; slug: string | null; age: number }
interface ReviewRow { id: string; rating: number; client: string | null; photographer: string | null; photog_slug: string | null; slug: string | null; age: number }
interface CountRow { n: number }

// Build the localized sentence with the photographer name in a sentinel slot,
// then split so the client can render just the name as a profile link.
function splitForLink(rendered: string, name: string, slug: string | null) {
  const [pre, post = ""] = rendered.split(NAME_SLOT);
  return { pre, name, href: slug ? `/photographers/${slug}` : null, post };
}

// First name only, trimmed; null if we couldn't derive anything usable.
const FIRST = (col: string) => `NULLIF(split_part(trim(${col}), ' ', 1), '')`;
const NOT_PROPOSAL = "(b.occasion IS NULL OR LOWER(b.occasion) NOT LIKE '%proposal%')";
const PHOTOG_OK = "COALESCE(pu.is_banned, false) = false AND pu.deactivated_at IS NULL";

export async function buildSocialProofFeed(localeIn: string): Promise<SocialProofEvent[]> {
  const locale: SocialProofLocale = (LOCALES as string[]).includes(localeIn)
    ? (localeIn as SocialProofLocale)
    : "en";
  const s = STRINGS[locale];

  const [bookedRows, deliveredRows, reviewRows, countRows] = await Promise.all([
    query<BookingRow>(
      `SELECT b.id,
              COALESCE(${FIRST("cu.first_name")}, ${FIRST("cu.name")}) AS client,
              COALESCE(${FIRST("pu.first_name")}, ${FIRST("pu.name")}) AS photographer,
              pp.slug AS photog_slug,
              b.location_slug AS slug,
              EXTRACT(EPOCH FROM (NOW() - b.created_at))::bigint AS age
         FROM bookings b
         JOIN users cu ON cu.id = b.client_id
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
        WHERE b.payment_status = 'paid'
          AND b.status <> 'cancelled'
          AND b.created_at > NOW() - INTERVAL '14 days'
          AND ${NOT_PROPOSAL} AND ${PHOTOG_OK}
        ORDER BY b.created_at DESC
        LIMIT 30`
    ),
    query<BookingRow>(
      `SELECT b.id,
              COALESCE(${FIRST("cu.first_name")}, ${FIRST("cu.name")}) AS client,
              COALESCE(${FIRST("pu.first_name")}, ${FIRST("pu.name")}) AS photographer,
              pp.slug AS photog_slug,
              b.location_slug AS slug,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(b.delivery_accepted_at, b.updated_at)))::bigint AS age
         FROM bookings b
         JOIN users cu ON cu.id = b.client_id
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
        WHERE b.delivery_accepted = TRUE
          AND COALESCE(b.delivery_accepted_at, b.updated_at) > NOW() - INTERVAL '30 days'
          AND ${NOT_PROPOSAL} AND ${PHOTOG_OK}
        ORDER BY COALESCE(b.delivery_accepted_at, b.updated_at) DESC
        LIMIT 25`
    ),
    query<ReviewRow>(
      `SELECT r.id, r.rating,
              COALESCE(${FIRST("r.client_name_override")}, ${FIRST("cu.first_name")}, ${FIRST("cu.name")}) AS client,
              COALESCE(${FIRST("pu.first_name")}, ${FIRST("pu.name")}) AS photographer,
              pp.slug AS photog_slug,
              bk.location_slug AS slug,
              EXTRACT(EPOCH FROM (NOW() - r.created_at))::bigint AS age
         FROM reviews r
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         LEFT JOIN users cu ON cu.id = r.client_id
         LEFT JOIN bookings bk ON bk.id = r.booking_id
        WHERE r.is_approved = TRUE
          AND r.rating >= 4
          AND r.created_at > NOW() - INTERVAL '45 days'
          AND ${PHOTOG_OK}
        ORDER BY r.created_at DESC
        LIMIT 20`
    ),
    query<CountRow>(
      `SELECT COUNT(*)::int AS n
         FROM bookings
        WHERE payment_status = 'paid'
          AND status <> 'cancelled'
          AND created_at > NOW() - INTERVAL '30 days'`
    ),
  ]);

  // Dedup booking-derived kinds by booking id. A booking that's both paid
  // and delivered surfaces once, at its furthest stage (delivered wins).
  const usedBookingIds = new Set<string>();
  const take = (rows: BookingRow[]) => rows.filter((r) => {
    if (!r.client || !r.photographer) return false;
    if (usedBookingIds.has(r.id)) return false;
    usedBookingIds.add(r.id);
    return true;
  });

  // Delivery ordering falls back to updated_at when delivery_accepted_at is
  // missing; clamp so an unrelated row touch can never fake a "Today" card.
  const ageOf = (raw: unknown) => Math.max(0, Math.floor(Number(raw) / 86400));

  const delivered = take(deliveredRows).map<SocialProofEvent>((r) => ({
    id: `d_${r.id}`,
    kind: "delivered",
    ...splitForLink(s.delivered(r.client!, NAME_SLOT, cityName(r.slug, locale)), r.photographer!, r.photog_slug),
    meta: timeMeta(Number(r.age), s),
    ageDays: ageOf(r.age),
  }));
  const booked = take(bookedRows).map<SocialProofEvent>((r) => ({
    id: `b_${r.id}`,
    kind: "booked",
    ...splitForLink(s.booked(r.client!, NAME_SLOT, cityName(r.slug, locale)), r.photographer!, r.photog_slug),
    meta: timeMeta(Number(r.age), s),
    ageDays: ageOf(r.age),
  }));
  const reviews = reviewRows
    .filter((r) => r.client && r.photographer)
    .map<SocialProofEvent>((r) => ({
      id: `r_${r.id}`,
      kind: "review",
      ...splitForLink(s.review(r.client!, NAME_SLOT, r.rating), r.photographer!, r.photog_slug),
      meta: timeMeta(Number(r.age), s),
      ageDays: ageOf(r.age),
    }));

  // Sort everything by age, then drop any accidental duplicate sentences.
  const seenText = new Set<string>();
  const feed = freshestFirst([...booked, ...delivered, ...reviews])
    .filter((e) => {
      const key = `${e.pre}${e.name ?? ""}${e.post}`;
      if (seenText.has(key)) return false;
      seenText.add(key);
      return true;
    })
    .slice(0, 24);

  // The 30-day rolling counter is never stale, but it isn't an *event* either —
  // it must not displace a fresh named card. Park it just past the head the
  // client draws from, so it surfaces occasionally and leads only when there
  // are no real events at all.
  if (countRows[0] && countRows[0].n >= 5) {
    const agg: SocialProofEvent = {
      id: "agg_30d",
      kind: "aggregate",
      pre: s.aggregate(countRows[0].n),
      name: null,
      href: null,
      post: "",
      meta: s.stats,
      ageDays: 0,
    };
    feed.splice(Math.min(4, feed.length), 0, agg);
  }
  return feed;
}
