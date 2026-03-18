import type { Metadata } from "next";
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travel Photography Blog",
  description:
    "Tips, guides, and inspiration for your Portugal vacation photoshoot. Discover the best locations, poses, and planning advice from professional photographers.",
  alternates: { canonical: "https://photoportugal.com/blog" },
  openGraph: {
    title: "Travel Photography Blog | Photo Portugal",
    description:
      "Tips, guides, and inspiration for your Portugal vacation photoshoot.",
    url: "https://photoportugal.com/blog",
    type: "website",
  },
};

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author: string;
  published_at: string;
}

export default async function BlogPage() {
  let posts: BlogPost[] = [];
  try {
    posts = await query<BlogPost>(
      "SELECT id, slug, title, excerpt, cover_image_url, author, published_at FROM blog_posts WHERE is_published = TRUE ORDER BY published_at DESC"
    );
  } catch (e) {
    console.error("[blog] Failed to fetch posts:", e);
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://photoportugal.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://photoportugal.com/blog",
      },
    ],
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
            <Link href="/" className="hover:text-primary-600 transition">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-600">Blog</span>
          </nav>
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            Travel Photography Blog
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-500">
            Tips, guides, and inspiration for capturing your perfect moments in
            Portugal. From the best photo spots to planning your dream photoshoot.
          </p>
        </div>
      </section>

      {/* Posts grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lg text-gray-400">No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="group overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:shadow-lg">
                <Link href={`/blog/${post.slug}`}>
                  {post.cover_image_url ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
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
                      {new Date(post.published_at).toLocaleDateString("en-US", {
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
                    Read more
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
