import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { query, queryOne } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { localeAlternates } from "@/lib/seo";

const POSTS_PER_PAGE = 48;

export const revalidate = 300; // ISR: refresh every 5 minutes

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");

  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/blog", locale),
    openGraph: {
      title: t("title"),
      description: t("subtitle"),
      url: `https://photoportugal.com${locale === "pt" ? "/pt" : ""}/blog`,
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

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("blog");
  const tc = await getTranslations("common");
  const tCat = await getTranslations("blogCategories");

  const currentPage: number = 1;
  const offset = 0;

  let posts: BlogPost[] = [];
  let totalCount = 0;
  try {
    const countRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM blog_posts WHERE is_published = TRUE AND (locale = $1)",
      [locale]
    );
    totalCount = parseInt(countRow?.count || "0");

    posts = await query<BlogPost>(
      "SELECT id, slug, title, excerpt, cover_image_url, author, published_at FROM blog_posts WHERE is_published = TRUE AND (locale = $1) ORDER BY published_at DESC LIMIT $2 OFFSET $3",
      [locale, POSTS_PER_PAGE, offset]
    );
  } catch (e) {
    console.error("[blog] Failed to fetch posts:", e);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / POSTS_PER_PAGE));

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: tc("home"),
        item: "https://photoportugal.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: tc("blog"),
        item: "https://photoportugal.com/blog",
      },
    ],
  };

  // Generate page numbers to display (with ellipsis logic)
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Hero */}
      <section className="border-b border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <nav className="mb-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-primary-600 transition">{tc("home")}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-600">{tc("blog")}</span>
          </nav>
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-500">
            {t("subtitle")}
          </p>

          {/* Category filter pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary-500 text-white shadow-sm">
              {tCat("all")}
            </span>
            {["locations", "pricing", "elopements", "weddings", "couples", "family", "planning", "proposals", "solo", "comparisons"].map((slug) => (
              <Link
                key={slug}
                href={`/blog/category/${slug}`}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition bg-warm-100 text-gray-500 hover:bg-warm-200"
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
          <>
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
                        {new Date(post.published_at).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-US", {
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

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-1" aria-label={t("blogPagination")}>
                {/* Previous */}
                {currentPage > 1 ? (
                  <Link
                    href={currentPage === 2 ? "/blog" : `/blog/page/${currentPage - 1}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:border-primary-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-warm-100 bg-warm-50 px-4 py-2 text-sm font-medium text-gray-300 cursor-not-allowed">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </span>
                )}

                {/* Page numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {getPageNumbers().map((page, idx) =>
                    page === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-gray-400">
                        ...
                      </span>
                    ) : page === currentPage ? (
                      <span
                        key={page}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-sm font-semibold text-white"
                      >
                        {page}
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={page === 1 ? "/blog" : `/blog/page/${page}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-warm-200 bg-white text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:border-primary-200"
                      >
                        {page}
                      </Link>
                    )
                  )}
                </div>

                {/* Mobile page indicator */}
                <span className="sm:hidden px-3 py-2 text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>

                {/* Next */}
                {currentPage < totalPages ? (
                  <Link
                    href={`/blog/page/${currentPage + 1}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:border-primary-200"
                  >
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-warm-100 bg-warm-50 px-4 py-2 text-sm font-medium text-gray-300 cursor-not-allowed">
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}
