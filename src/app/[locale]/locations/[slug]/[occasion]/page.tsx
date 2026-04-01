import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLocationBySlug, locations } from "@/lib/locations-data";
import { localeAlternates } from "@/lib/seo";
import { query, queryOne } from "@/lib/db";
import { Avatar } from "@/components/ui/Avatar";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { normalizeName } from "@/lib/format-name";

export const revalidate = 86400;

const OCCASIONS: Record<string, { title: string; titlePt: string; description: string; descriptionPt: string; emoji: string }> = {
  proposal: {
    title: "Proposal Photographer",
    titlePt: "Fotógrafo de Pedido de Casamento",
    description: "Capture your surprise proposal with a professional photographer who will discreetly document every moment of this life-changing event.",
    descriptionPt: "Capture o seu pedido de casamento surpresa com um fotógrafo profissional que documentará discretamente cada momento deste evento.",
    emoji: "💍",
  },
  honeymoon: {
    title: "Honeymoon Photographer",
    titlePt: "Fotógrafo de Lua de Mel",
    description: "Celebrate your honeymoon with stunning professional photos at the most romantic spots. Natural, candid moments that tell your love story.",
    descriptionPt: "Celebre a sua lua de mel com fotos profissionais deslumbrantes nos locais mais românticos.",
    emoji: "🥂",
  },
  couples: {
    title: "Couples Photographer",
    titlePt: "Fotógrafo de Casais",
    description: "Professional couples photography for vacations, anniversaries, and romantic getaways. Relaxed, natural sessions that capture real connection.",
    descriptionPt: "Fotografia profissional de casais para férias, aniversários e escapadelas românticas.",
    emoji: "❤️",
  },
  family: {
    title: "Family Photographer",
    titlePt: "Fotógrafo de Família",
    description: "Kid-friendly family photoshoots with experienced photographers who know how to keep everyone relaxed and capture genuine moments.",
    descriptionPt: "Sessões fotográficas familiares com fotógrafos experientes que sabem captar momentos genuínos.",
    emoji: "👨‍👩‍👧‍👦",
  },
  solo: {
    title: "Solo Travel Photographer",
    titlePt: "Fotógrafo para Viajantes Solo",
    description: "Professional portraits for solo travelers. Get amazing photos of yourself at iconic locations — no more selfies or asking strangers.",
    descriptionPt: "Retratos profissionais para viajantes solo. Fotos incríveis em locais icónicos.",
    emoji: "🧳",
  },
  engagement: {
    title: "Engagement Photographer",
    titlePt: "Fotógrafo de Noivado",
    description: "Pre-wedding engagement photoshoots at stunning locations. Perfect for save-the-dates, announcements, or simply celebrating your engagement.",
    descriptionPt: "Sessões fotográficas de noivado em locais deslumbrantes.",
    emoji: "💑",
  },
  elopement: {
    title: "Elopement Photographer",
    titlePt: "Fotógrafo de Elopement",
    description: "Intimate elopement photography for couples choosing to celebrate their love privately in one of the most beautiful countries in Europe.",
    descriptionPt: "Fotografia íntima de elopement para casais que escolhem celebrar o seu amor em privado.",
    emoji: "🌿",
  },
};

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

  const title = locale === "pt"
    ? `${occ.titlePt} em ${location.name}, Portugal`
    : `${occ.title} in ${location.name}, Portugal`;
  const description = locale === "pt"
    ? `${occ.descriptionPt} Reserve o seu ${occ.titlePt.toLowerCase()} em ${location.name}.`
    : `${occ.description} Book your ${occ.title.toLowerCase()} in ${location.name}.`;

  return {
    title,
    description,
    alternates: localeAlternates(`/locations/${slug}/${occasion}`, locale),
    openGraph: { title, description },
  };
}

export default async function OccasionPage({ params }: { params: Promise<{ locale: string; slug: string; occasion: string }> }) {
  const { locale, slug, occasion } = await params;
  setRequestLocale(locale);

  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) notFound();

  // Get photographers at this location
  let photographers: { slug: string; name: string; avatar_url: string | null; rating: number; review_count: number; starting_price: number | null }[] = [];
  try {
    photographers = await query<{ slug: string; name: string; avatar_url: string | null; rating: number; review_count: number; starting_price: number | null }>(
      `SELECT pp.slug, u.name, u.avatar_url, pp.rating, pp.review_count,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id) as starting_price
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND pp.id IN (
         SELECT photographer_id FROM photographer_locations WHERE location_slug = $1
       )
       ORDER BY RANDOM() LIMIT 8`,
      [slug]
    );
  } catch {}

  const title = locale === "pt"
    ? `${occ.titlePt} em ${location.name}`
    : `${occ.title} in ${location.name}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${occ.title} in ${location.name}, Portugal`,
    description: occ.description,
    url: `https://photoportugal.com/locations/${slug}/${occasion}`,
    provider: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
    areaServed: {
      "@type": "Place",
      name: `${location.name}, Portugal`,
    },
    ...(photographers.length > 0 && photographers[0].starting_price ? {
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: String(photographers[0].starting_price),
        availability: "https://schema.org/InStock",
      },
    } : {}),
  };

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Locations", href: "/locations" },
    { name: location.name, href: `/locations/${slug}` },
    { name: locale === "pt" ? occ.titlePt : occ.title, href: `/locations/${slug}/${occasion}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-6">
        <span className="text-4xl">{occ.emoji}</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-lg text-gray-600 leading-relaxed max-w-2xl">
          {locale === "pt" ? occ.descriptionPt : occ.description}
        </p>
      </div>

      {/* Photographers */}
      {photographers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {locale === "pt"
              ? `Fotógrafos disponíveis em ${location.name}`
              : `Available photographers in ${location.name}`}
          </h2>
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
                    {p.rating > 0 && <span className="text-amber-500">★ {p.rating.toFixed(1)}</span>}
                    {p.review_count > 0 && <span>({p.review_count} reviews)</span>}
                  </div>
                  {p.starting_price && (
                    <p className="mt-0.5 text-sm font-medium text-gray-700">From &euro;{Math.round(Number(p.starting_price))}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Other occasions in this location */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-gray-900">
          {locale === "pt"
            ? `Outras ocasiões em ${location.name}`
            : `Other occasions in ${location.name}`}
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
                {locale === "pt" ? occ.titlePt : occ.title}
              </Link>
            ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-primary-50 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">
          {locale === "pt"
            ? `Pronto para reservar o seu ${occ.titlePt.toLowerCase()} em ${location.name}?`
            : `Ready to book your ${occ.title.toLowerCase()} in ${location.name}?`}
        </h2>
        <p className="mt-2 text-gray-600">
          {locale === "pt"
            ? "Navegue pelos portfólios, compare preços e reserve em minutos."
            : "Browse portfolios, compare prices, and book in minutes."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/photographers?location=${slug}`}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {locale === "pt" ? "Ver Fotógrafos" : "Browse Photographers"}
          </Link>
          <Link
            href={`/locations/${slug}`}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-white"
          >
            {locale === "pt" ? `Explorar ${location.name}` : `Explore ${location.name}`}
          </Link>
        </div>
      </div>
    </div>
  );
}
