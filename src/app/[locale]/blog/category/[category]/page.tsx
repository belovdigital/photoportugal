import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 300;

const CATEGORY_SLUGS = [
  "locations", "pricing", "elopements", "weddings", "couples",
  "family", "planning", "proposals", "solo", "comparisons",
] as const;

interface PageProps {
  params: Promise<{ locale: string; category: string }>;
}

export async function generateStaticParams() {
  return CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, category } = await params;
  setRequestLocale(locale);

  if (!CATEGORY_SLUGS.includes(category as typeof CATEGORY_SLUGS[number])) return { title: "Category Not Found" };

  const tCat = await getTranslations({ locale, namespace: "blogCategories" });
  const label = tCat(category as typeof CATEGORY_SLUGS[number]);
  const description = tCat(`${category}Desc` as any);
  const title = `${label} — Portugal Photography Blog`;

  return {
    title,
    description,
    alternates: localeAlternates(`/blog/category/${category}`, locale),
    openGraph: {
      title,
      description,
      url: `https://photoportugal.com/blog/category/${category}`,
      type: "website",
    },
  };
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author: string;
  published_at: string;
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { locale, category } = await params;
  setRequestLocale(locale);

  if (!CATEGORY_SLUGS.includes(category as typeof CATEGORY_SLUGS[number])) notFound();

  const t = await getTranslations("blog");
  const tc = await getTranslations("common");
  const tCat = await getTranslations("blogCategories");

  let posts: BlogPost[] = [];
  try {
    posts = await query<BlogPost>(
      "SELECT id, slug, title, excerpt, cover_image_url, author, published_at FROM blog_posts WHERE is_published = TRUE AND category = $1 AND (locale = $2) ORDER BY published_at DESC",
      [category, locale]
    );
  } catch (e) {
    console.error("[blog/category] Failed to fetch posts:", e);
  }

  const catLabel = tCat(category as typeof CATEGORY_SLUGS[number]);
  const catDescription = tCat(`${category}Desc` as any);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: catLabel,
    description: catDescription,
    url: `https://photoportugal.com${locale === "en" ? "" : "/" + locale}/blog/category/${category}`,
    isPartOf: {
      "@type": "Blog",
      name: "Photo Portugal Blog",
      url: "https://photoportugal.com/blog",
    },
    ...(posts.length > 0 && {
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: posts.length,
        itemListElement: posts.map((post, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://photoportugal.com${locale === "en" ? "" : "/" + locale}/blog/${post.slug}`,
          name: post.title,
        })),
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <section className="border-b border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <nav className="mb-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-primary-600 transition">{tc("home")}</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-primary-600 transition">{tc("blog")}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-600">{catLabel}</span>
          </nav>
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {catLabel}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-500">
            {catDescription}
          </p>

          {/* Category pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/blog"
              className="px-3 py-1.5 rounded-full text-xs font-medium transition bg-warm-100 text-gray-500 hover:bg-warm-200"
            >
              {tCat("all")}
            </Link>
            {CATEGORY_SLUGS.map((slug) => (
              <Link
                key={slug}
                href={`/blog/category/${slug}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  slug === category
                    ? "bg-primary-500 text-white shadow-sm"
                    : "bg-warm-100 text-gray-500 hover:bg-warm-200"
                }`}
              >
                {tCat(slug)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Posts grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lg text-gray-400">{t("noPosts")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="group overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:shadow-lg">
                <Link href={`/blog/${post.slug}`}>
                  {post.cover_image_url ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <OptimizedImage
                        src={post.cover_image_url}
                        alt={post.title}
                        width={400}
                        className="h-full w-full transition group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-warm-100">
                      <svg className="h-12 w-12 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </Link>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{post.author}</span>
                    <span>&middot;</span>
                    <time dateTime={post.published_at}>
                      {new Date(post.published_at).toLocaleDateString(({pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR"} as Record<string, string>)[locale] || "en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <Link href={`/blog/${post.slug}`}>
                    <h2 className="mt-2 font-display text-xl font-bold text-gray-900 transition group-hover:text-primary-600">
                      {post.title}
                    </h2>
                  </Link>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-gray-500">
                      {post.excerpt}
                    </p>
                  )}
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-4 inline-flex items-center text-sm font-semibold text-primary-600 transition hover:text-primary-700"
                  >
                    {t("readMore")}
                    <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
