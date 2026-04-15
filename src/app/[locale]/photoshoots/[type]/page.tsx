import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shootTypes, getShootTypeBySlug } from "@/lib/shoot-types-data";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

export function generateStaticParams() {
  return shootTypes.map((t) => ({ type: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}): Promise<Metadata> {
  const { locale, type } = await params;
  const shootType = getShootTypeBySlug(type);
  if (!shootType) return {};

  return {
    title: shootType.title,
    description: shootType.metaDescription,
    alternates: localeAlternates(`/photoshoots/${type}`, locale),
    openGraph: {
      title: shootType.title,
      description: shootType.metaDescription,
      type: "website",
      url: `https://photoportugal.com/photoshoots/${type}`,
    },
  };
}

export default async function ShootTypePage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, type } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("shootTypesPage");
  const tc = await getTranslations("common");

  const shootType = getShootTypeBySlug(type);

  if (!shootType) {
    notFound();
  }

  // Fetch related blog posts mentioning this shoot type
  const relatedPosts = await query<{
    slug: string; title: string; excerpt: string | null; cover_image_url: string | null;
  }>(
    `SELECT slug, title, excerpt, cover_image_url FROM blog_posts
     WHERE is_published = TRUE AND (
       LOWER(title) LIKE $1 OR LOWER(content) LIKE $1 OR LOWER(title) LIKE $2 OR LOWER(content) LIKE $2
     ) ORDER BY published_at DESC LIMIT 4`,
    [`%${shootType.slug}%`, `%${shootType.name.toLowerCase()}%`]
  ).catch(() => []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: shootType.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("photoshoots"), href: "/photoshoots" },
          { name: shootType.name, href: `/photoshoots/${type}` },
        ]}
      />

      {/* Hero */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {shootType.h1}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            {shootType.heroText}
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/photographers?shootType=${shootType.slug}`}
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              {t("findPhotographers", { name: shootType.name })}
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-primary-200 px-8 py-4 text-base font-semibold text-primary-600 transition hover:bg-primary-50"
            >
              {t("howItWorks")}
            </Link>
          </div>
        </div>
      </section>

      {/* Best Locations */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          {t("bestLocationsTitle", { name: shootType.name })}
        </h2>
        <p className="mt-4 max-w-3xl text-gray-500">
          {t("bestLocationsSubtitle", { name: shootType.name.toLowerCase() })}
        </p>
        <div className={`mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 ${
          shootType.bestLocations.length <= 2 ? "lg:grid-cols-2" :
          shootType.bestLocations.length === 4 ? "lg:grid-cols-2" :
          shootType.bestLocations.length === 3 ? "lg:grid-cols-3" :
          "lg:grid-cols-3"
        }`}>
          {shootType.bestLocations.map((loc) => {
            const location = locations.find((l) => l.slug === loc.slug);
            if (!location) return null;
            return <LocationCard key={loc.slug} location={location} locale={locale} />;
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative overflow-hidden border-y border-warm-200 bg-warm-50">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-primary-100/30 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-accent-100/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            {t("howToBookTitle", { name: shootType.name })}
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {[
              {
                title: t("stepBrowse"),
                desc: t("stepBrowseDesc", { name: shootType.name.toLowerCase() }),
                iconBg: "bg-primary-500",
                numberBg: "bg-primary-100 text-primary-700",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
              },
              {
                title: t("stepChoose"),
                desc: t("stepChooseDesc"),
                iconBg: "bg-accent-500",
                numberBg: "bg-accent-50 text-accent-700",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
              },
              {
                title: t("stepBook"),
                desc: t("stepBookDesc"),
                iconBg: "bg-yellow-500",
                numberBg: "bg-yellow-50 text-yellow-700",
                icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></>,
              },
              {
                title: t("stepGetPhotos"),
                desc: t("stepGetPhotosDesc"),
                iconBg: "bg-blue-500",
                numberBg: "bg-blue-50 text-blue-700",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
              },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center lg:px-6">
                {i < 3 && (
                  <div className="absolute left-[calc(50%+32px)] right-[calc(-50%+32px)] top-6 hidden border-t-2 border-dashed border-warm-300 lg:block" />
                )}
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-xl ${item.iconBg} shadow-lg`}>
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {item.icon}
                  </svg>
                </div>
                <span className={`mt-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${item.numberBg}`}>
                  {i + 1}
                </span>
                <h3 className="mt-2 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          {t("faqTitle", { name: shootType.name })}
        </h2>
        <div className="mt-8 space-y-4">
          {shootType.faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-warm-200 bg-white"
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
      </section>

      {/* Related Blog Posts */}
      {relatedPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {shootType.name} Photography Guides
          </h2>
          <p className="mt-3 text-gray-500">Tips and inspiration for your {shootType.name.toLowerCase()} photoshoot in Portugal</p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:shadow-md"
              >
                {post.cover_image_url && (
                  <div className="aspect-[16/10] overflow-hidden">
                    <OptimizedImage
                      src={post.cover_image_url}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">{post.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white">
            {t("ctaReadyTitle", { name: shootType.name })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            {t("ctaReadySubtitle", { name: shootType.name.toLowerCase() })}
          </p>
          <Link
            href={`/photographers?shootType=${shootType.slug}`}
            className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
          >
            {t("findPhotographers", { name: shootType.name })}
          </Link>
        </div>
      </section>
    </>
  );
}
