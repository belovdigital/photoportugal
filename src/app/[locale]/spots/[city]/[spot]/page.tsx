import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { photoSpots, spotSlug, getSpot, spotLocalized, getSpotsWithMediaForCity, type SpotImage } from "@/lib/photo-spots-data";
import { getLocationBySlug, locField } from "@/lib/locations-data";
import { query } from "@/lib/db";
import { PhotographerCardCompact } from "@/components/ui/PhotographerCardCompact";
import { TrackedConciergeTrigger } from "@/components/ui/TrackedConciergeTrigger";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForLocation } from "@/lib/reviews-data";
import { localeAlternates } from "@/lib/seo";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ConciergeInvitePlaque } from "@/components/concierge/ConciergeInvitePlaque";
import { LocationPhotosMasonry, type LocationMasonryPhoto } from "@/components/ui/LocationPhotosMasonry";
import { SpotHeroCarousel } from "@/components/ui/SpotHeroCarousel";
import { SpotMap } from "@/components/ui/SpotMap";

const L = {
  en: {
    portugal: "Portugal",
    photographerAt: "Photographer at",
    photoshootAt: "Photoshoot at",
    spotInCity: "Photo spot in",
    aboutTitle: "About",
    bestTime: "Best time to shoot",
    tips: "Tips",
    getDirections: "Get directions",
    photographersHere: "Photographers who shoot at",
    handpickedIn: "Hand-picked professionals working in",
    viewAllIn: "View all photographers in",
    reviewsTitle: "Real reviews from",
    reviewsTitleSuffix: "photoshoots",
    realPhotosTitle: "Recent work in",
    realPhotosSub: "Portfolio shots by photographers covering this area",
    photoBy: "Photo by",
    via: "via",
    galleryTitle: "Inside",
    readyTitle: "Ready to book?",
    conciergeDesc: "Our concierge team will hand-pick 2-3 photographers who know",
    freeOfCharge: "— free of charge.",
    getMatched: "Get matched free",
    browsePhotographers: "Browse photographers",
    otherSpotsTitle: "Other spots in",
    moreFrom: "More from",
    travelGuide: "travel guide",
    titleSuffix: "Book a Photoshoot",
    hireDesc: "Hire a professional photographer at",
    placeholder: "What kind of photoshoot at",
    photographersChips: ["Couples photoshoot", "Family", "Solo portrait", "Engagement", "Honeymoon"],
  },
  pt: {
    portugal: "Portugal",
    photographerAt: "Fotógrafo em",
    photoshootAt: "Sessão fotográfica em",
    spotInCity: "Local de fotografia em",
    aboutTitle: "Sobre",
    bestTime: "Melhor altura para fotografar",
    tips: "Dicas",
    getDirections: "Obter direções",
    photographersHere: "Fotógrafos que trabalham em",
    handpickedIn: "Profissionais selecionados a trabalhar em",
    viewAllIn: "Ver todos os fotógrafos em",
    reviewsTitle: "Avaliações reais de sessões em",
    reviewsTitleSuffix: "",
    realPhotosTitle: "Trabalho recente em",
    realPhotosSub: "Portfólio de fotógrafos que cobrem esta zona",
    photoBy: "Foto de",
    via: "via",
    galleryTitle: "Dentro de",
    readyTitle: "Pronto para reservar?",
    conciergeDesc: "A nossa equipa de concierge irá selecionar 2-3 fotógrafos que conhecem",
    freeOfCharge: "— gratuitamente.",
    getMatched: "Ser emparelhado gratuitamente",
    browsePhotographers: "Ver fotógrafos",
    otherSpotsTitle: "Outros locais em",
    moreFrom: "Mais de",
    travelGuide: "guia de viagem",
    titleSuffix: "Reserve uma Sessão",
    hireDesc: "Contrate um fotógrafo profissional em",
    placeholder: "Que tipo de sessão em",
    photographersChips: ["Sessão de casal", "Família", "Retrato solo", "Noivado", "Lua de mel"],
  },
  de: {
    portugal: "Portugal",
    photographerAt: "Fotograf bei",
    photoshootAt: "Fotoshooting bei",
    spotInCity: "Foto-Spot in",
    aboutTitle: "Über",
    bestTime: "Beste Zeit zum Fotografieren",
    tips: "Tipps",
    getDirections: "Route anzeigen",
    photographersHere: "Fotografen, die hier arbeiten:",
    handpickedIn: "Handverlesene Profis, die in",
    viewAllIn: "Alle Fotografen ansehen in",
    reviewsTitle: "Echte Bewertungen von Fotoshootings in",
    reviewsTitleSuffix: "",
    realPhotosTitle: "Aktuelle Arbeiten in",
    realPhotosSub: "Portfolio-Aufnahmen von Fotografen, die diese Gegend abdecken",
    photoBy: "Foto von",
    via: "via",
    galleryTitle: "Inside",
    readyTitle: "Bereit zur Buchung?",
    conciergeDesc: "Unser Concierge-Team wählt 2-3 Fotografen für Sie aus, die",
    freeOfCharge: "— kostenfrei.",
    getMatched: "Kostenlos vermitteln lassen",
    browsePhotographers: "Fotografen ansehen",
    otherSpotsTitle: "Weitere Orte in",
    moreFrom: "Mehr aus",
    travelGuide: "Reiseführer",
    titleSuffix: "Fotoshooting buchen",
    hireDesc: "Buchen Sie einen professionellen Fotografen bei",
    placeholder: "Welches Shooting bei",
    photographersChips: ["Paar-Shooting", "Familie", "Solo-Porträt", "Verlobung", "Flitterwochen"],
  },
  es: {
    portugal: "Portugal",
    photographerAt: "Fotógrafo en",
    photoshootAt: "Sesión fotográfica en",
    spotInCity: "Lugar fotográfico en",
    aboutTitle: "Sobre",
    bestTime: "Mejor momento para fotografiar",
    tips: "Consejos",
    getDirections: "Cómo llegar",
    photographersHere: "Fotógrafos que trabajan en",
    handpickedIn: "Profesionales seleccionados a mano que trabajan en",
    viewAllIn: "Ver todos los fotógrafos en",
    reviewsTitle: "Reseñas reales de sesiones en",
    reviewsTitleSuffix: "",
    realPhotosTitle: "Trabajo reciente en",
    realPhotosSub: "Portfolios de fotógrafos que cubren esta zona",
    photoBy: "Foto de",
    via: "vía",
    galleryTitle: "Dentro de",
    readyTitle: "¿Listo para reservar?",
    conciergeDesc: "Nuestro equipo de concierge seleccionará 2-3 fotógrafos que conozcan",
    freeOfCharge: "— gratis.",
    getMatched: "Recibir recomendaciones gratis",
    browsePhotographers: "Ver fotógrafos",
    otherSpotsTitle: "Otros lugares en",
    moreFrom: "Más de",
    travelGuide: "guía de viaje",
    titleSuffix: "Reservar una sesión",
    hireDesc: "Contrate un fotógrafo profesional en",
    placeholder: "Qué tipo de sesión en",
    photographersChips: ["Sesión de pareja", "Familia", "Retrato solo", "Compromiso", "Luna de miel"],
  },
  fr: {
    portugal: "Portugal",
    photographerAt: "Photographe à",
    photoshootAt: "Séance photo à",
    spotInCity: "Lieu photo à",
    aboutTitle: "À propos",
    bestTime: "Meilleur moment pour photographier",
    tips: "Conseils",
    getDirections: "Itinéraire",
    photographersHere: "Photographes qui travaillent à",
    handpickedIn: "Professionnels triés sur le volet qui travaillent à",
    viewAllIn: "Voir tous les photographes à",
    reviewsTitle: "Avis authentiques de séances à",
    reviewsTitleSuffix: "",
    realPhotosTitle: "Travaux récents à",
    realPhotosSub: "Portfolios de photographes qui couvrent ce secteur",
    photoBy: "Photo par",
    via: "via",
    galleryTitle: "À l'intérieur de",
    readyTitle: "Prêt à réserver ?",
    conciergeDesc: "Notre équipe concierge choisira 2-3 photographes qui connaissent",
    freeOfCharge: "— gratuitement.",
    getMatched: "Recevoir des suggestions gratuites",
    browsePhotographers: "Voir les photographes",
    otherSpotsTitle: "Autres lieux à",
    moreFrom: "Plus de",
    travelGuide: "guide de voyage",
    titleSuffix: "Réserver une séance",
    hireDesc: "Réservez un photographe professionnel à",
    placeholder: "Quel type de séance à",
    photographersChips: ["Séance couple", "Famille", "Portrait solo", "Fiançailles", "Lune de miel"],
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
  const title = `${t.photoshootAt} ${s.name}, ${location.name} — ${t.titleSuffix}`;
  const description = `${t.hireDesc} ${s.name}, ${location.name}, Portugal. ${s.description.slice(0, 140)}`;
  const alt = localeAlternates(`/spots/${city}/${spot}`, locale);
  const ogImage = spotData.images?.[0]?.url || location.cover_image || "/og-image.png";

  return {
    title,
    description,
    alternates: alt,
    openGraph: {
      title,
      description,
      url: alt.canonical,
      type: "article",
      images: [{ url: ogImage, alt: `${s.name}, ${location.name}` }],
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

  const localizedCity = locField(location, "name", locale) || location.name;

  // Hero — every curated photo of the spot lives in the hero carousel.
  // Spots without curated images fall back to a single static cover (the
  // city image), in which case the carousel renders as a non-rotating
  // single slide and no pagination controls show up.
  const carouselImages = (spotData.images || []).map((img) => ({
    url: img.url,
    alt: img.alt || `${s.name}, ${location.name}, Portugal`,
    attribution: img.attribution,
    source: img.source,
    source_url: img.source_url,
  }));
  // No curated images? Fall back to a single placeholder slide using the
  // city cover so the hero never renders empty.
  if (carouselImages.length === 0 && location.cover_image) {
    carouselImages.push({
      url: location.cover_image,
      alt: `${location.name}, Portugal`,
      attribution: "",
      source: "photographer" as const,
      source_url: undefined,
    });
  }
  const firstCuratedImage: SpotImage | undefined = spotData.images?.[0];

  // Photographers in the city — same query as the old template, picks the
  // 6 highest-signal photographers covering this location for the bottom
  // grid section.
  const TR = new Set(["pt", "de", "es", "fr"]);
  const useLoc = locale && TR.has(locale) ? locale : null;
  const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
  type PhotographerRow = {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; cover_position_y: number | null;
    portfolio_thumbs: string[] | null;
    is_featured: boolean; is_verified: boolean; is_founding: boolean;
    tagline: string | null; rating: number | null; review_count: number;
    min_price: string | null;
    locations: string | null;
    last_active_at: string | null;
    avg_response_minutes: number | null;
    languages: string[] | null;
  };
  const photographers = await query<PhotographerRow>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url, pp.cover_position_y,
            pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
            ${taglineSql} as tagline, pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as min_price,
            u.last_seen_at as last_active_at, pp.avg_response_minutes,
            COALESCE(pp.languages, '{}') as languages,
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

  // Real portfolio photos from photographers in this city — same query as
  // /locations/[slug] uses for its photos masonry. Brings the city alive
  // visually even when the spot itself has no curated images yet.
  let portfolioMasonry: LocationMasonryPhoto[] = [];
  try {
    const portfolioRows = await query<{
      url: string; width: number | null; height: number | null;
      slug: string; name: string; avatar_url: string | null;
    }>(
      `SELECT pi.url, pi.width, pi.height,
              pp.slug, u.name, u.avatar_url
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
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         ELSE 5
       END) ASC
       LIMIT 24`,
      [city]
    );
    portfolioMasonry = portfolioRows.map((r) => ({
      url: r.url,
      width: r.width,
      height: r.height,
      photographer: { slug: r.slug, name: r.name, avatar_url: r.avatar_url },
    }));
  } catch {}

  const reviews = await getReviewsForLocation(city, 3, locale);

  // Mapbox token for the 3D spot map. Same env var as /locations uses;
  // empty string falls back to a static "map unavailable" panel.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  // Other spots in the same city — used in the carousel near the bottom.
  // Use the media-merged variant so siblings carry the SPOT_MEDIA images
  // (otherwise the carousel rendered empty placeholders for spots whose
  // photos live in spot-media.ts rather than inline in photo-spots-data.ts).
  const siblings = getSpotsWithMediaForCity(city).filter((other) => other.spotSlug !== spot);

  // Google Maps directions deep-link. If the spot has coordinates, prefer
  // them (precise pin); otherwise fall back to a name+city query.
  const mapsUrl = spotData.coordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${spotData.coordinates.lat},${spotData.coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${location.name}, Portugal`)}`;

  // Convert long_description into paragraphs for layout. Plain double-newline
  // splitting — long_description is hand-edited markdown-light text.
  const longDescription = s.long_description || s.description;
  const paragraphs = longDescription.split(/\n\n+/).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: s.name,
    description: s.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: location.name,
      addressCountry: "PT",
      streetAddress: spotData.address,
    },
    geo: spotData.coordinates ? {
      "@type": "GeoCoordinates",
      latitude: spotData.coordinates.lat,
      longitude: spotData.coordinates.lng,
    } : undefined,
    image: firstCuratedImage?.url || (photographers[0]?.cover_url
      ? (photographers[0].cover_url.startsWith("http") ? photographers[0].cover_url : `https://photoportugal.com${photographers[0].cover_url}`)
      : undefined),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://photoportugal.com/" },
          { "@type": "ListItem", position: 2, name: "Locations", item: "https://photoportugal.com/locations" },
          { "@type": "ListItem", position: 3, name: location.name, item: `https://photoportugal.com/locations/${city}` },
          { "@type": "ListItem", position: 4, name: s.name, item: `https://photoportugal.com/spots/${city}/${spot}` },
        ],
      }) }} />

      {/* === Hero === Swipeable carousel of every curated photo of the
          spot. One section, all the visual real estate the curated images
          deserve — instead of a separate "leftover gallery" below. Hero
          gradient overlays the entire carousel so H1/plaque text stays
          readable across slide transitions. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <SpotHeroCarousel
            images={carouselImages}
            photoByLabel={t.photoBy}
            viaLabel={t.via}
          />
        </div>
        <div className="pointer-events-none relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="pointer-events-auto max-w-3xl">
            <div className="mb-4 [&_*]:!text-primary-200">
              <Breadcrumbs
                items={[
                  { name: t.portugal, href: "/" },
                  { name: localizedCity, href: `/locations/${city}` },
                  { name: s.name, href: `/spots/${city}/${spot}` },
                ]}
              />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-300">
              {t.spotInCity} {localizedCity}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              {s.name}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-primary-100/90">{s.description}</p>
            <div className="mt-6 max-w-xl">
              <ConciergeInvitePlaque
                variant="dark"
                placeholder={`${t.placeholder} ${s.name}?`}
                chips={t.photographersChips}
              />
            </div>
          </div>
        </div>
      </section>

      {/* === About section === Half text, half 3D Mapbox view of the
          spot. The map breaks out of the contained column on desktop and
          extends to the right edge of the screen so the city geography
          gets visual weight equal to the long-form description. Map and
          text column are forced equal height with `items-stretch` so the
          map never looks like a floating chip when the description is
          short. */}
      <section className="bg-warm-50">
        <div className="grid grid-cols-1 items-stretch gap-8 py-12 sm:gap-10 sm:py-16 lg:grid-cols-2 lg:gap-0 lg:py-20">
          {/* Left: text + practical card. Inner-padding aligns with the
              max-w-7xl rhythm of the rest of the page. min-h-[480px]
              forces a floor so when the description is very short the map
              on the right doesn't shrink to a postage stamp. */}
          <div className="flex min-h-[480px] flex-col px-4 sm:px-6 lg:pl-8 lg:pr-10">
            <div className="ml-auto max-w-xl lg:mx-0">
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                {t.aboutTitle} {s.name}
              </h2>
              {/* Get directions sits right under the H1 — primary action
                  for a "where is this place" intent, doesn't need to be
                  buried at the bottom of a card. */}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-3.5 py-2 text-sm font-semibold text-primary-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {t.getDirections}
              </a>

              <div className="mt-5 space-y-4 text-gray-700 leading-relaxed">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {(s.best_time || s.tips) && (
                <div className="mt-6 rounded-2xl border border-warm-200 bg-white p-5 shadow-sm">
                  {s.best_time && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.bestTime}</h3>
                      <p className="mt-1.5 text-sm text-gray-700">{s.best_time}</p>
                    </div>
                  )}
                  {s.tips && (
                    <div className={s.best_time ? "mt-4 border-t border-warm-100 pt-4" : ""}>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.tips}</h3>
                      <p className="mt-1.5 text-sm text-gray-700">{s.tips}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: 3D Mapbox. On desktop bleeds to the viewport's right
              edge; height is driven by the left column (`stretch`), with
              a min-h floor so a short description still gives the map
              meaningful presence. */}
          <div className="min-h-[420px] overflow-hidden rounded-2xl px-4 sm:min-h-[480px] sm:px-6 lg:rounded-l-3xl lg:rounded-r-none lg:px-0">
            {spotData.coordinates ? (
              <SpotMap
                coordinates={spotData.coordinates}
                spotName={s.name}
                thumbnailUrl={spotData.images?.[0]?.url}
                mapboxToken={mapboxToken}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-warm-100 to-warm-200 text-sm text-gray-400">
                Map unavailable
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === Photographer photos masonry === Portfolio shots from
          photographers who COVER this city — not necessarily taken at this
          spot (we don't have spot-level portfolio tagging yet). Title
          reflects that honestly. Hidden when the city has no portfolio
          photos yet (graceful for new cities). */}
      {portfolioMasonry.length > 0 && (
        <LocationPhotosMasonry
          photos={portfolioMasonry}
          title={`${t.realPhotosTitle} ${localizedCity}`}
          subtitle={t.realPhotosSub}
        />
      )}

      {/* === Photographers grid === Same compact-card pattern as
          /locations/[slug]. Six top photographers covering the city. */}
      {photographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t.photographersHere} {s.name}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t.handpickedIn} {localizedCity}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {photographers.map((p) => (
                <PhotographerCardCompact
                  key={p.id}
                  p={{
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
                    rating: Number(p.rating || 0),
                    review_count: p.review_count,
                    min_price: p.min_price ? Number(p.min_price) : null,
                    locations: p.locations,
                    last_active_at: p.last_active_at,
                    avg_response_minutes: p.avg_response_minutes,
                    languages: p.languages,
                  }}
                />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href={`/photographers?location=${city}`}
                className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-5 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 hover:shadow-md"
              >
                {t.viewAllIn} {localizedCity}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* === Reviews === Same component as /locations/[slug] — keeps the
          social-proof rhythm consistent across the location/spot family. */}
      {reviews.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <ReviewsStrip
              reviews={reviews}
              title={`${t.reviewsTitle} ${localizedCity}${t.reviewsTitleSuffix ? ` ${t.reviewsTitleSuffix}` : ""}`}
              compact
            />
          </div>
        </section>
      )}

      {/* === Other spots in this city === Horizontal scroll-snap on mobile,
          3-up grid on desktop. Each card uses the spot's hero image when
          available, falls back to a tinted placeholder otherwise. */}
      {siblings.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {t.otherSpotsTitle} {localizedCity}
            </h2>
            <div className="mt-6 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:gap-5">
              {siblings.map((sib) => {
                const sibL = spotLocalized(sib, locale);
                const sibImg = sib.images?.[0]?.url;
                return (
                  <Link
                    key={sib.name}
                    href={`/spots/${city}/${spotSlug(sib.name)}`}
                    className="group block w-72 shrink-0 overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:shadow-md sm:w-auto"
                  >
                    <div className="relative aspect-[4/3] bg-warm-100">
                      {sibImg ? (
                        <OptimizedImage src={sibImg} alt={sibL.name} className="h-full w-full transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-warm-200 text-primary-600">
                          <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 transition group-hover:text-primary-700">{sibL.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{sibL.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* === Bottom CTA strip === Concierge handoff + "more from this
          city" link. Closes the page with the same conversion ask the
          hero opens with. */}
      <section className="border-t border-warm-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            {t.readyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            {t.conciergeDesc} {s.name} {t.freeOfCharge}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <TrackedConciergeTrigger
              ctaName="get_matched"
              location="spot_page_cta"
              className="inline-flex rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-700"
            >
              {t.getMatched}
            </TrackedConciergeTrigger>
            <Link
              href={`/locations/${city}`}
              className="inline-flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-primary-300 hover:text-primary-700"
            >
              {t.moreFrom} {localizedCity} {t.travelGuide}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
