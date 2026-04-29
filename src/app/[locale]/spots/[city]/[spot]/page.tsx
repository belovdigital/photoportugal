import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { photoSpots, spotSlug, getSpot, spotLocalized } from "@/lib/photo-spots-data";
import { getLocationBySlug, locations } from "@/lib/locations-data";
import { query } from "@/lib/db";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { adaptToPhotographerProfile } from "@/lib/photographer-adapter";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForLocation } from "@/lib/reviews-data";
import { localeAlternates } from "@/lib/seo";

const L = {
  en: {
    portugal: "Portugal",
    photographerAt: "Photographer at",
    about: "About",
    bestTime: "Best time to shoot:",
    tips: "Tips:",
    shootersAt: "Photographers who shoot at",
    handpickedIn: "Hand-picked professionals working in",
    viewAllIn: "View all photographers in",
    readyToBook: "Ready to book?",
    conciergeDesc: "Our concierge team will hand-pick 2-3 photographers who know",
    freeOfCharge: "— free of charge.",
    getMatched: "Get matched free",
    browsePhotographers: "Browse photographers",
    otherSpots: "Other spots in",
    exploreMore: "Explore more",
    travelGuide: "travel guide",
    allLocations: "All {count} Portugal locations",
    browseByType: "Browse by photoshoot type",
    reviewsTitle: "Real reviews from",
    reviewsTitleSuffix: "photoshoots",
    realClient: "verified bookings",
    newLabel: "New",
    titleSuffix: "Book a Photoshoot",
    hireDesc: "Hire a professional photographer at",
  },
  pt: {
    portugal: "Portugal",
    photographerAt: "Fotógrafo em",
    about: "Sobre",
    bestTime: "Melhor altura para fotografar:",
    tips: "Dicas:",
    shootersAt: "Fotógrafos que trabalham em",
    handpickedIn: "Profissionais selecionados a trabalhar em",
    viewAllIn: "Ver todos os fotógrafos em",
    readyToBook: "Pronto para reservar?",
    conciergeDesc: "A nossa equipa de concierge irá selecionar 2-3 fotógrafos que conhecem",
    freeOfCharge: "— gratuitamente.",
    getMatched: "Ser emparelhado gratuitamente",
    browsePhotographers: "Ver fotógrafos",
    otherSpots: "Outros locais em",
    exploreMore: "Explorar mais",
    travelGuide: "guia de viagem",
    allLocations: "Todas as {count} localizações em Portugal",
    browseByType: "Explorar por tipo de sessão",
    reviewsTitle: "Avaliações reais de sessões em",
    reviewsTitleSuffix: "",
    realClient: "reservas verificadas",
    newLabel: "Novo",
    titleSuffix: "Reserve uma Sessão",
    hireDesc: "Contrate um fotógrafo profissional em",
  },
  de: {
    portugal: "Portugal",
    photographerAt: "Fotograf bei",
    about: "Über",
    bestTime: "Beste Zeit zum Fotografieren:",
    tips: "Tipps:",
    shootersAt: "Fotografen, die hier arbeiten:",
    handpickedIn: "Handverlesene Profis, die in",
    viewAllIn: "Alle Fotografen ansehen in",
    readyToBook: "Bereit zur Buchung?",
    conciergeDesc: "Unser Concierge-Team wählt 2-3 Fotografen für Sie aus, die",
    freeOfCharge: "— kostenfrei.",
    getMatched: "Kostenlos vermitteln lassen",
    browsePhotographers: "Fotografen ansehen",
    otherSpots: "Weitere Orte in",
    exploreMore: "Mehr entdecken",
    travelGuide: "Reiseführer",
    allLocations: "Alle {count} Orte in Portugal",
    browseByType: "Nach Fotoshooting-Art stöbern",
    reviewsTitle: "Echte Bewertungen von Fotoshootings in",
    reviewsTitleSuffix: "",
    realClient: "verifizierte Buchungen",
    newLabel: "Neu",
    titleSuffix: "Fotoshooting buchen",
    hireDesc: "Buchen Sie einen professionellen Fotografen bei",
  },
  es: {
    portugal: "Portugal",
    photographerAt: "Fotógrafo en",
    about: "Sobre",
    bestTime: "Mejor momento para fotografiar:",
    tips: "Consejos:",
    shootersAt: "Fotógrafos que trabajan en",
    handpickedIn: "Profesionales seleccionados a mano que trabajan en",
    viewAllIn: "Ver todos los fotógrafos en",
    readyToBook: "¿Listo para reservar?",
    conciergeDesc: "Nuestro equipo de concierge seleccionará 2-3 fotógrafos que conozcan",
    freeOfCharge: "— gratis.",
    getMatched: "Recibir recomendaciones gratis",
    browsePhotographers: "Ver fotógrafos",
    otherSpots: "Otros lugares en",
    exploreMore: "Explorar más",
    travelGuide: "guía de viaje",
    allLocations: "Las {count} localizaciones de Portugal",
    browseByType: "Explorar por tipo de sesión",
    reviewsTitle: "Reseñas reales de sesiones en",
    reviewsTitleSuffix: "",
    realClient: "reservas verificadas",
    newLabel: "Nuevo",
    titleSuffix: "Reservar una sesión",
    hireDesc: "Contrate un fotógrafo profesional en",
  },
  fr: {
    portugal: "Portugal",
    photographerAt: "Photographe à",
    about: "À propos",
    bestTime: "Meilleur moment pour photographier :",
    tips: "Conseils :",
    shootersAt: "Photographes qui travaillent à",
    handpickedIn: "Professionnels triés sur le volet qui travaillent à",
    viewAllIn: "Voir tous les photographes à",
    readyToBook: "Prêt à réserver ?",
    conciergeDesc: "Notre équipe concierge choisira 2-3 photographes qui connaissent",
    freeOfCharge: "— gratuitement.",
    getMatched: "Recevoir des suggestions gratuites",
    browsePhotographers: "Voir les photographes",
    otherSpots: "Autres lieux à",
    exploreMore: "Explorer plus",
    travelGuide: "guide de voyage",
    allLocations: "Les {count} lieux du Portugal",
    browseByType: "Parcourir par type de séance",
    reviewsTitle: "Avis authentiques de séances à",
    reviewsTitleSuffix: "",
    realClient: "réservations vérifiées",
    newLabel: "Nouveau",
    titleSuffix: "Réserver une séance",
    hireDesc: "Réservez un photographe professionnel à",
  },
};

function pickL(locale: string): typeof L.en {
  return (L as unknown as Record<string, typeof L.en>)[locale] || L.en;
}

export const revalidate = 86400;

export function generateStaticParams() {
  return Object.entries(photoSpots).flatMap(([city, spots]) =>
    spots.map((s) => ({ city, spot: spotSlug(s.name) }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; city: string; spot: string }>;
}): Promise<Metadata> {
  const { locale, city, spot } = await params;
  const location = getLocationBySlug(city);
  const spotData = getSpot(city, spot);
  if (!location || !spotData) return {};

  const s = spotLocalized(spotData, locale);
  const t = pickL(locale);
  const title = `${t.photographerAt} ${s.name}, ${location.name} — ${t.titleSuffix}`;
  const description = `${t.hireDesc} ${s.name}, ${location.name}, Portugal. ${s.description.slice(0, 140)}`;
  const alt = localeAlternates(`/spots/${city}/${spot}`, locale);

  return {
    title,
    description,
    alternates: alt,
    openGraph: {
      title,
      description,
      url: alt.canonical,
      type: "article",
    },
  };
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ locale: string; city: string; spot: string }>;
}) {
  const { locale, city, spot } = await params;
  setRequestLocale(locale);

  const location = getLocationBySlug(city);
  const spotData = getSpot(city, spot);
  if (!location || !spotData) notFound();
  const s = spotLocalized(spotData, locale);
  const t = pickL(locale);

  // Photographers working in this city — fetch the full set of fields the
  // unified PhotographerCardCompact card needs (cover, badges, response time,
  // locations) so this page matches the gold-standard rich card.
  const TR = new Set(["pt", "de", "es", "fr"]);
  const useLoc = locale && TR.has(locale) ? locale : null;
  const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
  const photographers = await query<{
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; cover_position_y: number | null;
    portfolio_thumbs: string[] | null;
    is_featured: boolean; is_verified: boolean; is_founding: boolean;
    tagline: string | null; rating: number; review_count: number;
    min_price: string | null;
    locations: string | null;
    last_active_at: string | null;
    avg_response_minutes: number | null;
  }>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url, pp.cover_position_y,
            pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
            ${taglineSql} as tagline, pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as min_price,
            u.last_seen_at as last_active_at, pp.avg_response_minutes,
            (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
             FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
            ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 7) as portfolio_thumbs
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     JOIN photographer_locations pl ON pl.photographer_id = pp.id
     WHERE pp.is_approved = TRUE AND pl.location_slug = $1
     ORDER BY pp.is_featured DESC, pp.is_verified DESC, pp.rating DESC NULLS LAST, pp.review_count DESC NULLS LAST
     LIMIT 6`,
    [city]
  ).catch(() => []);

  const reviews = await getReviewsForLocation(city, 3, locale);

  // Related spots in the same city
  const siblings = (photoSpots[city] || []).filter((s) => spotSlug(s.name) !== spot);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: s.name,
    description: s.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: location.name,
      addressCountry: "PT",
    },
    image: photographers[0]?.cover_url
      ? (photographers[0].cover_url.startsWith("http") ? photographers[0].cover_url : `https://photoportugal.com${photographers[0].cover_url}`)
      : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Breadcrumbs
          items={[
            { name: t.portugal, href: "/" },
            { name: location.name, href: `/locations/${city}` },
            { name: s.name, href: `/spots/${city}/${spot}` },
          ]}
        />

        <h1 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {t.photographerAt} {s.name}
        </h1>
        <p className="mt-1 text-base text-gray-500">
          {location.name}, {t.portugal}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-warm-200 bg-white p-6">
              <h2 className="text-xl font-bold text-gray-900">{t.about} {s.name}</h2>
              <p className="mt-3 text-gray-700 leading-relaxed">{s.description}</p>
              {s.best_time && (
                <p className="mt-4 text-sm text-gray-500">
                  <strong className="text-gray-700">{t.bestTime}</strong> {s.best_time}
                </p>
              )}
              {s.tips && (
                <p className="mt-2 text-sm text-gray-500">
                  <strong className="text-gray-700">{t.tips}</strong> {s.tips}
                </p>
              )}
            </div>

            {photographers.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-gray-900">
                  {t.shootersAt} {s.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {t.handpickedIn} {location.name}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {photographers.map((p) => (
                    <PhotographerCard
                      key={p.id}
                      photographer={adaptToPhotographerProfile({
                        id: p.id,
                        slug: p.slug,
                        name: p.name,
                        tagline: p.tagline,
                        avatar_url: p.avatar_url,
                        cover_url: p.cover_url,
                        cover_position_y: p.cover_position_y,
                        portfolio_thumbs: p.portfolio_thumbs,
                        is_featured: p.is_featured,
                        is_verified: p.is_verified,
                        is_founding: p.is_founding,
                        rating: p.rating,
                        review_count: p.review_count,
                        min_price: p.min_price,
                        locations: p.locations,
                        last_active_at: p.last_active_at,
                        avg_response_minutes: p.avg_response_minutes,
                      })}
                    />
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <Link
                    href={`/photographers?location=${city}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary-200 px-5 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
                  >
                    {t.viewAllIn} {location.name}
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </section>
            )}

            {reviews.length > 0 && (
              <section className="mt-10">
                <ReviewsStrip
                  reviews={reviews}
                  title={`${t.reviewsTitle} ${location.name}${t.reviewsTitleSuffix ? ` ${t.reviewsTitleSuffix}` : ""}`}
                  compact
                />
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <h3 className="text-sm font-bold text-gray-900">{t.readyToBook}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {t.conciergeDesc} {s.name} {t.freeOfCharge}
              </p>
              <Link
                href="/find-photographer"
                className="mt-4 block rounded-xl bg-primary-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                {t.getMatched}
              </Link>
              <Link
                href={`/photographers?location=${city}`}
                className="mt-2 block rounded-xl border border-warm-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:border-primary-300 hover:text-primary-700"
              >
                {t.browsePhotographers}
              </Link>
            </div>

            {siblings.length > 0 && (
              <div className="rounded-2xl border border-warm-200 bg-white p-5">
                <h3 className="text-sm font-bold text-gray-900">{t.otherSpots} {location.name}</h3>
                <ul className="mt-3 space-y-1.5">
                  {siblings.map((sib) => {
                    const sibL = spotLocalized(sib, locale);
                    return (
                      <li key={sib.name}>
                        <Link
                          href={`/spots/${city}/${spotSlug(sib.name)}`}
                          className="block rounded-lg px-3 py-1.5 text-sm text-gray-700 transition hover:bg-warm-50 hover:text-primary-700"
                        >
                          {sibL.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-warm-200 bg-warm-50 p-5">
              <h3 className="text-sm font-bold text-gray-900">{t.exploreMore}</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li><Link href={`/locations/${city}`} className="text-primary-600 hover:underline">{location.name} {t.travelGuide}</Link></li>
                <li><Link href="/locations" className="text-primary-600 hover:underline">{t.allLocations.replace("{count}", String(locations.length))}</Link></li>
                <li><Link href="/photoshoots" className="text-primary-600 hover:underline">{t.browseByType}</Link></li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
