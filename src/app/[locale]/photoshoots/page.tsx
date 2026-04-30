import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shootTypes, shootTypeLocalized } from "@/lib/shoot-types-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { query, queryOne } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getHomepageReviews } from "@/lib/reviews-data";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { PortfolioMosaic } from "@/components/ui/PortfolioMosaic";
import { locations } from "@/lib/locations-data";

// Force-dynamic so live counts + min prices + the random representative
// photo per tile reshuffle on each request — same freshness pattern as
// /locations/[slug] and /photoshoots/[type].
export const dynamic = "force-dynamic";

// Combo /locations/[slug]/[occasion] exists for these 7 — tiles route the
// pill cross-links accordingly. Anything outside this set falls back to
// the parent /locations/[slug] page.
const COMBO_OCCASIONS = new Set([
  "couples", "family", "proposal", "engagement",
  "honeymoon", "solo", "elopement",
]);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shootTypesPage");
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/photoshoots", locale),
  };
}

export default async function PhotoshootsHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("shootTypesPage");
  const tc = await getTranslations("common");

  // ─── Per-shoot-type stats (count + min price) ───────────────────────
  // One query per shoot type — small N (14) so the parallel Promise.all
  // is fine, and keeps the SQL simple.
  const stats: Record<string, { count: number; minPrice: number | null }> = {};
  await Promise.all(
    shootTypes.map(async (st) => {
      const aliases = st.photographerShootTypeNames || [st.name];
      try {
        const row = await queryOne<{ count: string; min_price: string | null }>(
          `SELECT COUNT(DISTINCT pp.id)::text as count,
                  (SELECT MIN(pk.price) FROM packages pk
                   JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
                   WHERE pp2.is_approved = TRUE AND pk.is_public = TRUE
                     AND pp2.shoot_types && $1::text[]) as min_price
           FROM photographer_profiles pp
           WHERE pp.is_approved = TRUE AND pp.shoot_types && $1::text[]`,
          [aliases]
        );
        stats[st.slug] = {
          count: parseInt(row?.count || "0"),
          minPrice: row?.min_price ? parseFloat(row.min_price) : null,
        };
      } catch {
        stats[st.slug] = { count: 0, minPrice: null };
      }
    })
  );

  // ─── Representative photo per shoot type ────────────────────────────
  // One photo per shoot_type label — used as the tile background. Random
  // pick within each type so the page feels alive between visits.
  const representative: Record<string, string | null> = {};
  try {
    const rows = await query<{ shoot_type: string; url: string }>(
      `SELECT DISTINCT ON (pi.shoot_type) pi.shoot_type, pi.url
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       WHERE pi.shoot_type IS NOT NULL
         AND pi.type = 'photo'
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
       ORDER BY pi.shoot_type, RANDOM()`
    );
    for (const r of rows) representative[r.shoot_type] = r.url;
  } catch {}

  // ─── Top 24 photos for the hero mosaic (mixed shoot types) ──────────
  let heroMosaic: { url: string; slug: string; name: string; location: string | null }[] = [];
  try {
    const rows = await query<{ url: string; slug: string; name: string; location_slug: string | null }>(
      `SELECT pi.url, pp.slug, u.name, pi.location_slug
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pi.type = 'photo'
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 24`
    );
    heroMosaic = rows.map((r) => {
      const locName = r.location_slug
        ? (locations.find((l) => l.slug === r.location_slug)?.name || null)
        : null;
      return { url: r.url, slug: r.slug, name: r.name, location: locName };
    });
  } catch {}

  // ─── Portugal-wide totals for the hero chip row ─────────────────────
  let totalPhotographers = 0;
  let avgRating = 0;
  let totalReviews = 0;
  try {
    const row = await queryOne<{ total: string; avg_rating: string | null; total_reviews: string }>(
      `SELECT (SELECT COUNT(*)::text FROM photographer_profiles WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE) as total,
              (SELECT AVG(rating) FILTER (WHERE rating IS NOT NULL AND review_count > 0)::text FROM photographer_profiles WHERE is_approved = TRUE) as avg_rating,
              (SELECT COALESCE(SUM(review_count), 0)::text FROM photographer_profiles WHERE is_approved = TRUE) as total_reviews`
    );
    totalPhotographers = parseInt(row?.total || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
  } catch {}

  const allReviews = await getHomepageReviews(6, locale);

  // ─── JSON-LD ────────────────────────────────────────────────────────
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: shootTypes.length,
    itemListElement: shootTypes.map((type, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://photoportugal.com/photoshoots/${type.slug}`,
      name: `${type.name} Photoshoot in Portugal`,
    })),
  };

  // Page-local localized strings.
  const T = {
    en: { types: "shoot types", photographers: "verified photographers", from: "From €", reviews: "reviews", availableHeading: "Find the right session for any moment", availableSub: "Real photographers, real packages, real photos — choose the type of shoot and we'll show you the people who shoot it best.", in: "in", typesHeading: "All photoshoot types", typesSub: "Each tile shows live availability and the cities where this type happens most.", reviewsHeading: "What clients say across all sessions", reviewsSubHeading: "Verified reviews from real bookings, every shoot type included.", finalCta: "Help me pick the right session", finalCtaSub: "Tell our concierge what you have in mind and we'll match you with 2–3 photographers in hours.", findCta: "Get matched", browseCta: "Browse all photographers", citiesLabel: "Top cities" },
    pt: { types: "tipos de sessão", photographers: "fotógrafos verificados", from: "Desde €", reviews: "avaliações", availableHeading: "Encontre a sessão certa para qualquer momento", availableSub: "Fotógrafos reais, pacotes reais, fotos reais — escolha o tipo de sessão e mostramos quem o fotografa melhor.", in: "em", typesHeading: "Todos os tipos de sessão", typesSub: "Cada cartão mostra disponibilidade ao vivo e as cidades onde este tipo acontece mais.", reviewsHeading: "O que dizem os clientes em todas as sessões", reviewsSubHeading: "Avaliações verificadas de reservas reais, todos os tipos incluídos.", finalCta: "Ajude-me a escolher a sessão", finalCtaSub: "Conte ao nosso concierge o que tem em mente e vamos emparelhá-lo com 2–3 fotógrafos em poucas horas.", findCta: "Receber recomendações", browseCta: "Ver todos os fotógrafos", citiesLabel: "Cidades principais" },
    de: { types: "Shooting-Arten", photographers: "verifizierte Fotografen", from: "Ab €", reviews: "Bewertungen", availableHeading: "Finden Sie das richtige Shooting für jeden Anlass", availableSub: "Echte Fotografen, echte Pakete, echte Fotos — wählen Sie die Shooting-Art und wir zeigen, wer sie am besten umsetzt.", in: "in", typesHeading: "Alle Shooting-Arten", typesSub: "Jede Kachel zeigt Live-Verfügbarkeit und die Städte, in denen dieses Shooting am häufigsten passiert.", reviewsHeading: "Was Kunden über alle Shootings sagen", reviewsSubHeading: "Verifizierte Bewertungen aus echten Buchungen, alle Shooting-Arten enthalten.", finalCta: "Helfen Sie mir bei der Wahl", finalCtaSub: "Erzählen Sie unserem Concierge, was Sie sich vorstellen — wir vermitteln 2–3 Fotografen innerhalb weniger Stunden.", findCta: "Vermittlung anfragen", browseCta: "Alle Fotografen ansehen", citiesLabel: "Top-Städte" },
    es: { types: "tipos de sesión", photographers: "fotógrafos verificados", from: "Desde €", reviews: "reseñas", availableHeading: "Encuentre la sesión adecuada para cualquier momento", availableSub: "Fotógrafos reales, paquetes reales, fotos reales — elija el tipo de sesión y le mostramos quién la fotografía mejor.", in: "en", typesHeading: "Todos los tipos de sesión", typesSub: "Cada baldosa muestra disponibilidad en vivo y las ciudades donde más ocurre este tipo.", reviewsHeading: "Lo que dicen los clientes en todas las sesiones", reviewsSubHeading: "Reseñas verificadas de reservas reales, todos los tipos incluidos.", finalCta: "Ayúdame a elegir la sesión", finalCtaSub: "Cuéntele a nuestro concierge lo que tiene en mente y le emparejaremos con 2–3 fotógrafos en pocas horas.", findCta: "Recibir recomendaciones", browseCta: "Ver todos los fotógrafos", citiesLabel: "Ciudades principales" },
    fr: { types: "types de séances", photographers: "photographes vérifiés", from: "À partir de €", reviews: "avis", availableHeading: "Trouvez la séance qui convient à chaque moment", availableSub: "De vrais photographes, de vrais forfaits, de vraies photos — choisissez le type de séance et nous vous montrons qui la réalise le mieux.", in: "à", typesHeading: "Tous les types de séances", typesSub: "Chaque tuile montre la disponibilité en direct et les villes où ce type a lieu le plus souvent.", reviewsHeading: "Ce que disent les clients sur toutes les séances", reviewsSubHeading: "Avis vérifiés issus de vraies réservations, tous types confondus.", finalCta: "Aidez-moi à choisir la séance", finalCtaSub: "Dites à notre concierge ce que vous avez en tête et nous vous proposerons 2–3 photographes en quelques heures.", findCta: "Être mis en relation", browseCta: "Voir tous les photographes", citiesLabel: "Villes phares" },
  } as const;
  const tt = T[(locale as keyof typeof T)] ?? T.en;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("photoshoots"), href: "/photoshoots" },
        ]}
      />

      {/* Hero — sticky text + portfolio mosaic on desktop, mosaic-only
          on mobile so it doesn't push the form below the fold. The
          mosaic auto-rotates between 24 real photos Portugal-wide. */}
      <section className="relative bg-warm-50">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
            <div className="max-w-xl lg:sticky lg:top-24">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {shootTypes.length} {tt.types}
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] text-gray-900 sm:text-5xl lg:text-[3.25rem]">
                {t("title")}
              </h1>
              <p className="mt-4 text-lg text-gray-600">{t("subtitle")}</p>

              {/* Stats chips */}
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
                {totalPhotographers > 0 && (
                  <span className="rounded-full bg-warm-100 px-3 py-1 text-gray-700">
                    {totalPhotographers}+ {tt.photographers}
                  </span>
                )}
                {avgRating > 0 && totalReviews > 0 && (
                  <span className="rounded-full bg-warm-100 px-3 py-1 text-gray-700">
                    ⭐ {avgRating.toFixed(1)} · {totalReviews} {tt.reviews}
                  </span>
                )}
                <span className="rounded-full bg-warm-100 px-3 py-1 text-gray-700">
                  {locations.length} destinations
                </span>
              </div>

              <div className="mt-7">
                <MatchQuickForm
                  source="photoshoots_index_hero"
                  size="md"
                />
              </div>
            </div>

            <div className="hidden lg:block lg:h-[140vh]">
              {heroMosaic.length > 0 && (
                <PortfolioMosaic photos={heroMosaic} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* The grid — 14 magazine-style tiles, each one a real photo +
          live stats + 4 city pill cross-links into the combo pages. */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              {tt.typesHeading}
            </h2>
            <p className="mt-3 text-gray-500">{tt.typesSub}</p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shootTypes.map((type) => {
              const stl = shootTypeLocalized(type, locale);
              const s = stats[type.slug] || { count: 0, minPrice: null };
              const dbLabel = (type.photographerShootTypeNames || [type.name])[0];
              const photo = representative[dbLabel] || representative[type.name];
              const cities = type.bestLocations.slice(0, 4);
              const comboOk = COMBO_OCCASIONS.has(type.slug);

              return (
                <div
                  key={type.slug}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  {/* Photo + overlay header */}
                  <Link
                    href={`/photoshoots/${type.slug}`}
                    className="relative block aspect-[4/3] overflow-hidden bg-gray-900"
                  >
                    {photo ? (
                      <OptimizedImage
                        src={photo}
                        alt={`${stl.name} photoshoot in Portugal`}
                        className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary-400 to-primary-700" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />

                    {/* Top-right live count badge */}
                    {s.count > 0 && (
                      <span className="absolute right-3 top-3 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        {s.count} {tt.photographers.split(" ").pop()}
                      </span>
                    )}

                    {/* Bottom title block */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h3 className="font-display text-2xl font-bold text-white">
                        {stl.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-sm">
                        {s.minPrice !== null && (
                          <span className="font-semibold text-white">
                            {tt.from}{Math.round(s.minPrice)}
                          </span>
                        )}
                        <span className="text-white/80">{tc("photoshoots")}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Cross-links to combo pages — main SEO win on this
                      page (4 internal links per tile × 14 tiles = up to
                      56 dense links to /locations/[slug]/[occasion]). */}
                  {cities.length > 0 && (
                    <div className="px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {tt.citiesLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cities.map((city) => {
                          const cityR = city as unknown as Record<string, string | undefined>;
                          const cityName = cityR[`name_${locale}`] || city.name;
                          const href = comboOk
                            ? `/locations/${city.slug}/${type.slug}`
                            : `/locations/${city.slug}`;
                          return (
                            <Link
                              key={city.slug}
                              href={href}
                              className="inline-flex items-center gap-1 rounded-full border border-warm-200 bg-warm-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                            >
                              {stl.name} {tt.in} {cityName}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reviews from across all shoot types */}
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

      {/* How It Works (shared) */}
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
