import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { photoSpots, spotSlug, getSpot, spotLocalized } from "@/lib/photo-spots-data";
import { getLocationBySlug, locations } from "@/lib/locations-data";
import { query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
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
};

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
  const t = L[locale === "pt" ? "pt" : "en"];
  const title = locale === "pt"
    ? `Fotógrafo em ${s.name}, ${location.name} — ${t.titleSuffix}`
    : `${s.name} Photographer in ${location.name} — ${t.titleSuffix}`;
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
  const t = L[locale === "pt" ? "pt" : "en"];

  // Photographers working in this city
  const photographers = await query<{
    id: string; slug: string; name: string; avatar_url: string | null; cover_url: string | null;
    tagline: string | null; rating: number; review_count: number;
    min_price: number | null;
  }>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url, pp.tagline, pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     JOIN photographer_locations pl ON pl.photographer_id = pp.id
     WHERE pp.is_approved = TRUE AND pl.location_slug = $1
     ORDER BY pp.is_featured DESC, pp.rating DESC NULLS LAST, pp.review_count DESC NULLS LAST
     LIMIT 6`,
    [city]
  ).catch(() => []);

  const reviews = await getReviewsForLocation(city, 3);

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
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {photographers.map((p) => (
                    <Link
                      key={p.id}
                      href={`/photographers/${p.slug}`}
                      className="group overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:shadow-md"
                    >
                      <div className="relative h-36 overflow-hidden bg-warm-100">
                        {p.cover_url ? (
                          <OptimizedImage src={p.cover_url} alt={`${p.name} photography in ${location.name}`} width={400} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-warm-100 to-warm-200" />
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary-100">
                            {p.avatar_url ? (
                              <OptimizedImage src={p.avatar_url} alt={p.name} width={80} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary-700">{p.name.charAt(0)}</div>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600">{p.name}</p>
                        </div>
                        {p.tagline && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{p.tagline}</p>}
                        <div className="mt-2 flex items-center justify-between text-xs">
                          {p.review_count > 0 ? (
                            <span className="text-amber-600">★ {Number(p.rating).toFixed(1)} ({p.review_count})</span>
                          ) : <span className="text-gray-400">{t.newLabel}</span>}
                          {p.min_price && <span className="font-semibold text-gray-700">from €{Math.round(Number(p.min_price))}</span>}
                        </div>
                      </div>
                    </Link>
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
