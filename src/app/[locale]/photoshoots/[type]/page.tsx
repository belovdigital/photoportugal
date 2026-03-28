import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shootTypes, getShootTypeBySlug } from "@/lib/shoot-types-data";
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
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shootType.bestLocations.map((loc) => (
            <Link
              key={loc.slug}
              href={`/locations/${loc.slug}`}
              className="group rounded-xl border border-warm-200 bg-white p-6 transition hover:border-primary-200 hover:shadow-md"
            >
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition">
                {loc.name}
              </h3>
              <p className="mt-2 text-sm text-gray-500">{loc.reason}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                {t("viewPhotographers", { name: loc.name })}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900">
            {t("howToBookTitle", { name: shootType.name })}
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-4">
            {[
              {
                step: "1",
                title: t("stepBrowse"),
                desc: t("stepBrowseDesc", { name: shootType.name.toLowerCase() }),
              },
              {
                step: "2",
                title: t("stepChoose"),
                desc: t("stepChooseDesc"),
              },
              {
                step: "3",
                title: t("stepBook"),
                desc: t("stepBookDesc"),
              },
              {
                step: "4",
                title: t("stepGetPhotos"),
                desc: t("stepGetPhotosDesc"),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                  {item.step}
                </div>
                <h3 className="mt-3 text-sm font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
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
