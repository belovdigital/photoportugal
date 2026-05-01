import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { query, queryOne } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { localeAlternates } from "@/lib/seo";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { PackageCardWithCarousel } from "@/components/ui/PackageCardWithCarousel";
import { fetchBlogConversionAssets } from "@/lib/blog-conversion-assets";
import {
  BlogHeroCarousel,
  BlogPhotoStrip,
  BlogPhotographerBreakout,
  BlogReviewsCarousel,
  BlogStickyMobileBar,
} from "@/components/blog/BlogConversionBlocks";
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
    "SELECT id, slug, title, excerpt, meta_title, meta_description, cover_image_url, author, published_at, created_at FROM blog_posts WHERE slug = $1 AND is_published = TRUE AND locale = $2",
    [slug, locale]
  );

  if (!post) {
    // Try fallback locale (EN if not on EN, otherwise PT) for metadata
    const otherLocale = locale === "en" ? "pt" : "en";
    const otherPost = await queryOne<BlogPost>(
      "SELECT id, slug, title, excerpt, meta_title, meta_description, cover_image_url, author, published_at, created_at FROM blog_posts WHERE slug = $1 AND is_published = TRUE AND locale = $2",
      [slug, otherLocale]
    );
    if (otherPost) {
      return { title: otherPost.meta_title || otherPost.title, robots: { index: false } };
    }
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
  // Split into lines and process sequentially to handle multi-line structures
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Image: ![alt text](url)
    const imageMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      elements.push(
        <figure key={key++} className="my-8">
          <OptimizedImage
            src={imageMatch[2]}
            alt={imageMatch[1]}
            width={800}
            className="w-full rounded-xl"
          />
        </figure>
      );
      i++;
      continue;
    }

    // H2
    if (line.trim().startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mt-10 mb-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          {formatInline(line.trim().slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.trim().startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mt-8 mb-3 font-display text-xl font-bold text-gray-900">
          {formatInline(line.trim().slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-8 border-warm-200" />);
      i++;
      continue;
    }

    // Table: detect header row with pipes
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().startsWith("|") && /^\|[\s-:|]+\|$/.test(lines[i + 1].trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      // Parse header
      const headerCells = tableLines[0].split("|").filter(c => c.trim()).map(c => c.trim());
      // Skip separator (tableLines[1])
      // Parse body rows
      const bodyRows = tableLines.slice(2).map(row =>
        row.split("|").filter(c => c.trim() !== "" || c.includes(" ")).map(c => c.trim()).filter(Boolean)
      );

      elements.push(
        <div key={key++} className="my-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-warm-300">
                {headerCells.map((cell, ci) => (
                  <th key={ci} className="px-4 py-3 text-left font-semibold text-gray-900 bg-warm-50">
                    {formatInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b border-warm-200">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-gray-600">
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list: collect consecutive lines starting with -
    if (line.trim().startsWith("- ")) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-4 list-disc space-y-2 pl-6 text-gray-600">
          {listItems.map((item, j) => (
            <li key={j}>{formatInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list: collect consecutive lines starting with number.
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="my-4 list-decimal space-y-2 pl-6 text-gray-600">
          {listItems.map((item, j) => (
            <li key={j}>{formatInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.trim().startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <blockquote key={key++} className="my-6 border-l-4 border-primary-300 pl-4 text-gray-600 italic">
          {formatInline(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    // Paragraph: collect consecutive non-empty, non-special lines
    // Lines starting with ** are treated as separate paragraphs (e.g. "**Best for:** ...")
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("## ") &&
      !lines[i].trim().startsWith("### ") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("> ") &&
      !/^\d+\.\s/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim()) &&
      !lines[i].trim().match(/^!\[/) &&
      // Break paragraph if next line starts with bold (new semantic block)
      !(paraLines.length > 0 && lines[i].trim().startsWith("**"))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="my-4 text-gray-600 leading-relaxed">
          {formatInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return elements;
}

function renderContent(content: string) {
  if (isHtmlContent(content)) {
    return renderHtmlContent(content);
  }
  return renderMarkdownContent(content);
}

let _blogLocale = "en";
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
          {formatInline(boldMatch[1])}
        </strong>
      );
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (minIdx === linkIdx && linkMatch) {
      if (linkIdx > 0) parts.push(remaining.slice(0, linkIdx));
      const isInternal = linkMatch[2].startsWith("/");
      const href = isInternal && _blogLocale !== "en" ? `/${_blogLocale}${linkMatch[2]}` : linkMatch[2];
      parts.push(
        isInternal ? (
          <a key={key++} href={href} className="text-primary-600 underline transition hover:text-primary-700">
            {formatInline(linkMatch[1])}
          </a>
        ) : (
          <a key={key++} href={linkMatch[2]} className="text-primary-600 underline transition hover:text-primary-700" target="_blank" rel="noopener noreferrer">
            {formatInline(linkMatch[1])}
          </a>
        )
      );
      remaining = remaining.slice(linkIdx + linkMatch[0].length);
    } else if (italicMatch) {
      if (italicIdx > 0) parts.push(remaining.slice(0, italicIdx));
      parts.push(<em key={key++}>{formatInline(italicMatch[1])}</em>);
      remaining = remaining.slice(italicIdx + italicMatch[0].length);
    }
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  _blogLocale = locale;

  const t = await getTranslations("blogDetail");
  const tc = await getTranslations("common");

  const post = await queryOne<BlogPost>(
    "SELECT * FROM blog_posts WHERE slug = $1 AND is_published = TRUE AND locale = $2",
    [slug, locale]
  );

  if (!post) {
    // If not found in this locale, check fallback locale and redirect there
    const otherLocale = locale === "en" ? "pt" : "en";
    const otherPost = await queryOne<{ slug: string }>(
      "SELECT slug FROM blog_posts WHERE slug = $1 AND is_published = TRUE AND locale = $2",
      [slug, otherLocale]
    );
    if (otherPost) {
      redirect(otherLocale === "en" ? `/blog/${slug}` : `/${otherLocale}/blog/${slug}`);
    }
    notFound();
  }

  // Fetch related posts — prefer posts sharing locations/keywords, fallback to recent
  const allOtherPosts = await query<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    published_at: string;
    target_keywords: string | null;
    content: string;
  }>(
    "SELECT id, slug, title, excerpt, cover_image_url, published_at, target_keywords, content FROM blog_posts WHERE is_published = TRUE AND id != $1 AND locale = $2 ORDER BY published_at DESC",
    [post.id, locale]
  );

  // Score each post by relevance to current post
  const currentText = (post.title + " " + (post.target_keywords || "")).toLowerCase();
  const currentLocations = locations.filter(
    (loc) => currentText.includes(loc.name.toLowerCase()) || post.content.toLowerCase().includes(loc.name.toLowerCase())
  );
  const currentShootTypes = shootTypes.filter(
    (st) => currentText.includes(st.name.toLowerCase()) || currentText.includes(st.slug)
  );

  const scoredPosts = allOtherPosts.map((p) => {
    let score = 0;
    const pText = (p.title + " " + (p.target_keywords || "")).toLowerCase();

    // +3 for each shared location
    for (const loc of currentLocations) {
      if (pText.includes(loc.name.toLowerCase()) || p.content.toLowerCase().includes(loc.name.toLowerCase())) {
        score += 3;
      }
    }

    // +2 for each shared shoot type
    for (const st of currentShootTypes) {
      if (pText.includes(st.name.toLowerCase()) || pText.includes(st.slug)) {
        score += 2;
      }
    }

    // +1 for each shared keyword
    if (post.target_keywords && p.target_keywords) {
      const currentKws = post.target_keywords.toLowerCase().split(",").map(k => k.trim());
      const pKws = p.target_keywords.toLowerCase().split(",").map(k => k.trim());
      for (const kw of currentKws) {
        if (kw && pKws.some(pk => pk.includes(kw) || kw.includes(pk))) {
          score += 1;
        }
      }
    }

    return { ...p, score };
  });

  // Sort by score desc, then by date desc; pick top 3
  scoredPosts.sort((a, b) => b.score - a.score || new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  const relatedPosts = scoredPosts.slice(0, 3).map(({ score, target_keywords, content: _c, ...rest }) => rest);

  // Find locations mentioned in post title or content for internal linking
  const mentionedLocations = locations.filter(
    (loc) =>
      post.title.toLowerCase().includes(loc.name.toLowerCase()) ||
      post.content.toLowerCase().includes(loc.name.toLowerCase())
  ).slice(0, 4);

  // Find shoot types mentioned in post for internal linking
  const contentLower = (post.title + " " + post.content).toLowerCase();
  const mentionedShootTypes = shootTypes.filter(
    (st) => contentLower.includes(st.name.toLowerCase()) || contentLower.includes(st.slug)
  ).slice(0, 3);

  // Related photographers — converts blog readers to bookings far better
  // than another "browse all" CTA. Picks up to 3 photographers whose
  // coverage matches the locations and shoot types this post mentions,
  // ranked by how many tags overlap. One package per photographer (same
  // diversification rule we use on location/shoot-type pages) so the
  // grid shows three distinct people, not three packages from one star.
  const mentionedLocationSlugs = mentionedLocations.map((l) => l.slug);
  const mentionedShootTypeNames = mentionedShootTypes.map((s) => s.name);
  const relatedPackages = (mentionedLocationSlugs.length > 0 || mentionedShootTypeNames.length > 0)
    ? await query<{
        id: string; name: string; price: string; duration_minutes: number; num_photos: number;
        photographer_slug: string; photographer_name: string; photographer_avatar: string | null;
        rating: number; review_count: number; is_popular: boolean;
        portfolio_thumbs: string[];
      }>(
        `WITH per_photographer AS (
           SELECT pk.id, pk.name, pk.price::text AS price, pk.duration_minutes,
                  COALESCE(pk.num_photos, 0) as num_photos,
                  pp.id as profile_id,
                  pp.slug as photographer_slug, u.name as photographer_name,
                  u.avatar_url as photographer_avatar,
                  COALESCE(pp.rating, 0) as rating,
                  COALESCE(pp.review_count, 0) as review_count,
                  COALESCE(pk.is_popular, FALSE) as is_popular,
                  pp.is_featured, pp.is_verified,
                  -- Score by tag overlap so the most-relevant photographers
                  -- bubble up. Both signals count; either alone qualifies.
                  (
                    CASE WHEN $1::text[] = ARRAY[]::text[] THEN 0
                         ELSE (
                           SELECT COUNT(*) FROM photographer_locations plx
                            WHERE plx.photographer_id = pp.id
                              AND plx.location_slug = ANY($1::text[])
                         )::int * 2
                    END
                  ) +
                  (
                    CASE WHEN $2::text[] = ARRAY[]::text[] THEN 0
                         WHEN pp.shoot_types && $2::text[] THEN 3
                         ELSE 0
                    END
                  ) AS relevance,
                  ROW_NUMBER() OVER (
                    PARTITION BY pp.id
                    ORDER BY COALESCE(pk.is_popular, FALSE) DESC, pk.price ASC
                  ) as rn_per_photographer
             FROM packages pk
             JOIN photographer_profiles pp ON pp.id = pk.photographer_id
             JOIN users u ON u.id = pp.user_id
            WHERE pp.is_approved = TRUE
              AND COALESCE(pp.is_test, FALSE) = FALSE
              AND pk.is_public = TRUE
              AND (
                ($1::text[] = ARRAY[]::text[] AND $2::text[] = ARRAY[]::text[])
                OR EXISTS (
                  SELECT 1 FROM photographer_locations plx
                   WHERE plx.photographer_id = pp.id
                     AND ($1::text[] = ARRAY[]::text[] OR plx.location_slug = ANY($1::text[]))
                )
                OR ($2::text[] != ARRAY[]::text[] AND pp.shoot_types && $2::text[])
              )
         )
         SELECT id, name, price, duration_minutes, num_photos,
                photographer_slug, photographer_name, photographer_avatar,
                rating, review_count, is_popular,
                COALESCE((
                  SELECT array_agg(url ORDER BY shuffle, sort_order NULLS LAST, created_at)
                    FROM (
                      SELECT pi.url,
                             hashtext(pp.profile_id::text || pi.url) as shuffle,
                             pi.sort_order, pi.created_at
                        FROM portfolio_items pi
                       WHERE pi.photographer_id = pp.profile_id
                         AND pi.type = 'photo'
                       ORDER BY shuffle, pi.sort_order NULLS LAST, pi.created_at
                       LIMIT 5
                    ) ranked
                ), ARRAY[]::text[]) as portfolio_thumbs
           FROM per_photographer pp
          WHERE rn_per_photographer = 1
            AND relevance > 0
          ORDER BY relevance DESC,
                   pp.is_featured DESC, pp.is_verified DESC,
                   pp.review_count DESC NULLS LAST,
                   pp.rating DESC NULLS LAST
          LIMIT 3`,
        [mentionedLocationSlugs, mentionedShootTypeNames]
      ).catch(() => [])
    : [];

  // Dynamic hero photo from one of our photographers' portfolios. Replaces
  // generic AI / Unsplash covers with real work by a real human, plus
  // attribution that links to the photographer's profile — every blog
  // post becomes a portfolio surface. Hash-shuffled by post.id so the
  // same post always shows the same cover (predictable for sharing) but
  // different posts naturally rotate across photographers.
  // Falls back silently to cover_image_url if no match found.
  const heroPhoto = (mentionedLocationSlugs.length > 0 || mentionedShootTypeNames.length > 0)
    ? await queryOne<{ url: string; photographer_name: string; photographer_slug: string }>(
        `SELECT pi.url, u.name as photographer_name, pp.slug as photographer_slug,
                -- Lower rank = better match. 0 = both location+type tagged,
                -- 1 = location-tagged, 2 = shoot-type-tagged, 3 = photographer
                -- covers the mentioned location (even if this photo isn't
                -- tagged). Ensures the cover actually looks like the topic.
                CASE
                  WHEN $1::text[] != ARRAY[]::text[]
                       AND $2::text[] != ARRAY[]::text[]
                       AND pi.location_slug = ANY($1::text[])
                       AND pi.shoot_type = ANY($2::text[]) THEN 0
                  WHEN $1::text[] != ARRAY[]::text[]
                       AND pi.location_slug = ANY($1::text[]) THEN 1
                  WHEN $2::text[] != ARRAY[]::text[]
                       AND pi.shoot_type = ANY($2::text[]) THEN 2
                  ELSE 3
                END as match_rank
           FROM portfolio_items pi
           JOIN photographer_profiles pp ON pp.id = pi.photographer_id
           JOIN users u ON u.id = pp.user_id
          WHERE pp.is_approved = TRUE
            AND COALESCE(pp.is_test, FALSE) = FALSE
            AND pi.type = 'photo'
            -- When the post mentions a specific shoot type, accept a
            -- photo only if EITHER:
            --   a) the photo itself is tagged with a matching type, OR
            --   b) the photo is untagged AND the photographer's
            --      shoot_types specialty includes the matching type.
            -- A photographer who shoots couples/proposals will not
            -- have their NULL-tagged shots used for a solo post; a
            -- photographer who specialises in solo will, even if some
            -- individual photos aren't categorised.
            AND (
              $2::text[] = ARRAY[]::text[]
              OR pi.shoot_type = ANY($2::text[])
              OR (pi.shoot_type IS NULL AND pp.shoot_types && $2::text[])
            )
            AND (
              ($1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[]))
              OR ($2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]))
              OR EXISTS (
                SELECT 1 FROM photographer_locations plx
                 WHERE plx.photographer_id = pp.id
                   AND ($1::text[] != ARRAY[]::text[] AND plx.location_slug = ANY($1::text[]))
              )
            )
          ORDER BY match_rank, hashtext($3::text || pi.url)
          LIMIT 1`,
        [mentionedLocationSlugs, mentionedShootTypeNames, post.id]
      ).catch(() => null)
    : null;

  const heroSrc = heroPhoto?.url || post.cover_image_url;

  // ── Conversion assets (carousels, breakouts, reviews, end-cap) ─────────
  const conversion = await fetchBlogConversionAssets({
    postId: post.id,
    locationSlugs: mentionedLocationSlugs,
    shootTypeNames: mentionedShootTypeNames,
  });

  // Split content by H2 markdown so we can inject carousels between sections.
  // Intro = everything before the first ##; sections = each ## block.
  const _allParts = post.content.split(/(?=^## )/m);
  const introContent = _allParts[0] || "";
  const sectionContents = _allParts.slice(1);

  // Decide injection points. With ≥6 sections we sprinkle blocks at
  // 1/4, 2/4, 3/4. Shorter posts get fewer injections so we don't crowd.
  const totalSections = sectionContents.length;
  const inject1 = Math.max(1, Math.floor(totalSections * 0.25));
  const inject2 = Math.max(2, Math.floor(totalSections * 0.5));
  const inject3 = Math.max(3, Math.floor(totalSections * 0.75));

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

  // Extract FAQ from content (## headers that are questions + following paragraphs)
  const faqItems: { question: string; answer: string }[] = [];
  const faqRegex = /(?:^|\n)#{2,3}\s+([^\n]*\?)\s*\n+([\s\S]*?)(?=\n#{2,3}\s|\n*$)/g;
  let faqMatch;
  while ((faqMatch = faqRegex.exec(post.content)) !== null) {
    const question = faqMatch[1].replace(/\*\*/g, "").trim();
    const answer = faqMatch[2]
      .split("\n")
      .filter((l: string) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("!["))
      .map((l: string) => l.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
      .join(" ")
      .slice(0, 500);
    if (question && answer.length > 20) {
      faqItems.push({ question, answer });
    }
  }

  const faqJsonLd = faqItems.length >= 2 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  } : null;

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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <article>
        {/* Hero — prefer multi-photo carousel from one photographer
            (richer, swipeable) over the single-cover fallback. */}
        {conversion.heroCarousel && conversion.heroCarousel.thumbnails.length > 0 ? (
          <BlogHeroCarousel
            thumbnails={conversion.heroCarousel.thumbnails}
            photographerName={conversion.heroCarousel.photographerName}
            photographerSlug={conversion.heroCarousel.photographerSlug}
            fallbackTitle={post.title}
          />
        ) : heroSrc ? (
          <div className="relative h-[300px] sm:h-[400px] lg:h-[480px] w-full overflow-hidden bg-gray-900">
            <OptimizedImage
              src={heroSrc}
              alt={heroPhoto ? `Photo by ${heroPhoto.photographer_name}` : post.title}
              width={1200}
              priority
              className="h-full w-full opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {heroPhoto && (
              <Link
                href={`/photographers/${heroPhoto.photographer_slug}`}
                className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-xs font-medium text-white hover:bg-black/60 transition"
              >
                Photo by {heroPhoto.photographer_name} →
              </Link>
            )}
          </div>
        ) : null}

        {/* Content */}
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label={t("breadcrumb")} className="mb-6 text-sm text-gray-400">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li className="flex items-center gap-1.5">
                <Link href="/" className="hover:text-primary-600 transition">{tc("home")}</Link>
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <Link href="/blog" className="hover:text-primary-600 transition">{tc("blog")}</Link>
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <span className="text-gray-600">{post.title}</span>
              </li>
            </ol>
          </nav>

          {/* Title */}
          <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl leading-tight">
            {post.title}
          </h1>

          {/* Author & date — show "Updated {date}" badge when the post was
              meaningfully revised (>14 days after publish), not on
              first-day saves. Helps Google + readers see the post is
              fresh; suppresses the badge on never-edited posts where it
              would be misleading. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{post.author}</span>
            <span>&middot;</span>
            <time dateTime={post.published_at}>
              {publishedDate.toLocaleDateString(({pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR"} as Record<string, string>)[locale] || "en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            {post.updated_at && new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > 14 * 86400000 && (
              <>
                <span>&middot;</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t("lastUpdated", {
                    date: new Date(post.updated_at).toLocaleDateString(({pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR"} as Record<string, string>)[locale] || "en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }),
                  })}
                </span>
              </>
            )}
          </div>

          {/* Article body — split by ## sections so we can inject
              conversion blocks (photo strip, photographer breakouts,
              reviews carousel) between sections. Pure markdown chunks
              still go through the same renderContent. */}
          <div className="mt-8 text-base sm:text-lg">
            {renderContent(introContent)}

            {/* After intro: cross-photographer photo strip — visual
                statement that this isn't a generic blog, it's a working
                marketplace. */}
            {conversion.photoStrip.length > 0 && (
              <BlogPhotoStrip
                photos={conversion.photoStrip}
                heading={mentionedLocations.length > 0
                  ? `Real shots from ${mentionedLocations[0].name}`
                  : "Real shots from our photographers"}
              />
            )}

            {sectionContents.slice(0, inject1).map((s, i) => (
              <div key={`s1-${i}`}>{renderContent(s)}</div>
            ))}

            {/* Featured photographer #1 — full breakout with carousel +
                packages. Strong mid-article CTA without breaking flow.
                Label only claims "Featured in {location}" when truthful. */}
            {conversion.breakouts[0] && (
              <BlogPhotographerBreakout
                data={conversion.breakouts[0]}
                introLabel={mentionedLocations.length > 0 && conversion.breakouts[0].covers_mentioned_location
                  ? `Featured in ${mentionedLocations[0].name}`
                  : "Featured photographer"}
                bookCta="See all packages"
                popularLabel="Popular"
              />
            )}

            {sectionContents.slice(inject1, inject2).map((s, i) => (
              <div key={`s2-${i}`}>{renderContent(s)}</div>
            ))}

            {/* Reviews carousel from clients who shot this kind of
                session. Social proof exactly when the reader is
                considering booking. */}
            {conversion.reviews.length > 0 && (
              <BlogReviewsCarousel
                reviews={conversion.reviews}
                heading="What clients say about this kind of shoot"
              />
            )}

            {sectionContents.slice(inject2, inject3).map((s, i) => (
              <div key={`s3-${i}`}>{renderContent(s)}</div>
            ))}

            {/* Featured photographer #2 — different person, different
                style. Gives the reader a real choice without forcing
                them to scroll through the directory. */}
            {conversion.breakouts[1] && (
              <BlogPhotographerBreakout
                data={conversion.breakouts[1]}
                introLabel="Also worth booking"
                bookCta="See all packages"
                popularLabel="Popular"
              />
            )}

            {sectionContents.slice(inject3).map((s, i) => (
              <div key={`s4-${i}`}>{renderContent(s)}</div>
            ))}
          </div>

          {/* Inline CTA */}
          <div className="mt-10 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/50 to-warm-50 p-6 sm:p-8 text-center">
            <h3 className="font-display text-xl font-bold text-gray-900 sm:text-2xl">
              {mentionedLocations.length > 0
                ? t("blogCta.titleLocation", { location: mentionedLocations[0].name })
                : t("blogCta.title")}
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              {t("blogCta.description")}
            </p>
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={mentionedLocations.length > 0 ? `/photographers?location=${mentionedLocations[0].slug}` : "/photographers"}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-700"
              >
                {t("blogCta.browsePhotographers")}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/find-photographer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-primary-300 hover:shadow-md"
              >
                {t("blogCta.getMatched")}
              </Link>
            </div>
          </div>

          {/* End-cap package picker — up to 6 different photographers'
              top packages. Mobile: horizontal scroll-snap so swipe is
              the primary interaction. Desktop: 3-column grid that fills
              available width. */}
          {(conversion.endCapPackages.length > 0 || relatedPackages.length > 0) && (
            <div className="-mx-4 sm:-mx-6 mt-12 border-t border-warm-200 pt-10 px-4 sm:px-6">
              <h3 className="font-display text-2xl font-bold text-gray-900">
                {mentionedLocations.length > 0
                  ? t("relatedPhotographersInLocation", { location: mentionedLocations[0].name })
                  : t("relatedPhotographersGeneric")}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {t("relatedPhotographersSub")}
              </p>
              {/* Mobile: horizontal scroll-snap row */}
              <div className="mt-6 flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 lg:hidden -mx-4 px-4 sm:-mx-6 sm:px-6" style={{ scrollbarWidth: "none" }}>
                {(conversion.endCapPackages.length > 0 ? conversion.endCapPackages : relatedPackages).map((pkg) => (
                  <div key={pkg.id} className="shrink-0 snap-start" style={{ width: "min(85vw, 340px)" }}>
                    <PackageCardWithCarousel
                      pkg={pkg}
                      popularLabel={t("packagePopular")}
                      minutesAbbrLabel={t("packageMinutesAbbr")}
                      photosLabel={t("packagePhotos")}
                      bookCtaLabel={t("packageBookCta")}
                    />
                  </div>
                ))}
              </div>
              {/* Desktop: grid */}
              <div className="mt-6 hidden lg:grid grid-cols-3 gap-5">
                {(conversion.endCapPackages.length > 0 ? conversion.endCapPackages : relatedPackages).slice(0, 6).map((pkg) => (
                  <PackageCardWithCarousel
                    key={pkg.id}
                    pkg={pkg}
                    popularLabel={t("packagePopular")}
                    minutesAbbrLabel={t("packageMinutesAbbr")}
                    photosLabel={t("packagePhotos")}
                    bookCtaLabel={t("packageBookCta")}
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* Related Shoot Types — internal links based on shoot type mentions */}
          {mentionedShootTypes.length > 0 && (
            <div className={`${mentionedLocations.length > 0 ? "mt-6" : "mt-12 border-t border-warm-200 pt-8"}`}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Related Photoshoots
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {mentionedShootTypes.map((st) => (
                  <Link
                    key={st.slug}
                    href={`/photoshoots/${st.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700 transition hover:bg-accent-100 hover:border-accent-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {st.name} Photography
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
                      {new Date(related.published_at).toLocaleDateString(({pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR"} as Record<string, string>)[locale] || "en-US", {
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

      {/* Sticky mobile bottom bar — appears after 15% scroll, shows
          live count of photographers matching the post topic. Mobile
          only; desktop has the inline breakouts and end-cap grid. */}
      {(conversion.endCapPackages.length > 0 || conversion.breakouts.length > 0) && (
        <BlogStickyMobileBar
          count={Math.max(conversion.endCapPackages.length, conversion.breakouts.length, relatedPackages.length)}
          primaryHref={mentionedLocations.length > 0
            ? `/photographers?location=${mentionedLocations[0].slug}`
            : "/photographers"}
          primaryLabel="Browse"
          contextLabel={mentionedLocations.length > 0
            ? `in ${mentionedLocations[0].name} ready to shoot`
            : "ready to book"}
        />
      )}
    </>
  );
}
