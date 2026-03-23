import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { query, queryOne } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { localeAlternates } from "@/lib/seo";
import { locations } from "@/lib/locations-data";
import sanitize from "sanitize-html";

export const revalidate = 300; // ISR: refresh every 5 minutes

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  target_keywords: string | null;
  author: string;
  published_at: string;
  updated_at: string | null;
  created_at: string;
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  const post = await queryOne<BlogPost>(
    "SELECT id, slug, title, excerpt, meta_title, meta_description, cover_image_url, author, published_at, created_at FROM blog_posts WHERE slug = $1 AND is_published = TRUE",
    [slug]
  );

  if (!post) {
    return { title: "Post Not Found" };
  }

  const pageTitle = post.meta_title || post.title;
  const pageDescription = post.meta_description || post.excerpt || `Read "${post.title}" on the Photo Portugal blog.`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: localeAlternates(`/blog/${post.slug}`, locale),
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `https://photoportugal.com/blog/${post.slug}`,
      type: "article",
      publishedTime: post.published_at,
      authors: [post.author],
      ...(post.cover_image_url && {
        images: [
          {
            url: post.cover_image_url.startsWith("http")
              ? post.cover_image_url
              : `https://photoportugal.com${post.cover_image_url}`,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
    },
  };
}

function isHtmlContent(content: string): boolean {
  // Detect if content is HTML by checking for common block-level HTML tags
  return /^<(h[1-6]|p|div|section|article|figure|ul|ol|blockquote|table|hr|img)\b/im.test(
    content.trim()
  );
}

function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: [
      "p", "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "img", "ul", "ol", "li", "strong", "em",
      "blockquote", "br", "hr",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      div: ["class"],
      span: ["class"],
      p: ["class"],
      h1: ["class"],
      h2: ["class"],
      h3: ["class"],
      h4: ["class"],
      h5: ["class"],
      h6: ["class"],
      blockquote: ["class"],
      table: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
  });
}

function renderHtmlContent(content: string) {
  return (
    <div
      className="blog-html-content"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
    />
  );
}

function renderMarkdownContent(content: string) {
  const blocks = content.split(/\n\n+/);

  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Image: ![alt text](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      return (
        <figure key={i} className="my-8">
          <OptimizedImage
            src={imageMatch[2]}
            alt={imageMatch[1]}
            width={800}
            className="w-full rounded-xl"
          />
        </figure>
      );
    }

    // H2
    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={i}
          className="mt-10 mb-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl"
        >
          {formatInline(trimmed.slice(3))}
        </h2>
      );
    }

    // H3
    if (trimmed.startsWith("### ")) {
      return (
        <h3
          key={i}
          className="mt-8 mb-3 font-display text-xl font-bold text-gray-900"
        >
          {formatInline(trimmed.slice(4))}
        </h3>
      );
    }

    // List
    const lines = trimmed.split("\n");
    if (lines.every((l) => l.trim().startsWith("- "))) {
      return (
        <ul key={i} className="my-4 list-disc space-y-1 pl-6 text-gray-600">
          {lines.map((line, j) => (
            <li key={j}>{formatInline(line.trim().slice(2))}</li>
          ))}
        </ul>
      );
    }

    // Paragraph
    return (
      <p key={i} className="my-4 text-gray-600 leading-relaxed">
        {formatInline(trimmed)}
      </p>
    );
  });
}

function renderContent(content: string) {
  if (isHtmlContent(content)) {
    return renderHtmlContent(content);
  }
  return renderMarkdownContent(content);
}

function formatInline(text: string): React.ReactNode {
  // Process bold, italic, and link markers
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    const boldIdx = boldMatch?.index ?? Infinity;
    const italicIdx = italicMatch?.index ?? Infinity;
    const linkIdx = linkMatch?.index ?? Infinity;

    const minIdx = Math.min(boldIdx, italicIdx, linkIdx);

    if (minIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    if (minIdx === boldIdx && boldMatch) {
      if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx));
      parts.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (minIdx === linkIdx && linkMatch) {
      if (linkIdx > 0) parts.push(remaining.slice(0, linkIdx));
      parts.push(
        <a key={key++} href={linkMatch[2]} className="text-primary-600 underline transition hover:text-primary-700">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkIdx + linkMatch[0].length);
    } else if (italicMatch) {
      if (italicIdx > 0) parts.push(remaining.slice(0, italicIdx));
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicIdx + italicMatch[0].length);
    }
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("blogDetail");
  const tc = await getTranslations("common");

  const post = await queryOne<BlogPost>(
    "SELECT * FROM blog_posts WHERE slug = $1 AND is_published = TRUE",
    [slug]
  );

  if (!post) {
    notFound();
  }

  // Fetch related posts (other published posts, exclude current)
  const relatedPosts = await query<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    published_at: string;
  }>(
    "SELECT id, slug, title, excerpt, cover_image_url, published_at FROM blog_posts WHERE is_published = TRUE AND id != $1 ORDER BY published_at DESC LIMIT 3",
    [post.id]
  );

  // Find locations mentioned in post title or content for internal linking
  const mentionedLocations = locations.filter(
    (loc) =>
      post.title.toLowerCase().includes(loc.name.toLowerCase()) ||
      post.content.toLowerCase().includes(loc.name.toLowerCase())
  ).slice(0, 4);

  const publishedDate = new Date(post.published_at);

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
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://photoportugal.com/blog/${post.slug}`,
      },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description || post.excerpt || "",
    author: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Photo Portugal",
      logo: {
        "@type": "ImageObject",
        url: "https://photoportugal.com/logo.svg",
      },
    },
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://photoportugal.com/blog/${post.slug}`,
    },
    ...(post.cover_image_url && {
      image: post.cover_image_url.startsWith("http")
        ? post.cover_image_url
        : `https://photoportugal.com${post.cover_image_url}`,
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article>
        {/* Cover image hero */}
        {post.cover_image_url && (
          <div className="relative h-[300px] sm:h-[400px] lg:h-[480px] w-full overflow-hidden bg-gray-900">
            <OptimizedImage
              src={post.cover_image_url}
              alt={post.title}
              width={1200}
              priority
              className="h-full w-full opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-primary-600 transition">{tc("home")}</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-primary-600 transition">{tc("blog")}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-600">{post.title}</span>
          </nav>

          {/* Title */}
          <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl leading-tight">
            {post.title}
          </h1>

          {/* Author & date */}
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{post.author}</span>
            <span>&middot;</span>
            <time dateTime={post.published_at}>
              {publishedDate.toLocaleDateString(locale === "pt" ? "pt-PT" : "en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>

          {/* Article body */}
          <div className="mt-8 text-base sm:text-lg">
            {renderContent(post.content)}
          </div>

          {/* Related Locations — internal links based on location mentions */}
          {mentionedLocations.length > 0 && (
            <div className="mt-12 border-t border-warm-200 pt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                {t("relatedLocations")}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {mentionedLocations.map((loc) => (
                  <Link
                    key={loc.slug}
                    href={`/locations/${loc.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 hover:border-primary-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {loc.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* CTA */}
      <section className="border-t border-warm-200 bg-primary-50">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("readyToBook")}
          </h2>
          <p className="mt-3 text-gray-600">
            {t("readyToBookSubtitle")}
          </p>
          <Link
            href="/photographers"
            className="mt-6 inline-flex rounded-lg bg-primary-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {t("findAPhotographer")}
          </Link>
        </div>
      </section>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900">
              {t("moreFromBlog")}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="group overflow-hidden rounded-xl border border-warm-200 transition hover:shadow-lg"
                >
                  {related.cover_image_url ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <OptimizedImage
                        src={related.cover_image_url}
                        alt={related.title}
                        width={400}
                        className="h-full w-full transition group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-warm-100">
                      <svg className="h-10 w-10 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-xs text-gray-400">
                      {new Date(related.published_at).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-gray-900 transition group-hover:text-primary-600">
                      {related.title}
                    </h3>
                    {related.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{related.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
