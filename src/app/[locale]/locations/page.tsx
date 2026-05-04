import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations, locField } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { locationImage, IMAGE_SIZES } from "@/lib/unsplash-images";
import { queryOne, query } from "@/lib/db";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getHomepageReviews } from "@/lib/reviews-data";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { localizeShootType } from "@/lib/shoot-type-labels";
import { portugalCoverageStats } from "@/lib/location-coverage-stats";
import { LocationExplorer } from "@/components/locations/LocationExplorer";
import { getCompatibleCoverageNodeSlugs } from "@/lib/location-hierarchy";

// Force-dynamic so per-location photographer counts and min prices are
// always fresh — these are the conversion-relevant numbers on the cards.
export const dynamic = "force-dynamic";

// Top-of-mind cities that get the larger "featured" cards above the
// alphabetical grid. These are the highest-search-volume destinations
// for tourist photography in Portugal — keeping the list short (6) so
// each card can be visually big without wrapping.
const FEATURED_SLUGS = ["lisbon", "porto", "sintra", "algarve", "cascais", "madeira"];

function buildCoverageCounts(rows: { photographer_id: string; node_slug: string }[]): Record<string, number> {
  const slugsByPhotographer = new Map<string, Set<string>>();
  for (const row of rows) {
    const compatibleSlugs = getCompatibleCoverageNodeSlugs([row.node_slug]);
    if (compatibleSlugs.length === 0) continue;
    const photographerSlugs = slugsByPhotographer.get(row.photographer_id) || new Set<string>();
    compatibleSlugs.forEach((slug) => photographerSlugs.add(slug));
    slugsByPhotographer.set(row.photographer_id, photographerSlugs);
  }

  const counts: Record<string, number> = {};
  for (const photographerSlugs of slugsByPhotographer.values()) {
    photographerSlugs.forEach((slug) => {
      counts[slug] = (counts[slug] || 0) + 1;
    });
  }
  return counts;
}

async function getExplorerCoverageCounts(): Promise<Record<string, number>> {
  try {
    const rows = await query<{ photographer_id: string; node_slug: string }>(
      `SELECT pp.id::text as photographer_id, plc.node_slug
       FROM photographer_location_coverage plc
       JOIN photographer_profiles pp ON pp.id = plc.photographer_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE`
    );
    return buildCoverageCounts(rows);
  } catch {
    try {
      const rows = await query<{ photographer_id: string; node_slug: string }>(
        `SELECT pp.id::text as photographer_id, pl.location_slug as node_slug
         FROM photographer_locations pl
         JOIN photographer_profiles pp ON pp.id = pl.photographer_id
         WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE`
      );
      return buildCoverageCounts(rows);
    } catch {
      return {};
    }
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("locations");
  return {
    title: `${portugalCoverageStats.displayPlacesLabel} ${t("title")}`,
    description: t("subtitle", { count: portugalCoverageStats.displayPlaces }),
    alternates: localeAlternates("/locations", locale),
    openGraph: { title: `${portugalCoverageStats.displayPlacesLabel} ${t("title")}`, description: t("subtitle", { count: portugalCoverageStats.displayPlaces }), url: `https://photoportugal.com${locale === "en" ? "" : "/" + locale}/locations` },
  };
}

export default async function LocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tc = await getTranslations("common");

  // ─── Portugal-wide stats for the hero chip row ───────────────────────
  let totalPhotographers = 0;
  try {
    const stats = await queryOne<{ total_photographers: string }>(
      `SELECT COUNT(*)::text as total_photographers
       FROM photographer_profiles
       WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
    );
    totalPhotographers = parseInt(stats?.total_photographers || "0");
  } catch {}

  const explorerCoverageCounts = await getExplorerCoverageCounts();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  // ─── Per-location photographer counts + min prices for the cards ─────
  // Single roundtrip — group by location_slug so each card can show "live"
  // numbers without N+1 queries.
  let perLocation: Record<string, { count: number; minPrice: number | null }> = {};
  try {
    const rows = await query<{ location_slug: string; count: string; min_price: string | null }>(
      `SELECT pl.location_slug,
              COUNT(DISTINCT pp.id)::text as count,
              (SELECT MIN(pk.price)::text FROM packages pk
                 JOIN photographer_locations pl2 ON pl2.photographer_id = pk.photographer_id
                 WHERE pl2.location_slug = pl.location_slug AND pk.is_public = TRUE) as min_price
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
       GROUP BY pl.location_slug`
    );
    perLocation = Object.fromEntries(rows.map((r) => [r.location_slug, {
      count: parseInt(r.count),
      minPrice: r.min_price ? parseFloat(r.min_price) : null,
    }]));
  } catch {}

  // Reviews from across all locations (no slug filter) for the global strip.
  const allReviews = await getHomepageReviews(6, locale);

  // Featured = the curated top 6, in their declared order. Other = everything
  // else in the original locations[] order.
  const featured = FEATURED_SLUGS
    .map((slug) => locations.find((l) => l.slug === slug))
    .filter(Boolean) as typeof locations;
  const otherLocations = locations.filter((l) => !FEATURED_SLUGS.includes(l.slug));

  // Shoot type pills for the cross-link strip (links to /photoshoots/[type]).
  const SHOOT_TYPE_PILLS = [
    { slug: "couples", canonical: "Couples" },
    { slug: "family", canonical: "Family" },
    { slug: "proposal", canonical: "Proposal" },
    { slug: "engagement", canonical: "Engagement" },
    { slug: "honeymoon", canonical: "Honeymoon" },
    { slug: "solo", canonical: "Solo Portrait" },
    { slug: "elopement", canonical: "Elopement" },
    { slug: "wedding", canonical: "Wedding" },
  ];

  // Page-local localized strings (avoids polluting the message catalog).
  const T = {
    en: { destinations: "destinations", photographers: "verified photographers", from: "From €", rating: "rating", reviews: "reviews", featuredHeading: "Top destinations", featuredSub: "Where most travelers shoot — and where photographers know every angle.", allHeading: "All destinations in Portugal", allSub: "From mountain villages to island volcanoes — pick where your story happens.", typesHeading: "Or browse by photoshoot type", typesSub: "Same destinations, organised by occasion.", finalCta: "Not sure where to shoot?", finalCtaSub: "Tell our concierge what you have in mind and we'll match you with 2–3 photographers in hours.", findCta: "Get matched", browseCta: "Browse all photographers", reviewsHeading: "What travelers say about Portugal photographers", reviewsSubHeading: "Verified reviews from real bookings across the country.", matchHeading: "AI photographer match — instant", matchSubtitle: "Describe your shoot — hand-picked Portugal pros in under 10 seconds.", matchPlaceholder: "e.g. couples shoot in Lisbon next Friday at golden hour", matchCta: "Get matches" },
    pt: { destinations: "destinos", photographers: "fotógrafos verificados", from: "Desde €", rating: "avaliação", reviews: "avaliações", featuredHeading: "Destinos principais", featuredSub: "Onde a maioria dos viajantes faz fotos — e onde os fotógrafos conhecem cada ângulo.", allHeading: "Todos os destinos em Portugal", allSub: "De aldeias serranas a vulcões insulares — escolha onde a sua história acontece.", typesHeading: "Ou explore por tipo de sessão", typesSub: "Os mesmos destinos, organizados por ocasião.", finalCta: "Não sabe onde fotografar?", finalCtaSub: "Conte ao nosso concierge o que tem em mente e vamos emparelhá-lo com 2–3 fotógrafos em poucas horas.", findCta: "Receber recomendações", browseCta: "Ver todos os fotógrafos", reviewsHeading: "O que dizem os viajantes sobre fotógrafos em Portugal", reviewsSubHeading: "Avaliações verificadas de reservas reais por todo o país.", matchHeading: "Match com fotógrafo por IA — instantâneo", matchSubtitle: "Descreva a sessão — profissionais portugueses em menos de 10 segundos.", matchPlaceholder: "ex.: sessão de casal em Lisboa sexta à hora dourada", matchCta: "Ver matches" },
    de: { destinations: "Orte", photographers: "verifizierte Fotografen", from: "Ab €", rating: "Bewertung", reviews: "Bewertungen", featuredHeading: "Top-Destinationen", featuredSub: "Wo die meisten Reisenden fotografieren — und wo Fotografen jeden Winkel kennen.", allHeading: "Alle Orte in Portugal", allSub: "Von Bergdörfern bis zu Inselvulkanen — wählen Sie den Ort Ihrer Geschichte.", typesHeading: "Oder nach Shooting-Art durchsuchen", typesSub: "Dieselben Orte, nach Anlass sortiert.", finalCta: "Sie wissen noch nicht, wo?", finalCtaSub: "Erzählen Sie unserem Concierge, was Sie sich vorstellen — wir vermitteln Ihnen 2–3 Fotografen innerhalb weniger Stunden.", findCta: "Vermittlung anfragen", browseCta: "Alle Fotografen ansehen", reviewsHeading: "Was Reisende über Fotografen in Portugal sagen", reviewsSubHeading: "Verifizierte Bewertungen von echten Buchungen im ganzen Land.", matchHeading: "KI-Fotografen-Match — sofort", matchSubtitle: "Beschreiben Sie Ihr Shooting — handverlesene Portugal-Profis in unter 10 Sekunden.", matchPlaceholder: "z. B. Paar-Shooting in Lissabon am Freitag zur goldenen Stunde", matchCta: "Vorschläge holen" },
    es: { destinations: "destinos", photographers: "fotógrafos verificados", from: "Desde €", rating: "valoración", reviews: "reseñas", featuredHeading: "Destinos destacados", featuredSub: "Donde la mayoría de los viajeros toman fotos — y donde los fotógrafos conocen cada ángulo.", allHeading: "Todos los destinos en Portugal", allSub: "De pueblos de montaña a volcanes insulares — elija dónde sucede su historia.", typesHeading: "O explore por tipo de sesión", typesSub: "Los mismos destinos, organizados por ocasión.", finalCta: "¿No sabe dónde fotografiar?", finalCtaSub: "Cuéntele a nuestro concierge lo que tiene en mente y le emparejaremos con 2–3 fotógrafos en pocas horas.", findCta: "Recibir recomendaciones", browseCta: "Ver todos los fotógrafos", reviewsHeading: "Lo que dicen los viajeros sobre fotógrafos en Portugal", reviewsSubHeading: "Reseñas verificadas de reservas reales en todo el país.", matchHeading: "Match con fotógrafo por IA — al instante", matchSubtitle: "Describa su sesión — profesionales portugueses en menos de 10 segundos.", matchPlaceholder: "p. ej. sesión de pareja en Lisboa el viernes a la hora dorada", matchCta: "Ver matches" },
    fr: { destinations: "destinations", photographers: "photographes vérifiés", from: "À partir de €", rating: "note", reviews: "avis", featuredHeading: "Destinations phares", featuredSub: "Là où la plupart des voyageurs photographient — et où les photographes connaissent chaque angle.", allHeading: "Toutes les destinations au Portugal", allSub: "Des villages de montagne aux volcans insulaires — choisissez où se déroule votre histoire.", typesHeading: "Ou parcourez par type de séance", typesSub: "Les mêmes destinations, classées par occasion.", finalCta: "Vous ne savez pas où photographier ?", finalCtaSub: "Dites à notre concierge ce que vous avez en tête et nous vous proposerons 2–3 photographes en quelques heures.", findCta: "Être mis en relation", browseCta: "Voir tous les photographes", reviewsHeading: "Ce que les voyageurs disent des photographes au Portugal", reviewsSubHeading: "Avis vérifiés issus de vraies réservations partout dans le pays.", matchHeading: "Mise en relation par IA — instantanée", matchSubtitle: "Décrivez votre séance — photographes du Portugal en moins de 10 secondes.", matchPlaceholder: "ex. séance couple à Lisbonne vendredi à l'heure dorée", matchCta: "Voir les matches" },
  } as const;
  const tt = T[(locale as keyof typeof T)] ?? T.en;

  // ─── JSON-LD ─────────────────────────────────────────────────────────
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: locations.length,
    itemListElement: locations.map((loc, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://photoportugal.com/locations/${loc.slug}`,
      name: loc.name,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("locations"), href: "/locations" },
        ]}
      />

      <LocationExplorer
        locale={locale}
        mapboxToken={mapboxToken}
        totalPhotographers={totalPhotographers}
        coverageCounts={explorerCoverageCounts}
      />

      {/* Featured destinations — the 6 highest-traffic cities as large
          editorial cards. Each card carries cover photo + live photographer
          count + min price + a short description; the whole tile links to
          /locations/[slug]. */}
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              {tt.featuredHeading}
            </h2>
            <p className="mt-3 text-gray-500">{tt.featuredSub}</p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((loc) => {
              const stats = perLocation[loc.slug];
              const localizedName = locField(loc, "name", locale) || loc.name;
              const description = locField(loc, "description", locale) || loc.description;
              return (
                <Link
                  key={loc.slug}
                  href={`/locations/${loc.slug}`}
                  className="group relative overflow-hidden rounded-2xl bg-gray-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden">
                    <OptimizedImage
                      src={locationImage(loc.slug, "cardLarge")}
                      alt={`${localizedName} photographers`}
                      width={IMAGE_SIZES.cardLarge}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/95 via-gray-900/50 to-transparent" />

                  {/* Top-right photographer count badge */}
                  {stats && stats.count > 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {stats.count} {tt.photographers.split(" ").pop()}
                    </span>
                  )}

                  {/* Bottom overlay text */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary-300">
                      {loc.region}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-bold text-white">
                      {localizedName}
                    </h3>
                    <p className="mt-2 text-sm text-white/80 line-clamp-2">
                      {description}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      {stats?.minPrice && (
                        <span className="font-semibold text-white">
                          {tt.from}{Math.round(stats.minPrice)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-medium text-white backdrop-blur-sm">
                        {tc("findPhotographers")}
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* All other destinations grid — uses the existing LocationCard so
          it shares the visual language with /locations/[slug] subpages. */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              {tt.allHeading}
            </h2>
            <p className="mt-3 text-gray-500">{tt.allSub}</p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {otherLocations.map((location) => (
              <LocationCard key={location.slug} location={location} locale={locale} />
            ))}
          </div>
        </div>
      </section>

      {/* Cross-link to /photoshoots/[type] — completes the SEO triangle
          (locations index ↔ shoot-type index ↔ combo). 8 pills, each
          links into the polished shoot-type page. */}
      <section className="border-t border-warm-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              {tt.typesHeading}
            </h2>
            <p className="mt-3 text-gray-500">{tt.typesSub}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {SHOOT_TYPE_PILLS.map((s) => (
              <Link
                key={s.slug}
                href={`/photoshoots/${s.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-warm-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                {localizeShootType(s.canonical, locale)}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews from across Portugal */}
      {allReviews.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <ReviewsStrip
              reviews={allReviews}
              title={tt.reviewsHeading}
              subtitle={tt.reviewsSubHeading}
              compact
            />
          </div>
        </section>
      )}

      {/* How It Works (shared component) */}
      <HowItWorksSection />

      {/* Final CTA */}
      <section className="bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white">
            {tt.finalCta}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            {tt.finalCtaSub}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/find-photographer"
              className="inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-700"
            >
              {tt.findCta}
            </Link>
            <Link
              href="/photographers"
              className="inline-flex rounded-xl border border-gray-700 bg-gray-800 px-8 py-4 text-base font-semibold text-white transition hover:bg-gray-700"
            >
              {tt.browseCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
