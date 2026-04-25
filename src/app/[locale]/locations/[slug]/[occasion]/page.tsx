import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLocationBySlug, getNearbyLocations, locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { localeAlternates } from "@/lib/seo";
import { query, queryOne } from "@/lib/db";
import { Avatar } from "@/components/ui/Avatar";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { normalizeName } from "@/lib/format-name";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";

export const revalidate = 86400;

const OCCASIONS: Record<string, { title: string; titlePt: string; titleDe: string; description: string; descriptionPt: string; descriptionDe: string; emoji: string }> = {
  proposal: {
    title: "Proposal Photographer",
    titlePt: "Fotógrafo de Pedido de Casamento",
    titleDe: "Fotograf für Heiratsantrag",
    description: "Capture your surprise proposal with a professional photographer who will discreetly document every moment of this life-changing event.",
    descriptionPt: "Capture o seu pedido de casamento surpresa com um fotógrafo profissional que documentará discretamente cada momento deste evento.",
    descriptionDe: "Halten Sie Ihren Überraschungsantrag mit einem professionellen Fotografen fest, der jeden Moment dieses bewegenden Ereignisses diskret dokumentiert.",
    emoji: "💍",
  },
  honeymoon: {
    title: "Honeymoon Photographer",
    titlePt: "Fotógrafo de Lua de Mel",
    titleDe: "Fotograf für die Flitterwochen",
    description: "Celebrate your honeymoon with stunning professional photos at the most romantic spots. Natural, candid moments that tell your love story.",
    descriptionPt: "Celebre a sua lua de mel com fotos profissionais deslumbrantes nos locais mais românticos.",
    descriptionDe: "Feiern Sie Ihre Flitterwochen mit traumhaften professionellen Fotos an den romantischsten Orten. Natürliche, unverfälschte Momente, die Ihre Liebesgeschichte erzählen.",
    emoji: "🥂",
  },
  couples: {
    title: "Couples Photographer",
    titlePt: "Fotógrafo de Casais",
    titleDe: "Paar-Fotograf",
    description: "Professional couples photography for vacations, anniversaries, and romantic getaways. Relaxed, natural sessions that capture real connection.",
    descriptionPt: "Fotografia profissional de casais para férias, aniversários e escapadelas românticas.",
    descriptionDe: "Professionelle Paarfotografie für Urlaube, Hochzeitstage und romantische Auszeiten. Entspannte, natürliche Sessions, die echte Verbundenheit einfangen.",
    emoji: "❤️",
  },
  family: {
    title: "Family Photographer",
    titlePt: "Fotógrafo de Família",
    titleDe: "Familienfotograf",
    description: "Kid-friendly family photoshoots with experienced photographers who know how to keep everyone relaxed and capture genuine moments.",
    descriptionPt: "Sessões fotográficas familiares com fotógrafos experientes que sabem captar momentos genuínos.",
    descriptionDe: "Familienfreundliche Fotoshootings mit erfahrenen Fotografen, die wissen, wie alle entspannt bleiben und echte Momente festgehalten werden.",
    emoji: "👨‍👩‍👧‍👦",
  },
  solo: {
    title: "Solo Travel Photographer",
    titlePt: "Fotógrafo para Viajantes Solo",
    titleDe: "Fotograf für Alleinreisende",
    description: "Professional portraits for solo travelers. Get amazing photos of yourself at iconic locations — no more selfies or asking strangers.",
    descriptionPt: "Retratos profissionais para viajantes solo. Fotos incríveis em locais icónicos.",
    descriptionDe: "Professionelle Porträts für Alleinreisende. Wunderschöne Aufnahmen von Ihnen an ikonischen Orten — keine Selfies, keine Fremden mehr fragen.",
    emoji: "🧳",
  },
  engagement: {
    title: "Engagement Photographer",
    titlePt: "Fotógrafo de Noivado",
    titleDe: "Verlobungsfotograf",
    description: "Pre-wedding engagement photoshoots at stunning locations. Perfect for save-the-dates, announcements, or simply celebrating your engagement.",
    descriptionPt: "Sessões fotográficas de noivado em locais deslumbrantes.",
    descriptionDe: "Verlobungsfotoshootings vor der Hochzeit an beeindruckenden Orten. Perfekt für Save-the-Dates, Ankündigungen oder einfach zur Feier Ihrer Verlobung.",
    emoji: "💑",
  },
  elopement: {
    title: "Elopement Photographer",
    titlePt: "Fotógrafo de Elopement",
    titleDe: "Elopement-Fotograf",
    description: "Intimate elopement photography for couples choosing to celebrate their love privately in one of the most beautiful countries in Europe.",
    descriptionPt: "Fotografia íntima de elopement para casais que escolhem celebrar o seu amor em privado.",
    descriptionDe: "Intime Elopement-Fotografie für Paare, die ihre Liebe privat in einem der schönsten Länder Europas feiern möchten.",
    emoji: "🌿",
  },
};

function occTitle(o: { title: string; titlePt: string; titleDe: string }, locale: string) {
  if (locale === "pt") return o.titlePt;
  if (locale === "de") return o.titleDe;
  return o.title;
}
function occDesc(o: { description: string; descriptionPt: string; descriptionDe: string }, locale: string) {
  if (locale === "pt") return o.descriptionPt;
  if (locale === "de") return o.descriptionDe;
  return o.description;
}

export async function generateStaticParams() {
  const slugs = locations.map((l) => l.slug);
  const occasions = Object.keys(OCCASIONS);
  return slugs.flatMap((slug) => occasions.map((occasion) => ({ slug, occasion })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string; occasion: string }> }): Promise<Metadata> {
  const { locale, slug, occasion } = await params;
  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) return {};

  const shootType = shootTypes.find((st) => st.slug === occasion);
  const locName = locale === "de" && location.name_de ? location.name_de : location.name;
  const title = locale === "pt"
    ? `${occ.titlePt} em ${locName} — Reserve Sessão Fotográfica`
    : locale === "de"
    ? `${occ.titleDe} in ${locName} — Fotoshooting buchen`
    : `${occ.title} in ${locName} — Book a Photoshoot`;
  const description = locale === "pt"
    ? `${occ.descriptionPt} Reserve o seu ${occ.titlePt.toLowerCase()} em ${locName}. Portfolios verificados, reserva instantanea. Desde 150EUR.`
    : locale === "de"
    ? `${occ.descriptionDe} Buchen Sie Ihren ${occ.titleDe} in ${locName}. Verifizierte Portfolios, sofortige Buchung. Ab 150 €.`
    : `${occ.description} Book your ${occ.title.toLowerCase()} in ${locName}. Verified portfolios, instant booking. From EUR150.`;

  return {
    title,
    description,
    alternates: localeAlternates(`/locations/${slug}/${occasion}`, locale),
    openGraph: { title, description, url: `https://photoportugal.com/locations/${slug}/${occasion}` },
  };
}

export default async function OccasionPage({ params }: { params: Promise<{ locale: string; slug: string; occasion: string }> }) {
  const { locale, slug, occasion } = await params;
  setRequestLocale(locale);

  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) notFound();

  // Get photographers at this location that offer this shoot type
  let photographers: { slug: string; name: string; avatar_url: string | null; rating: number; review_count: number; starting_price: number | null }[] = [];
  try {
    photographers = await query<{ slug: string; name: string; avatar_url: string | null; rating: number; review_count: number; starting_price: number | null }>(
      `SELECT pp.slug, u.name, u.avatar_url, pp.rating, pp.review_count,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as starting_price
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND pp.id IN (
         SELECT photographer_id FROM photographer_locations WHERE location_slug = $1
       )
       ORDER BY RANDOM() LIMIT 8`,
      [slug]
    );
  } catch {}

  // Aggregate stats for schema
  let avgRating = 0;
  let totalReviews = 0;
  try {
    const stats = await queryOne<{ avg_rating: string | null; total_reviews: string }>(
      `SELECT AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE`,
      [slug]
    );
    avgRating = stats?.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(stats?.total_reviews || "0");
  } catch {}

  const nearby = getNearbyLocations(slug);
  const shootTypeData = shootTypes.find((st) => st.slug === occasion);

  const locName = locale === "de" && location.name_de ? location.name_de : location.name;
  const occT = occTitle(occ, locale);
  const occD = occDesc(occ, locale);
  const title = locale === "pt"
    ? `${occ.titlePt} em ${locName}`
    : locale === "de"
    ? `${occ.titleDe} in ${locName}`
    : `${occ.title} in ${locName}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${occT} in ${locName}, Portugal`,
    description: occD,
    url: `https://photoportugal.com/locations/${slug}/${occasion}`,
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
    ...(photographers.length > 0 && photographers[0].starting_price ? {
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: String(photographers[0].starting_price),
        availability: "https://schema.org/InStock",
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

  // FAQ schema from shoot type data
  const rawFaqs = shootTypeData?.faqs || [];
  const faqs = rawFaqs.map((f) => ({
    question: locale === "pt" && f.question_pt ? f.question_pt : locale === "de" && f.question_de ? f.question_de : f.question,
    answer: locale === "pt" && f.answer_pt ? f.answer_pt : locale === "de" && f.answer_de ? f.answer_de : f.answer,
  }));
  const jsonLdFaq = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const breadcrumbs = [
    { name: locale === "pt" ? "Início" : locale === "de" ? "Startseite" : "Home", href: "/" },
    { name: locale === "pt" ? "Localizações" : locale === "de" ? "Orte" : "Locations", href: "/locations" },
    { name: locName, href: `/locations/${slug}` },
    { name: occT, href: `/locations/${slug}/${occasion}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-6">
        <span className="text-4xl">{occ.emoji}</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-lg text-gray-600 leading-relaxed max-w-2xl">
          {occD}
        </p>
      </div>

      {/* Photographers */}
      {photographers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {locale === "pt"
              ? `Fotógrafos disponíveis em ${locName}`
              : locale === "de"
              ? `Verfügbare Fotografen in ${locName}`
              : `Available photographers in ${locName}`}
          </h2>
          <div className="mt-4">
            <ScarcityBanner count={photographers.length} locationName={locName} locale={locale} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photographers.map((p) => (
              <Link
                key={p.slug}
                href={`/photographers/${p.slug}`}
                className="flex items-center gap-4 rounded-xl border border-warm-200 bg-white p-4 transition hover:shadow-md"
              >
                <Avatar src={p.avatar_url} fallback={normalizeName(p.name)} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{normalizeName(p.name)}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                    {Number(p.rating) > 0 && <span className="text-amber-500">★ {Number(p.rating).toFixed(1)}</span>}
                    {p.review_count > 0 && <span>({p.review_count} reviews)</span>}
                  </div>
                  {p.starting_price && (
                    <p className="mt-0.5 text-sm font-medium text-gray-700">
                      {locale === "pt" ? "Desde" : locale === "de" ? "Ab" : "From"} &euro;{Math.round(Number(p.starting_price))}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* About this location — SEO-rich content */}
      {((locale === "pt" && location.long_description_pt) ||
        (locale === "de" && location.long_description_de) ||
        location.long_description) && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {locale === "pt"
              ? `Sobre ${locName}`
              : locale === "de"
              ? `Über ${locName}`
              : `About ${locName}`}
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            {locale === "pt"
              ? location.long_description_pt
              : locale === "de"
              ? (location.long_description_de || location.long_description)
              : location.long_description}
          </p>
        </section>
      )}

      {/* Other occasions in this location */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-gray-900">
          {locale === "pt"
            ? `Outras ocasiões em ${locName}`
            : locale === "de"
            ? `Weitere Anlässe in ${locName}`
            : `Other occasions in ${locName}`}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(OCCASIONS)
            .filter(([key]) => key !== occasion)
            .map(([key, occ]) => (
              <Link
                key={key}
                href={`/locations/${slug}/${key}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                <span>{occ.emoji}</span>
                {occTitle(occ, locale)}
              </Link>
            ))}
        </div>
      </section>

      {/* Same occasion in nearby locations */}
      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {locale === "pt"
              ? `${occ.titlePt} em destinos próximos`
              : locale === "de"
              ? `${occ.titleDe} an Orten in der Nähe`
              : `${occ.title} in nearby destinations`}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "pt"
              ? `Considere também estas localizações perto de ${locName}.`
              : locale === "de"
              ? `Schauen Sie sich auch diese Orte in der Nähe von ${locName} an.`
              : `Also consider these locations near ${locName}.`}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {nearby.slice(0, 4).map((nb) => {
              const nbName = locale === "de" && nb.name_de ? nb.name_de : nb.name;
              const nbDesc = locale === "pt" && nb.description_pt
                ? nb.description_pt
                : locale === "de" && nb.description_de
                ? nb.description_de
                : nb.description;
              return (
                <Link
                  key={nb.slug}
                  href={`/locations/${nb.slug}/${occasion}`}
                  className="group rounded-xl border border-warm-200 bg-white p-5 transition hover:border-primary-200 hover:shadow-md"
                >
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                    {occT} {locale === "pt" ? "em" : "in"} {nbName}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {nbDesc}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                    {locale === "pt" ? "Ver fotógrafos" : locale === "de" ? "Fotografen ansehen" : "View photographers"} &rarr;
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ from shoot type data */}
      {faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {locale === "pt"
              ? `Perguntas frequentes`
              : locale === "de"
              ? `Häufig gestellte Fragen`
              : `Frequently asked questions`}
          </h2>
          <div className="mt-4 space-y-3">
            {faqs.slice(0, 4).map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-warm-200 bg-warm-50"
              >
                <summary className="flex items-center justify-between px-5 py-4 font-semibold text-gray-900 cursor-pointer text-sm">
                  {faq.question}
                  <svg
                    className="h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-primary-50 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">
          {locale === "pt"
            ? `Pronto para reservar o seu ${occ.titlePt.toLowerCase()} em ${locName}?`
            : locale === "de"
            ? `Bereit, Ihren ${occ.titleDe} in ${locName} zu buchen?`
            : `Ready to book your ${occ.title.toLowerCase()} in ${locName}?`}
        </h2>
        <p className="mt-2 text-gray-600">
          {locale === "pt"
            ? "Navegue pelos portfólios, compare preços e reserve em minutos."
            : locale === "de"
            ? "Stöbern Sie in Portfolios, vergleichen Sie Preise und buchen Sie in wenigen Minuten."
            : "Browse portfolios, compare prices, and book in minutes."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/photographers?location=${slug}`}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {locale === "pt" ? "Ver Fotógrafos" : locale === "de" ? "Fotografen ansehen" : "Browse Photographers"}
          </Link>
          <Link
            href={`/locations/${slug}`}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-white"
          >
            {locale === "pt"
              ? `Explorar ${locName}`
              : locale === "de"
              ? `${locName} entdecken`
              : `Explore ${locName}`}
          </Link>
        </div>
      </div>
    </div>
  );
}
