import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getLocationBySlug,
  getNearbyLocations,
  locationFaqs,
  locField,
  faqField,
} from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { photoSpots, sortSpotsByOccasion, spotSlug, spotLocalized } from "@/lib/photo-spots-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { queryOne, query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { PhotographerCardCompact } from "@/components/ui/PhotographerCardCompact";
import { LocationCard } from "@/components/ui/LocationCard";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForLocation } from "@/lib/reviews-data";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { formatDuration } from "@/lib/package-pricing";
import { HeroSingleVariant, type HeroFeaturedPhotographer, type HeroLocationContext } from "@/components/ui/HeroSingleVariant";
import { PortfolioMosaic } from "@/components/ui/PortfolioMosaic";
import { LocationPhotosMasonry, type LocationMasonryPhoto } from "@/components/ui/LocationPhotosMasonry";
import { LocationStickyBookBar } from "@/components/ui/LocationStickyBookBar";
import { locationImage } from "@/lib/unsplash-images";
import { getComboIntro } from "@/lib/location-occasion-intros";

// Combo /locations/[slug]/[occasion] is the SEO + paid-ad sitelink target
// for queries like "Couples photographer Algarve" or "Family photoshoot
// Lisbon". Same visual template as the parent location page so the visitor
// doesn't feel like they fell off a cliff — every section is filtered or
// re-framed for the occasion.
export const dynamic = "force-dynamic";

// ─── Occasion catalogue (used for hero label, meta, "other occasions"
//     pills, and the canonical-EN noun for SQL filtering). Kept inline so
//     this page works standalone; matches the long-standing OCCASIONS map
//     from the previous version of this file.
type OccasionEntry = {
  /** EN/PT/DE/ES/FR singular noun phrase, e.g. "Couples Photographer" */
  title: string;
  titlePt: string;
  titleDe: string;
  titleEs?: string;
  titleFr?: string;
  description: string;
  descriptionPt: string;
  descriptionDe: string;
  descriptionEs?: string;
  descriptionFr?: string;
  emoji: string;
};

const OCCASIONS: Record<string, OccasionEntry> = {
  proposal: {
    title: "Proposal Photographer",
    titlePt: "Fotógrafo de Pedido de Casamento",
    titleDe: "Fotograf für Heiratsantrag",
    titleEs: "Fotógrafo para Pedida de Mano",
    titleFr: "Photographe de demande en mariage",
    description: "Capture your surprise proposal with a professional photographer who will discreetly document every moment of this life-changing event.",
    descriptionPt: "Capture o seu pedido de casamento surpresa com um fotógrafo profissional que documentará discretamente cada momento deste evento.",
    descriptionDe: "Halten Sie Ihren Überraschungsantrag mit einem professionellen Fotografen fest, der jeden Moment dieses bewegenden Ereignisses diskret dokumentiert.",
    descriptionEs: "Capture su pedida sorpresa con un fotógrafo profesional que documentará con discreción cada momento de este evento que cambia la vida.",
    descriptionFr: "Capturez votre demande surprise avec un photographe professionnel qui documentera discrètement chaque instant de ce moment qui change la vie.",
    emoji: "💍",
  },
  honeymoon: {
    title: "Honeymoon Photographer",
    titlePt: "Fotógrafo de Lua de Mel",
    titleDe: "Fotograf für die Flitterwochen",
    titleEs: "Fotógrafo de Luna de Miel",
    titleFr: "Photographe de lune de miel",
    description: "Celebrate your honeymoon with stunning professional photos at the most romantic spots. Natural, candid moments that tell your love story.",
    descriptionPt: "Celebre a sua lua de mel com fotos profissionais deslumbrantes nos locais mais românticos.",
    descriptionDe: "Feiern Sie Ihre Flitterwochen mit traumhaften professionellen Fotos an den romantischsten Orten. Natürliche, unverfälschte Momente, die Ihre Liebesgeschichte erzählen.",
    descriptionEs: "Celebre su luna de miel con fotos profesionales impresionantes en los lugares más románticos. Momentos naturales y espontáneos que cuentan su historia de amor.",
    descriptionFr: "Célébrez votre lune de miel avec de magnifiques photos professionnelles dans les lieux les plus romantiques. Des moments naturels et spontanés qui racontent votre histoire d'amour.",
    emoji: "🥂",
  },
  couples: {
    title: "Couples Photographer",
    titlePt: "Fotógrafo de Casais",
    titleDe: "Paar-Fotograf",
    titleEs: "Fotógrafo de Parejas",
    titleFr: "Photographe de couple",
    description: "Professional couples photography for vacations, anniversaries, and romantic getaways. Relaxed, natural sessions that capture real connection.",
    descriptionPt: "Fotografia profissional de casais para férias, aniversários e escapadelas românticas.",
    descriptionDe: "Professionelle Paarfotografie für Urlaube, Hochzeitstage und romantische Auszeiten. Entspannte, natürliche Sessions, die echte Verbundenheit einfangen.",
    descriptionEs: "Fotografía profesional de parejas para vacaciones, aniversarios y escapadas románticas. Sesiones relajadas y naturales que capturan la conexión real.",
    descriptionFr: "Photographie de couple professionnelle pour les vacances, anniversaires et escapades romantiques. Des séances détendues et naturelles qui capturent la vraie connexion.",
    emoji: "❤️",
  },
  family: {
    title: "Family Photographer",
    titlePt: "Fotógrafo de Família",
    titleDe: "Familienfotograf",
    titleEs: "Fotógrafo de Familias",
    titleFr: "Photographe de famille",
    description: "Kid-friendly family photoshoots with experienced photographers who know how to keep everyone relaxed and capture genuine moments.",
    descriptionPt: "Sessões fotográficas familiares com fotógrafos experientes que sabem captar momentos genuínos.",
    descriptionDe: "Familienfreundliche Fotoshootings mit erfahrenen Fotografen, die wissen, wie alle entspannt bleiben und echte Momente festgehalten werden.",
    descriptionEs: "Sesiones familiares amigables con niños, con fotógrafos experimentados que saben mantener a todos relajados y capturar momentos auténticos.",
    descriptionFr: "Séances de famille adaptées aux enfants, avec des photographes expérimentés qui savent mettre tout le monde à l'aise et capturer des moments authentiques.",
    emoji: "👨‍👩‍👧‍👦",
  },
  solo: {
    title: "Solo Travel Photographer",
    titlePt: "Fotógrafo para Viajantes Solo",
    titleDe: "Fotograf für Alleinreisende",
    titleEs: "Fotógrafo para Viajeros Solos",
    titleFr: "Photographe pour voyageurs solo",
    description: "Professional portraits for solo travelers. Get amazing photos of yourself at iconic locations — no more selfies or asking strangers.",
    descriptionPt: "Retratos profissionais para viajantes solo. Fotos incríveis em locais icónicos.",
    descriptionDe: "Professionelle Porträts für Alleinreisende. Wunderschöne Aufnahmen von Ihnen an ikonischen Orten — keine Selfies, keine Fremden mehr fragen.",
    descriptionEs: "Retratos profesionales para viajeros solos. Consiga fotos increíbles de usted mismo en lugares icónicos — sin selfies ni pedir favores a desconocidos.",
    descriptionFr: "Portraits professionnels pour voyageurs solo. Obtenez de magnifiques photos de vous-même dans des lieux iconiques — fini les selfies et les inconnus.",
    emoji: "🧳",
  },
  engagement: {
    title: "Engagement Photographer",
    titlePt: "Fotógrafo de Noivado",
    titleDe: "Verlobungsfotograf",
    titleEs: "Fotógrafo de Compromiso",
    titleFr: "Photographe de fiançailles",
    description: "Pre-wedding engagement photoshoots at stunning locations. Perfect for save-the-dates, announcements, or simply celebrating your engagement.",
    descriptionPt: "Sessões fotográficas de noivado em locais deslumbrantes.",
    descriptionDe: "Verlobungsfotoshootings vor der Hochzeit an beeindruckenden Orten. Perfekt für Save-the-Dates, Ankündigungen oder einfach zur Feier Ihrer Verlobung.",
    descriptionEs: "Sesiones de compromiso pre-boda en lugares impresionantes. Perfectas para save-the-dates, anuncios o simplemente para celebrar su compromiso.",
    descriptionFr: "Séances de fiançailles avant le mariage dans des lieux magnifiques. Parfaites pour les save-the-dates, annonces ou simplement pour célébrer vos fiançailles.",
    emoji: "💑",
  },
  elopement: {
    title: "Elopement Photographer",
    titlePt: "Fotógrafo de Elopement",
    titleDe: "Elopement-Fotograf",
    titleEs: "Fotógrafo de Boda Íntima",
    titleFr: "Photographe d'elopement",
    description: "Intimate elopement photography for couples choosing to celebrate their love privately in one of the most beautiful countries in Europe.",
    descriptionPt: "Fotografia íntima de elopement para casais que escolhem celebrar o seu amor em privado.",
    descriptionDe: "Intime Elopement-Fotografie für Paare, die ihre Liebe privat in einem der schönsten Länder Europas feiern möchten.",
    descriptionEs: "Fotografía íntima de boda íntima (elopement) para parejas que eligen celebrar su amor en privado en uno de los países más bellos de Europa.",
    descriptionFr: "Photographie intime d'elopement pour les couples qui choisissent de célébrer leur amour en privé dans l'un des plus beaux pays d'Europe.",
    emoji: "🌿",
  },
};

const localeKey: Record<string, "Pt" | "De" | "Es" | "Fr"> = {
  pt: "Pt", de: "De", es: "Es", fr: "Fr",
};

function occTitle(o: OccasionEntry, locale: string) {
  const k = localeKey[locale];
  if (k) {
    const v = o[`title${k}` as keyof OccasionEntry] as string | undefined;
    if (v) return v;
  }
  return o.title;
}
function occDesc(o: OccasionEntry, locale: string) {
  const k = localeKey[locale];
  if (k) {
    const v = o[`description${k}` as keyof OccasionEntry] as string | undefined;
    if (v) return v;
  }
  return o.description;
}

// "in / em / à / en" preposition that connects "<Occasion> in <Location>"
// in the hero h1. Per-locale, since the existing message catalog has no
// stand-alone "in" key.
const IN_PREP: Record<string, string> = {
  en: "in", pt: "em", de: "in", es: "en", fr: "à",
};

// ─── Page-local UI strings ──────────────────────────────────────────────
const L = {
  en: {
    metaTitle: (occ: string, loc: string) => `${occ} in ${loc} — Book a Photoshoot`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Book your ${occLower} in ${loc}. Verified portfolios, instant booking. From €150.`,
    home: "Home",
    locations: "Locations",
    aboutLocation: (loc: string) => `About ${loc}`,
    otherOccasions: (loc: string) => `Other photoshoots in ${loc}`,
    nearbyTitle: (occ: string) => `${occ} in nearby destinations`,
    nearbySub: (loc: string) => `Also consider these locations near ${loc}.`,
    inLocation: "in",
    viewPhotographers: "View photographers",
    faqTitle: "Frequently asked questions",
    ctaTitle: (occLower: string, loc: string) => `Ready to book your ${occLower} in ${loc}?`,
    ctaSub: "Browse verified photographers and book in minutes — no commitment, money-back guarantee.",
    ctaBtn: "Browse Photographers",
    seePhotographersLink: "See all photographers in",
    introHeading: (occ: string, loc: string) => `${occ} in ${loc}`,
    photographersAvailable: (count: number, loc: string) =>
      `${count} ${count === 1 ? "photographer" : "photographers"} ready to shoot in ${loc}`,
  },
  pt: {
    metaTitle: (occ: string, loc: string) => `${occ} em ${loc} — Reserve Sessão Fotográfica`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Reserve o seu ${occLower} em ${loc}. Portfólios verificados, reserva instantânea. Desde 150 €.`,
    home: "Início",
    locations: "Localizações",
    aboutLocation: (loc: string) => `Sobre ${loc}`,
    otherOccasions: (loc: string) => `Outras sessões em ${loc}`,
    nearbyTitle: (occ: string) => `${occ} em destinos próximos`,
    nearbySub: (loc: string) => `Considere também estas localizações perto de ${loc}.`,
    inLocation: "em",
    viewPhotographers: "Ver fotógrafos",
    faqTitle: "Perguntas frequentes",
    ctaTitle: (occLower: string, loc: string) => `Pronto para reservar o seu ${occLower} em ${loc}?`,
    ctaSub: "Veja fotógrafos verificados e reserve em minutos — sem compromisso, com garantia de reembolso.",
    ctaBtn: "Ver Fotógrafos",
    seePhotographersLink: "Ver todos os fotógrafos em",
    introHeading: (occ: string, loc: string) => `${occ} em ${loc}`,
    photographersAvailable: (count: number, loc: string) =>
      `${count} ${count === 1 ? "fotógrafo pronto" : "fotógrafos prontos"} para fotografar em ${loc}`,
  },
  de: {
    metaTitle: (occ: string, loc: string) => `${occ} in ${loc} — Fotoshooting buchen`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Buchen Sie Ihren ${occLower} in ${loc}. Verifizierte Portfolios, sofortige Buchung. Ab 150 €.`,
    home: "Startseite",
    locations: "Orte",
    aboutLocation: (loc: string) => `Über ${loc}`,
    otherOccasions: (loc: string) => `Weitere Shootings in ${loc}`,
    nearbyTitle: (occ: string) => `${occ} an Orten in der Nähe`,
    nearbySub: (loc: string) => `Schauen Sie sich auch diese Orte in der Nähe von ${loc} an.`,
    inLocation: "in",
    viewPhotographers: "Fotografen ansehen",
    faqTitle: "Häufig gestellte Fragen",
    ctaTitle: (occLower: string, loc: string) => `Bereit, Ihren ${occLower} in ${loc} zu buchen?`,
    ctaSub: "Verifizierte Fotografen ansehen und in wenigen Minuten buchen — unverbindlich, mit Geld-zurück-Garantie.",
    ctaBtn: "Fotografen ansehen",
    seePhotographersLink: "Alle Fotografen anzeigen in",
    introHeading: (occ: string, loc: string) => `${occ} in ${loc}`,
    photographersAvailable: (count: number, loc: string) =>
      `${count} ${count === 1 ? "Fotograf bereit" : "Fotografen bereit"} für Shootings in ${loc}`,
  },
  es: {
    metaTitle: (occ: string, loc: string) => `${occ} en ${loc} — Reserve su sesión fotográfica`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Reserve su ${occLower} en ${loc}. Portafolios verificados, reserva al instante. Desde 150 €.`,
    home: "Inicio",
    locations: "Ubicaciones",
    aboutLocation: (loc: string) => `Sobre ${loc}`,
    otherOccasions: (loc: string) => `Otras sesiones en ${loc}`,
    nearbyTitle: (occ: string) => `${occ} en destinos cercanos`,
    nearbySub: (loc: string) => `Considere también estos lugares cerca de ${loc}.`,
    inLocation: "en",
    viewPhotographers: "Ver fotógrafos",
    faqTitle: "Preguntas frecuentes",
    ctaTitle: (occLower: string, loc: string) => `¿Listo para reservar su ${occLower} en ${loc}?`,
    ctaSub: "Vea fotógrafos verificados y reserve en minutos — sin compromiso, con garantía de devolución.",
    ctaBtn: "Ver fotógrafos",
    seePhotographersLink: "Ver todos los fotógrafos en",
    introHeading: (occ: string, loc: string) => `${occ} en ${loc}`,
    photographersAvailable: (count: number, loc: string) =>
      `${count} ${count === 1 ? "fotógrafo listo" : "fotógrafos listos"} para sesiones en ${loc}`,
  },
  fr: {
    metaTitle: (occ: string, loc: string) => `${occ} à ${loc} — Réservez votre séance photo`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Réservez votre ${occLower} à ${loc}. Portfolios vérifiés, réservation immédiate. À partir de 150 €.`,
    home: "Accueil",
    locations: "Lieux",
    aboutLocation: (loc: string) => `À propos de ${loc}`,
    otherOccasions: (loc: string) => `Autres séances à ${loc}`,
    nearbyTitle: (occ: string) => `${occ} dans des destinations proches`,
    nearbySub: (loc: string) => `Pensez aussi à ces lieux près de ${loc}.`,
    inLocation: "à",
    viewPhotographers: "Voir les photographes",
    faqTitle: "Questions fréquentes",
    ctaTitle: (occLower: string, loc: string) => `Prêt à réserver votre ${occLower} à ${loc} ?`,
    ctaSub: "Parcourez les photographes vérifiés et réservez en quelques minutes — sans engagement, avec garantie de remboursement.",
    ctaBtn: "Voir les photographes",
    seePhotographersLink: "Voir tous les photographes à",
    introHeading: (occ: string, loc: string) => `${occ} à ${loc}`,
    photographersAvailable: (count: number, loc: string) =>
      `${count} ${count === 1 ? "photographe prêt" : "photographes prêts"} pour des séances à ${loc}`,
  },
} as const;

function pickL(locale: string): typeof L.en {
  return (L as unknown as Record<string, typeof L.en>)[locale] || L.en;
}

export function generateStaticParams() {
  // 34 locations × 7 occasions = 238 paths. Don't pre-generate — `dynamic
  // = "force-dynamic"` above keeps these on-demand and fresh.
  return [] as Array<{ slug: string; occasion: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; occasion: string }>;
}): Promise<Metadata> {
  const { locale, slug, occasion } = await params;
  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) return {};

  const t = pickL(locale);
  const occT = occTitle(occ, locale);
  const occD = getComboIntro(slug, occasion, locale) || occDesc(occ, locale);
  const locName = locField(location, "name", locale) || location.name;
  const title = t.metaTitle(occT, locName);
  const description = t.metaDesc(occD, occT.toLowerCase(), locName);

  return {
    title,
    description,
    alternates: localeAlternates(`/locations/${slug}/${occasion}`, locale),
    openGraph: {
      title,
      description,
      url: `https://photoportugal.com/locations/${slug}/${occasion}`,
      images: [{ url: location.cover_image || "/og-image.png", width: 1200, height: 630, alt: `${occT} in ${locName}, Portugal` }],
    },
  };
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; occasion: string }>;
}) {
  const { locale, slug, occasion } = await params;
  setRequestLocale(locale);

  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) notFound();

  const t = await getTranslations("locations.detail");
  const tc = await getTranslations("common");
  const tL = pickL(locale);

  // Resolve canonical-EN shoot type labels for SQL filtering. The DB stores
  // values like "Couples", "Family", "Solo Portrait" (Title Case strings,
  // not slugs) inside text[] columns. Some shoot types have MULTIPLE
  // valid labels (slug "solo" → ["Solo Travel", "Solo Portrait"]) since
  // photographers labelled their work either way over time. We use the
  // full alias array everywhere so all of those rows surface, not just
  // ones matching the first alias.
  const shootTypeData = shootTypes.find((st) => st.slug === occasion);
  const shootTypeLabels: string[] | null = shootTypeData
    ? (shootTypeData.photographerShootTypeNames || [shootTypeData.name])
    : null;

  const localizedName = locField(location, "name", locale) || location.name;
  const longDescription = locField(location, "long_description", locale) || location.long_description;
  const occT = occTitle(occ, locale);
  const occD = occDesc(occ, locale);
  const introCopy = getComboIntro(slug, occasion, locale) || occD;

  // Photo spots reranked so anything tagged with this occasion bubbles up.
  const spots = sortSpotsByOccasion(photoSpots[slug] || [], occasion);

  // Aggregate stats — same shape as the polished location page, but the
  // photographer set is filtered to people who DO this occasion. If the
  // resulting count is 0 (no photographers yet offer this combo) we still
  // render the page so the editorial / FAQ / spots SEO content is live.
  let photographerCount = 0;
  let avgRating = 0;
  let totalReviews = 0;
  let minPrice: number | null = null;
  let minDuration: number | null = null;
  let maxDuration: number | null = null;
  try {
    const row = await queryOne<{
      count: string;
      avg_rating: string | null;
      total_reviews: string;
      min_price: string | null;
      min_duration: string | null;
      max_duration: string | null;
    }>(
      `SELECT COUNT(DISTINCT pp.id) as count,
              AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews,
              (SELECT MIN(pk.price) FROM packages pk
               JOIN photographer_locations pl2 ON pl2.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
               WHERE pl2.location_slug = $1 AND pp2.is_approved = TRUE AND pk.is_public = TRUE
                 AND ($2::text[] IS NULL OR pp2.shoot_types && $2::text[])) as min_price,
              (SELECT MIN(pk.duration_minutes) FROM packages pk
               JOIN photographer_locations pl3 ON pl3.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp3 ON pp3.id = pk.photographer_id
               WHERE pl3.location_slug = $1 AND pp3.is_approved = TRUE AND pk.is_public = TRUE
                 AND pk.duration_minutes IS NOT NULL
                 AND ($2::text[] IS NULL OR pp3.shoot_types && $2::text[])) as min_duration,
              (SELECT MAX(pk.duration_minutes) FROM packages pk
               JOIN photographer_locations pl4 ON pl4.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp4 ON pp4.id = pk.photographer_id
               WHERE pl4.location_slug = $1 AND pp4.is_approved = TRUE AND pk.is_public = TRUE
                 AND pk.duration_minutes IS NOT NULL
                 AND ($2::text[] IS NULL OR pp4.shoot_types && $2::text[])) as max_duration
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE
         AND ($2::text[] IS NULL OR pp.shoot_types && $2::text[])`,
      [slug, shootTypeLabels]
    );
    photographerCount = parseInt(row?.count || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
    minPrice = row?.min_price ? parseFloat(row.min_price) : null;
    minDuration = row?.min_duration ? parseInt(row.min_duration) : null;
    maxDuration = row?.max_duration ? parseInt(row.max_duration) : null;
  } catch {}

  const fmt = (min: number) => formatDuration(min, locale);
  const durationText = minDuration && maxDuration
    ? (minDuration === maxDuration ? fmt(minDuration) : `${fmt(minDuration)} – ${fmt(maxDuration)}`)
    : null;

  // Hero photographer — weighted-random pick filtered to this location AND
  // who offers this occasion. Falls back to anyone at the location if the
  // narrower filter returns no rows so the hero never goes empty.
  let heroPhotographer: HeroFeaturedPhotographer | null = null;
  try {
    const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
    const useLoc = TR_LOCALES.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
    const heroRows = await query<{
      slug: string; name: string; tagline: string | null;
      cover_url: string | null; avatar_url: string | null;
      rating: string; review_count: number; session_count: number;
      portfolio_urls: string[] | null;
    }>(
      `SELECT pp.slug, u.name, ${taglineSql} as tagline, pp.cover_url, u.avatar_url,
              COALESCE(pp.rating, 0)::text as rating,
              COALESCE(pp.review_count, 0) as review_count,
              COALESCE(pp.session_count, 0) as session_count,
              -- Photos for the hero carousel: only this occasion (or
              -- untagged so legacy uploads still surface) — wrong-tagged
              -- shots like family-tagged photos on a couples page were
              -- the reason the user saw kids on /couples pages.
              -- HERO carousel: include ALL of this photographer's photos
              -- so the rotation always has 12 frames. Combos like
              -- /cascais/family had hero stuck on 1 photo because filtered
              -- pool was thin. Sort puts matching shoot_type first,
              -- untagged second, other types third — viewer still sees
              -- relevant work first, but the carousel never goes empty.
              ARRAY(
                SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
                ORDER BY
                  CASE
                    WHEN pi.shoot_type = ANY($2::text[]) THEN 0
                    WHEN pi.shoot_type IS NULL THEN 1
                    ELSE 2
                  END,
                  pi.sort_order NULLS LAST, pi.created_at
                LIMIT 12
              ) as portfolio_urls
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pl.location_slug = $1
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND ($2::text[] IS NULL OR pp.shoot_types && $2::text[])
         AND EXISTS (
           SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
         )
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 1`,
      [slug, shootTypeLabels]
    );
    if (heroRows.length > 0) {
      const r = heroRows[0];
      heroPhotographer = {
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        cover_url: r.cover_url,
        avatar_url: r.avatar_url,
        rating: Number(r.rating),
        review_count: r.review_count,
        session_count: r.session_count,
        location_name: localizedName,
        location_slug: slug,
        portfolio_urls: (r.portfolio_urls || []).filter(Boolean),
      };
    }
  } catch {}

  // Portfolio pool for the mosaic + masonry — strict occasion filter so
  // /couples pages don't surface family or solo shots (photographers tag
  // each photo at upload, so wrong-tagged means wrong page). Untagged
  // legacy photos backfill if the strict pool is thin. Sorting puts
  // tagged matches first.
  type LocationPortfolioRow = {
    url: string; width: number | null; height: number | null;
    slug: string; name: string; avatar_url: string | null;
  };
  let locationMosaicPhotos: { url: string; slug: string; name: string; location: string | null }[] = [];
  let locationMasonryPhotos: LocationMasonryPhoto[] = [];
  try {
    const portfolioRows = await query<LocationPortfolioRow>(
      `SELECT pi.url, pi.width, pi.height, pp.slug, u.name, u.avatar_url
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       JOIN photographer_locations pl ON pl.photographer_id = pp.id
       WHERE pl.location_slug = $1
         AND pi.type = 'photo'
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND (pi.location_slug IS NULL OR pi.location_slug = $1)
         AND ($2::text[] IS NULL OR pi.shoot_type = ANY($2::text[]) OR pi.shoot_type IS NULL)
       ORDER BY
         CASE WHEN pi.shoot_type = ANY($2::text[]) THEN 0 ELSE 1 END,
         -LN(RANDOM()) / (CASE
           WHEN pp.is_featured THEN 50
           WHEN pp.is_verified THEN 30
           WHEN COALESCE(pp.is_founding, FALSE) THEN 15
           WHEN pp.early_bird_tier IS NOT NULL THEN 5
           ELSE 2
         END) ASC
       LIMIT 60`,
      [slug, shootTypeLabels]
    );
    locationMosaicPhotos = portfolioRows.slice(0, 24).map((r) => ({
      url: r.url, slug: r.slug, name: r.name, location: localizedName,
    }));
    locationMasonryPhotos = portfolioRows.slice(0, 30).map((r) => ({
      url: r.url, width: r.width, height: r.height,
      photographer: { slug: r.slug, name: r.name, avatar_url: r.avatar_url },
    }));
  } catch {}

  // Total photographer count for "browse all N" link
  let totalPhotographers = 0;
  try {
    const totalRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM photographer_profiles
       WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
    );
    totalPhotographers = totalRow?.count ?? 0;
  } catch {}

  const heroLocationContext: HeroLocationContext = {
    slug,
    name: localizedName,
    region: location.region,
    photographerCount,
    minPrice,
    durationText,
    avgRating: avgRating || null,
    totalReviews,
    occasionLabel: occT,
    occasionPreposition: IN_PREP[locale] || "in",
  };

  // Top photographers — full PhotographerCardCompact data + ALL public
  // packages (matches the polished page card). Filtered by occasion.
  type LocationPhotographerRow = {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; cover_position_y: number | null;
    portfolio_thumbs: string[] | null;
    is_featured: boolean; is_verified: boolean; is_founding: boolean;
    tagline: string | null;
    rating: number; review_count: number; starting_price: string | null;
    locations: string | null;
    last_active_at: string | null; avg_response_minutes: number | null;
    packages: { id: string; name: string; price: number; duration_minutes: number; num_photos: number }[] | null;
    packages_count: number;
  };
  let topPhotographers: LocationPhotographerRow[] = [];
  try {
    const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
    const useLoc = TR_LOCALES.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
    topPhotographers = await query<LocationPhotographerRow>(
      `SELECT pp.id, pp.slug, u.name, u.avatar_url,
              pp.cover_url, pp.cover_position_y,
              pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
              ${taglineSql} as tagline, pp.rating, pp.review_count,
              u.last_seen_at as last_active_at, pp.avg_response_minutes,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as starting_price,
              (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
              ARRAY(
                SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
                  AND ($2::text[] IS NULL OR pi.shoot_type = ANY($2::text[]) OR pi.shoot_type IS NULL)
                ORDER BY
                  CASE WHEN pi.shoot_type = ANY($2::text[]) THEN 0 ELSE 1 END,
                  pi.sort_order NULLS LAST, pi.created_at
                LIMIT 7
              ) as portfolio_thumbs,
              COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'id', pk.id,
                    'name', pk.name,
                    'price', pk.price,
                    'duration_minutes', pk.duration_minutes,
                    'num_photos', COALESCE(pk.num_photos, 0)
                  ) ORDER BY pk.sort_order NULLS LAST, pk.price ASC
                )
                FROM packages pk
                WHERE pk.photographer_id = pp.id AND pk.is_public = TRUE
              ), '[]'::json) as packages,
              (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::int as packages_count
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE
         AND ($2::text[] IS NULL OR pp.shoot_types && $2::text[])
       ORDER BY pp.is_featured DESC, pp.is_verified DESC, RANDOM()
       LIMIT 6`,
      [slug, shootTypeLabels]
    );
  } catch {}

  // Reviews — location-level (occasion filter would shrink to ~0 reviews
  // for many combos since reviews aren't tagged with shoot type).
  const locationReviews = await getReviewsForLocation(slug, 6, locale);

  const nearby = getNearbyLocations(slug);

  // FAQ — combine location FAQs with shoot-type FAQs (location ones are
  // higher value, shoot-type ones generic).
  const locationFaqsList = (locationFaqs[slug] || []).map((faq) => ({
    question: faqField(faq, "question", locale),
    answer: faqField(faq, "answer", locale),
  }));
  const shootTypeFaqsRaw = shootTypeData?.faqs || [];
  const shootTypeFaqsList = shootTypeFaqsRaw.slice(0, 3).map((f) => {
    const fl = f as unknown as Record<string, string | undefined>;
    return {
      question: fl[`question_${locale}`] || f.question,
      answer: fl[`answer_${locale}`] || f.answer,
    };
  });
  const allFaqs = [...locationFaqsList, ...shootTypeFaqsList].slice(0, 6);

  // Other occasions in this location — exclude the current one.
  const otherOccasions = Object.entries(OCCASIONS).filter(([key]) => key !== occasion);

  // ─── Schema.org JSON-LD ────────────────────────────────────────────────
  const jsonLdService = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${occT} in ${location.name}, Portugal`,
    description: occD,
    url: `https://photoportugal.com/locations/${slug}/${occasion}`,
    serviceType: occ.title,
    provider: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
    areaServed: {
      "@type": "City",
      name: location.name,
      containedInPlace: { "@type": "Country", name: "Portugal" },
    },
    ...(minPrice ? {
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: String(minPrice),
        availability: "https://schema.org/InStock",
        url: `https://photoportugal.com/photographers?location=${slug}&shoot=${occasion}`,
      },
    } : {}),
    ...(totalReviews > 0 && avgRating > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating,
        reviewCount: totalReviews,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };

  const jsonLdFaq = allFaqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tL.home, item: "https://photoportugal.com/" },
      { "@type": "ListItem", position: 2, name: tL.locations, item: "https://photoportugal.com/locations" },
      { "@type": "ListItem", position: 3, name: localizedName, item: `https://photoportugal.com/locations/${slug}` },
      { "@type": "ListItem", position: 4, name: occT, item: `https://photoportugal.com/locations/${slug}/${occasion}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdService) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}

      <Breadcrumbs
        items={[
          { name: tL.home, href: "/" },
          { name: tL.locations, href: "/locations" },
          { name: localizedName, href: `/locations/${slug}` },
          { name: occT, href: `/locations/${slug}/${occasion}` },
        ]}
      />

      <LocationStickyBookBar
        locationSlug={slug}
        locationName={localizedName}
        minPrice={minPrice}
      />

      {/* Hero — single-photographer carousel, with combo-aware h1
          ("<Occasion> in <Location>") via occasionLabel/occasionPreposition. */}
      {heroPhotographer ? (
        <HeroSingleVariant
          photographer={heroPhotographer}
          locationContext={heroLocationContext}
          totalPhotographers={totalPhotographers}
        />
      ) : (
        // Fallback: location cover + match form. Same pattern as polished page.
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <OptimizedImage
              src={locationImage(location.slug, "hero")}
              alt={`${occT} in ${location.name}, Portugal`}
              priority
              className="h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-950/85 via-primary-900/70 to-primary-800/50" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-primary-300">{location.region}</p>
              <h1 className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                <span className="text-primary-300">{occT}</span> {tL.inLocation} {localizedName}
              </h1>
              <p className="mt-6 text-lg text-primary-100/90">{introCopy}</p>
              <div className="mt-6 max-w-xl">
                <MatchQuickForm
                  presetLocation={location.slug}
                  source={`combo_${location.slug}_${occasion}`}
                  variant="dark"
                  size="md"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Editorial intro — combo-specific copy from the curated map, or
          fallback to the generic occasion description. Lives RIGHT under
          the hero so the page reads as "this is for X in Y" instantly. */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
            {tL.introHeading(occT, localizedName)}
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed text-base sm:text-lg">{introCopy}</p>
          {photographerCount > 0 && (
            <p className="mt-3 text-sm text-gray-500">
              {tL.photographersAvailable(photographerCount, localizedName)}
            </p>
          )}
        </div>
      </section>

      {/* About location — sticky text + portfolio mosaic (same pattern as
          polished page). The shoot-type pill row here points to other
          occasion combos so users can explore neighbouring intent. */}
      <section className="relative bg-warm-50">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
            <div className="max-w-xl lg:sticky lg:top-24">
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                {tL.aboutLocation(localizedName)}
              </h2>
              {longDescription && (
                <div className="mt-6 text-gray-600 leading-relaxed space-y-4">
                  <p>{longDescription}</p>
                </div>
              )}

              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  {tL.otherOccasions(localizedName)}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {otherOccasions.slice(0, 6).map(([key, o]) => (
                    <Link
                      key={key}
                      href={`/locations/${slug}/${key}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                    >
                      <span>{o.emoji}</span>
                      {occTitle(o, locale)}
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href={`/photographers?location=${slug}&shoot=${occasion}`}
                className="mt-8 inline-flex rounded-xl bg-primary-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
              >
                {tc("findPhotographers")}
              </Link>
            </div>

            <div className="hidden lg:block lg:h-[140vh]">
              {locationMosaicPhotos.length > 0 && (
                <PortfolioMosaic photos={locationMosaicPhotos.slice(0, 24)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Real photos masonry */}
      {locationMasonryPhotos.length > 0 && (
        <LocationPhotosMasonry photos={locationMasonryPhotos} />
      )}

      {/* Photographer grid — filtered by occasion. Only renders if we have
          matches, otherwise we keep the page free of an empty state and
          users still get the rest of the SEO content + photo spots. */}
      {topPhotographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {occT} {tL.inLocation} {localizedName}
            </h2>
            <p className="mt-2 text-gray-500">
              {tL.photographersAvailable(photographerCount, localizedName)}
            </p>
            <div className="mt-6">
              <ScarcityBanner count={photographerCount} locationName={localizedName} locale={locale} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {topPhotographers.map((sp) => (
                <PhotographerCardCompact
                  key={sp.id}
                  p={{
                    slug: sp.slug,
                    name: sp.name,
                    tagline: sp.tagline,
                    avatar_url: sp.avatar_url,
                    cover_url: sp.cover_url,
                    cover_position_y: sp.cover_position_y,
                    portfolio_thumbs: sp.portfolio_thumbs,
                    is_featured: sp.is_featured,
                    is_verified: sp.is_verified,
                    is_founding: sp.is_founding,
                    rating: Number(sp.rating),
                    review_count: sp.review_count,
                    min_price: sp.starting_price ? Number(sp.starting_price) : null,
                    locations: sp.locations,
                    last_active_at: sp.last_active_at,
                    avg_response_minutes: sp.avg_response_minutes,
                    packages: sp.packages ?? [],
                    packages_total_count: sp.packages_count,
                  }}
                />
              ))}
            </div>
            {photographerCount > topPhotographers.length && (
              <div className="mt-8 text-center">
                <Link
                  href={`/photographers?location=${slug}&shoot=${occasion}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 hover:shadow-md"
                >
                  {tL.seePhotographersLink} {localizedName}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Reviews */}
      {locationReviews.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <ReviewsStrip
              reviews={locationReviews}
              title={t("whatTravelersSay", { location: localizedName })}
              subtitle={t("realReviewsSubtitle")}
              compact
            />
          </div>
        </section>
      )}

      {/* How It Works */}
      <HowItWorksSection />

      {/* Top photo spots — reranked by occasion. Spots tagged for this
          shoot type bubble to the top; untagged spots still render. */}
      {spots.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("topPhotoSpots", { location: localizedName })}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("mostPhotogenic", { location: localizedName })}
            </p>
            <div className={`mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              spots.length <= 2 ? "lg:grid-cols-2" :
              spots.length === 4 ? "lg:grid-cols-2" :
              "lg:grid-cols-3"
            }`}>
              {spots.map((spot) => {
                const sl = spotLocalized(spot, locale);
                return (
                  <Link
                    key={spot.name}
                    href={`/spots/${slug}/${spotSlug(spot.name)}`}
                    className="group rounded-xl border border-warm-200 bg-warm-50 p-5 transition hover:border-primary-300 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">{sl.name}</h3>
                        <p className="mt-1 text-sm text-gray-500 leading-relaxed">{sl.description}</p>
                        {sl.best_time && (
                          <p className="mt-2 text-xs text-gray-400">{t("bestTime", { time: sl.best_time })}</p>
                        )}
                        {sl.tips && (
                          <p className="mt-1 text-xs text-primary-600">{sl.tips}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FAQ — location FAQ + shoot-type FAQ combined */}
      {allFaqs.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {tL.faqTitle}
            </h2>
            <div className="mt-8 space-y-4">
              {allFaqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-warm-200 bg-warm-50"
                >
                  <summary className="flex items-center justify-between px-6 py-5 font-semibold text-gray-900 cursor-pointer">
                    {faq.question}
                    <svg
                      className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-5">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Same occasion in nearby locations */}
      {nearby.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900">
              {tL.nearbyTitle(occT)}
            </h2>
            <p className="mt-2 text-gray-500">
              {tL.nearbySub(localizedName)}
            </p>
            <div className={`mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 ${
              nearby.length <= 2 ? "lg:grid-cols-2" :
              nearby.length === 4 ? "lg:grid-cols-2" :
              "lg:grid-cols-3"
            }`}>
              {nearby.slice(0, 6).map((nb) => {
                const nbR = nb as unknown as Record<string, string | undefined>;
                const nbName = nbR[`name_${locale}`] || nb.name;
                const nbDesc = nbR[`description_${locale}`] || nb.description;
                return (
                  <Link
                    key={nb.slug}
                    href={`/locations/${nb.slug}/${occasion}`}
                    className="group rounded-xl border border-warm-200 bg-white p-5 transition hover:border-primary-200 hover:shadow-md"
                  >
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                      {occT} {tL.inLocation} {nbName}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">{nbDesc}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                      {tL.viewPhotographers} →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <OptimizedImage
            src={locationImage(location.slug, "card")}
            alt={`${occT} in ${location.name}`}
            width={600}
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {tL.ctaTitle(occT.toLowerCase(), localizedName)}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            {tL.ctaSub}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/photographers?location=${location.slug}&shoot=${occasion}`}
              className="rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              {tL.ctaBtn}
            </Link>
            <Link
              href={`/locations/${location.slug}`}
              className="rounded-xl border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:bg-warm-50"
            >
              {tL.aboutLocation(localizedName)}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
