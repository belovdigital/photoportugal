// Per-package landing page — primarily for SEO. Each photographer's
// package gets its own URL `/photographers/<slug>/<package-slug>` with a
// rich, image-first layout. Schema.org Product JSON-LD (whitelisted by
// Google for review snippets) carries the photographer's aggregate
// rating + reviews so the listing earns stars in SERP.

import { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { queryOne, query } from "@/lib/db";
import { getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";
import { getTranslations, getLocale } from "next-intl/server";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Avatar } from "@/components/ui/Avatar";
import { LARGE_GROUP_SURCHARGE_RATE, SERVICE_FEE_RATE } from "@/lib/stripe";
import { inferPackageTags, locationDisplayName } from "@/lib/package-photo-matching";
import { PackageHeroCarousel } from "./PackageHeroCarousel";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  num_photos: number;
  price: number;
  delivery_days: number;
  is_popular: boolean;
  is_group_package: boolean;
  features: string[];
  photographer_id: string;
}

interface PhotographerRow {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  bio: string | null;
  rating: number;
  review_count: number;
  languages: string[];
  shoot_types: string[];
  is_approved: boolean;
}

const LOCALES = ["en", "pt", "de", "es", "fr"] as const;
type Loc = (typeof LOCALES)[number];

function locField(loc: Loc, base: string): string {
  return loc === "en" ? base : `COALESCE(${base}_${loc}, ${base})`;
}

async function loadPackage(slug: string, packageSlug: string, locale: Loc) {
  const photographer = await queryOne<PhotographerRow>(
    `SELECT pp.id, pp.user_id, u.name as display_name, u.avatar_url, pp.cover_url,
            ${locField(locale, "pp.tagline")} as tagline,
            ${locField(locale, "pp.bio")} as bio,
            COALESCE(pp.rating, 5)::float as rating,
            COALESCE(pp.review_count, 0) as review_count,
            COALESCE(pp.languages, '{}') as languages,
            COALESCE(pp.shoot_types, '{}') as shoot_types,
            COALESCE(pp.is_approved, FALSE) as is_approved
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.slug = $1`,
    [slug]
  );
  if (!photographer || !photographer.is_approved) return null;

  const pkg = await queryOne<PackageRow>(
    `SELECT id, ${locField(locale, "name")} as name, ${locField(locale, "description")} as description,
            duration_minutes, num_photos, price,
            COALESCE(delivery_days, 7) as delivery_days,
            COALESCE(is_popular, FALSE) as is_popular,
            COALESCE(is_group_package, FALSE) as is_group_package,
            COALESCE(features, '{}') as features,
            photographer_id
     FROM packages
     WHERE photographer_id = $1 AND slug = $2 AND is_public = TRUE AND custom_for_user_id IS NULL`,
    [photographer.id, packageSlug]
  );
  if (!pkg) return null;

  // Portfolio photos (up to 24) — RANKED by relevance to the package.
  // We extract canonical shoot-type buckets and location slugs from the
  // package name + description, then score each portfolio photo:
  //   +100 when its shoot_type matches a bucket
  //    +50 when its location_slug matches one of the package locations
  // Photos with no metadata still appear (score 0) but are pushed below
  // metadata-matched ones. 80%+ of photos in production have at least
  // one tag filled, so this typically lifts the right vibe to the top.
  const tags = inferPackageTags(pkg.name, pkg.description);
  const shootKeywords = tags.shootTypeKeywords; // e.g. ["couples", "engagement"]
  const locSlugs = tags.locationSlugs;          // e.g. ["lisbon", "cascais"]
  const portfolioRaw = await query<{ url: string; thumbnail_url: string | null; caption: string | null; width: number | null; height: number | null }>(
    `SELECT url, thumbnail_url, caption, width, height,
            (CASE WHEN shoot_type IS NOT NULL AND LOWER(shoot_type) = ANY($3::text[]) THEN 100 ELSE 0 END) +
            (CASE WHEN location_slug IS NOT NULL AND location_slug = ANY($4::text[]) THEN 50 ELSE 0 END) as score
     FROM portfolio_items
     WHERE photographer_id = $1 AND type = 'photo'
     ORDER BY score DESC, hashtext($2 || url), sort_order NULLS LAST, created_at
     LIMIT 24`,
    [photographer.id, pkg.id, shootKeywords, locSlugs]
  );
  const portfolio = await Promise.all(portfolioRaw.map(async (p) => ({
    url: isS3Path(p.url) ? await getPresignedUrl(s3KeyFromPath(p.url), 3600) : p.url,
    thumbnail_url: p.thumbnail_url && isS3Path(p.thumbnail_url) ? await getPresignedUrl(s3KeyFromPath(p.thumbnail_url), 3600) : p.thumbnail_url,
    caption: p.caption,
    width: p.width,
    height: p.height,
  })));

  // Locations the photographer covers — drives the "Where" section
  // and the hero subtitle (e.g. "in Lisbon, Sintra & Cascais").
  // Fallback display names go through `locationDisplayName` so satellite
  // slugs not in the `locations` table (caparica, ericeira, ...) still
  // render with proper capitalisation rather than as a raw lowercase
  // slug.
  const locationsRaw = await query<{ slug: string; name: string | null }>(
    `SELECT pl.location_slug as slug, l.name
     FROM photographer_locations pl
     LEFT JOIN locations l ON l.slug = pl.location_slug
     WHERE pl.photographer_id = $1
     LIMIT 8`,
    [photographer.id]
  );
  const locations = locationsRaw.map((r) => ({
    slug: r.slug,
    name: r.name || locationDisplayName(r.slug),
  }));

  // Top reviews (4-5 with text) for inline display + schema.
  const reviews = await query<{ id: string; rating: number; title: string | null; text: string | null; client_name: string | null; created_at: string }>(
    `SELECT r.id, r.rating, ${locField(locale, "r.title")} as title, ${locField(locale, "r.text")} as text,
            COALESCE(r.client_name_override, u.name) as client_name, r.created_at
     FROM reviews r
     LEFT JOIN users u ON u.id = r.client_id
     WHERE r.photographer_id = $1 AND COALESCE(r.is_approved, TRUE) = TRUE AND r.text IS NOT NULL AND length(r.text) > 60
     ORDER BY r.created_at DESC
     LIMIT 6`,
    [photographer.id]
  );

  // Other packages from this photographer — for cross-sell at the bottom.
  const otherPackages = await query<{ slug: string | null; name: string; price: number; duration_minutes: number; num_photos: number; preview_url: string | null }>(
    `SELECT slug, ${locField(locale, "name")} as name, price, duration_minutes, num_photos,
            (SELECT pi.url FROM portfolio_items pi
              WHERE pi.photographer_id = packages.photographer_id AND pi.type = 'photo'
              ORDER BY hashtext(packages.id::text || pi.url), pi.sort_order NULLS LAST, pi.created_at
              LIMIT 1) as preview_url
     FROM packages
     WHERE photographer_id = $1 AND id != $2 AND is_public = TRUE AND custom_for_user_id IS NULL
     ORDER BY is_popular DESC, sort_order, price
     LIMIT 4`,
    [photographer.id, pkg.id]
  );

  return { photographer, pkg, portfolio, locations, reviews, otherPackages };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; package: string; locale: string }> }): Promise<Metadata> {
  const { slug, package: pkgSlug, locale } = await params;
  const loc: Loc = (LOCALES as readonly string[]).includes(locale) ? (locale as Loc) : "en";
  const data = await loadPackage(slug, pkgSlug, loc);
  if (!data) return { title: "Package not found" };

  const { pkg, photographer, locations, portfolio } = data;
  const where = locations.slice(0, 2).map((l) => l.name).filter(Boolean).join(" & ") || "Portugal";
  const title = `${pkg.name} by ${photographer.display_name} in ${where} — €${Math.round(Number(pkg.price))} | Photo Portugal`;
  const description = pkg.description
    ? pkg.description.slice(0, 160).replace(/\s+/g, " ").trim()
    : `Book ${pkg.name} (${pkg.duration_minutes} min · ${pkg.num_photos} photos) with ${photographer.display_name} in ${where}. From €${Math.round(Number(pkg.price))}.`;
  const ogImage = portfolio[0]?.url || photographer.cover_url || photographer.avatar_url || "https://photoportugal.com/og-image.png";
  const ogImageAbs = ogImage.startsWith("http") ? ogImage : `https://photoportugal.com${ogImage}`;

  const canonical = `https://photoportugal.com/photographers/${slug}/${pkgSlug}`;
  const altLangs: Record<string, string> = {};
  for (const l of LOCALES) {
    altLangs[l === "en" ? "x-default" : l] = l === "en" ? canonical : `https://photoportugal.com/${l}/photographers/${slug}/${pkgSlug}`;
  }

  return {
    title,
    description,
    alternates: { canonical, languages: altLangs },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: ogImageAbs, width: 1200, height: 630, alt: `${pkg.name} — ${photographer.display_name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageAbs],
    },
  };
}

export default async function PackagePage({ params }: { params: Promise<{ slug: string; package: string; locale: string }> }) {
  const { slug, package: pkgSlug, locale } = await params;
  const loc: Loc = (LOCALES as readonly string[]).includes(locale) ? (locale as Loc) : "en";
  const data = await loadPackage(slug, pkgSlug, loc);
  if (!data) {
    permanentRedirect(`/photographers/${slug}`);
  }
  const { pkg, photographer, portfolio, locations, reviews, otherPackages } = data!;
  const t = await getTranslations({ locale: loc, namespace: "packagePage" }).catch(() => null);
  const T = (k: string, fb: string, vars: Record<string, string | number> = {}) =>
    (t ? t(k as never, vars as never) : Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), fb));

  const heroPhotos = portfolio.slice(0, 8).map((p) => ({ url: p.url, alt: p.caption || `${pkg.name} — ${photographer.display_name}` }));
  const galleryPhotos = portfolio.slice(0, 12);
  const where = locations.slice(0, 3).map((l) => l.name).filter(Boolean).join(" · ");
  // Two-decimal display to match Stripe (which always shows cents).
  // Stale integer rendering caused "Pay €248" vs Stripe page "€247.50" gap.
  const totalPriceRaw = Number(pkg.price) * (1 + SERVICE_FEE_RATE);
  const totalPrice = totalPriceRaw.toFixed(2);
  const ratingNum = Number(photographer.rating || 5);

  // ─── Schema.org Product JSON-LD ───────────────────────────────────────
  // Product is on Google's whitelist for review snippets, so this is what
  // gives our package SERP entries star ratings. Image array, offers,
  // aggregateRating, and inlined review array all conform to spec.
  const canonical = `https://photoportugal.com/photographers/${slug}/${pkgSlug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pkg.name,
    description: pkg.description || `${pkg.name} by ${photographer.display_name}`,
    url: canonical,
    image: portfolio.slice(0, 6).map((p) => (p.url.startsWith("http") ? p.url : `https://photoportugal.com${p.url}`)),
    // "brand" must be a Brand or Organization, not Person — Search Console
    // flagged the Person variant as "Invalid object type for field brand".
    brand: { "@type": "Brand", name: photographer.display_name },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(Math.round(Number(pkg.price))),
      availability: "https://schema.org/InStock",
      url: `https://photoportugal.com/book/${slug}?package=${pkg.id}`,
      seller: { "@type": "Person", name: photographer.display_name },
      // Google's Merchant-listings parser sees any priced Offer as a
      // potential product listing and demands these fields. We're a
      // photography SERVICE — digital delivery, no shipping, refund
      // only via the cancellation window (>=24h before shoot).
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "PT",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 1,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "EUR" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "PT" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
        },
      },
    },
    ...(photographer.review_count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: ratingNum.toFixed(1),
        reviewCount: String(photographer.review_count),
        bestRating: "5",
        worstRating: "1",
      },
    }),
    ...(reviews.length > 0 && {
      review: reviews.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.client_name || "Verified traveler" },
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        ...(r.text ? { reviewBody: r.text } : {}),
        ...(r.title ? { name: r.title } : {}),
        datePublished: new Date(r.created_at).toISOString().split("T")[0],
      })),
    }),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://photoportugal.com/" },
      { "@type": "ListItem", position: 2, name: "Photographers", item: "https://photoportugal.com/photographers" },
      { "@type": "ListItem", position: 3, name: photographer.display_name, item: `https://photoportugal.com/photographers/${slug}` },
      { "@type": "ListItem", position: 4, name: pkg.name, item: canonical },
    ],
  };

  const imageGalleryJsonLd = portfolio.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${pkg.name} — Sample Photos`,
    image: portfolio.slice(0, 12).map((p) => ({
      "@type": "ImageObject",
      contentUrl: p.url.startsWith("http") ? p.url : `https://photoportugal.com${p.url}`,
      ...(p.thumbnail_url ? { thumbnailUrl: p.thumbnail_url } : {}),
      ...(p.caption ? { caption: p.caption } : {}),
      creator: { "@type": "Person", name: photographer.display_name },
      copyrightHolder: { "@type": "Person", name: photographer.display_name },
      copyrightNotice: `© ${new Date().getFullYear()} ${photographer.display_name} — All rights reserved`,
      creditText: `${photographer.display_name} — Photo Portugal`,
      license: "https://photoportugal.com/terms",
      acquireLicensePage: canonical,
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {imageGalleryJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGalleryJsonLd) }} />
      )}

      {/* Hero — swipeable carousel covers above the fold, with the package
          name + photographer + price overlay. On mobile takes ~80% of
          viewport height to maximise the visual punch. */}
      <PackageHeroCarousel photos={heroPhotos.length ? heroPhotos : [{ url: photographer.cover_url || photographer.avatar_url || "/og-image.png", alt: pkg.name }]}>
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-10 pt-24 sm:px-10 sm:pb-14 sm:pt-32">
          <div className="mx-auto max-w-5xl">
            {pkg.is_popular && (
              <span className="mb-3 inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                {T("mostPopular", "Most Popular")}
              </span>
            )}
            <h1 className="font-display text-3xl font-bold text-white drop-shadow-md sm:text-5xl md:text-6xl">{pkg.name}</h1>
            <p className="mt-2 text-base text-white/90 sm:text-lg">
              {T("byPhotographerInLocation", "by {photographer}{locText}", { photographer: photographer.display_name, locText: where ? ` · ${where}` : "" })}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm">
                <span className="text-2xl font-bold text-gray-900 sm:text-3xl">€{Math.round(Number(pkg.price))}</span>
                <span className="ml-1.5 text-sm text-gray-500">{T("plusFee", "+ {rate}% fee", { rate: SERVICE_FEE_RATE * 100 })}</span>
              </div>
              <Link
                href={`/book/${slug}?package=${pkg.id}` as never}
                className="rounded-2xl bg-primary-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-primary-700 sm:text-lg"
              >
                {T("bookNow", "Book this session")}
              </Link>
            </div>
          </div>
        </div>
      </PackageHeroCarousel>

      {/* Meta-strip: photo count, duration, location, rating */}
      <section className="border-y border-warm-200 bg-warm-50 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-sm text-gray-700 sm:gap-x-10">
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <strong>{pkg.num_photos}</strong> {T("photos", "photos")}
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <strong>{pkg.duration_minutes < 60 ? `${pkg.duration_minutes} min` : `${pkg.duration_minutes / 60}h`}</strong>
          </span>
          {where && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {where}
            </span>
          )}
          {photographer.review_count > 0 && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <strong>{ratingNum.toFixed(1)}</strong>
              <span className="text-gray-400">· {photographer.review_count} {photographer.review_count === 1 ? T("review", "review") : T("reviews", "reviews")}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-gray-500">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {T("deliveryDays", "Delivered in {days} days", { days: pkg.delivery_days })}
          </span>
        </div>
      </section>

      {/* Description + features */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {T("aboutThisSession", "About this session")}
            </h2>
            {pkg.description ? (
              <div className="mt-4 whitespace-pre-line text-base leading-relaxed text-gray-700">
                {pkg.description}
              </div>
            ) : (
              <p className="mt-4 text-base leading-relaxed text-gray-700">
                {T("descFallback", "A {duration} session with {photographer}, capturing {photos} polished, edited photos delivered within {days} days.", { duration: pkg.duration_minutes < 60 ? `${pkg.duration_minutes}-minute` : `${pkg.duration_minutes / 60}-hour`, photographer: photographer.display_name, photos: pkg.num_photos, days: pkg.delivery_days })}
              </p>
            )}

            {pkg.features && pkg.features.length > 0 && (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {pkg.features.filter((f) => f.trim()).map((f, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-warm-200 bg-warm-50 p-4">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
            )}

            {pkg.is_group_package && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">{T("groupOptimised", "Optimised for large groups (9+ people)")}</p>
                <p className="mt-1 text-xs text-amber-800/90">
                  {T("groupOptimisedDesc", "This package is purpose-built for large families and groups — the price already accounts for the extra coordination and editing time, so no surcharge applies.")}
                </p>
              </div>
            )}
            {!pkg.is_group_package && (
              <p className="mt-6 text-xs text-gray-400">
                {T("groupNote", "Bookings of 9+ people incur a {pct}% large-group surcharge to cover the extra coordination time.", { pct: LARGE_GROUP_SURCHARGE_RATE * 100 })}
              </p>
            )}
          </div>

          {/* Sticky photographer card on desktop */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <Link href={`/photographers/${slug}` as never} className="flex items-center gap-3 group">
                <Avatar src={photographer.avatar_url} fallback={photographer.display_name} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-primary-600">{photographer.display_name}</p>
                  {photographer.review_count > 0 && (
                    <p className="text-xs text-gray-500">★ {ratingNum.toFixed(1)} · {photographer.review_count} {photographer.review_count === 1 ? T("review", "review") : T("reviews", "reviews")}</p>
                  )}
                </div>
              </Link>
              {photographer.tagline && (
                <p className="mt-4 text-sm text-gray-600 line-clamp-3">{photographer.tagline}</p>
              )}
              {photographer.languages && photographer.languages.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {photographer.languages.map((l) => (
                    <span key={l} className="rounded-full bg-warm-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">{l}</span>
                  ))}
                </div>
              )}
              <Link
                href={`/book/${slug}?package=${pkg.id}` as never}
                className="mt-5 block w-full rounded-xl bg-primary-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-primary-700"
              >
                {T("bookNow", "Book this session")} — €{totalPrice}
              </Link>
              <p className="mt-2 text-center text-[11px] text-gray-400">{T("noPaymentNow", "No payment now — pay only after the photographer confirms")}</p>
            </div>
          </aside>
        </div>
      </section>

      {/* Sample portfolio grid */}
      {galleryPhotos.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {T("samplePortfolio", "Sample work from {photographer}", { photographer: photographer.display_name })}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              {T("samplePortfolioDesc", "A taste of {photographer}'s style across recent shoots. Your final delivery will be edited with the same care.", { photographer: photographer.display_name })}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {galleryPhotos.map((p, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl bg-warm-100">
                  <OptimizedImage src={p.url} alt={p.caption || `${pkg.name} — sample ${i + 1}`} width={600} className="h-full w-full object-cover transition duration-700 hover:scale-105" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            {T("reviewsHeading", "What clients say about {photographer}", { photographer: photographer.display_name })}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-2xl border border-warm-200 bg-white p-5">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {r.title && <p className="mt-3 text-sm font-semibold text-gray-900">{r.title}</p>}
                {r.text && (
                  <p className="mt-1 line-clamp-6 text-sm text-gray-600">
                    {r.text.length > 240 ? r.text.slice(0, 240).replace(/\s\S*$/, "") + "…" : r.text}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">— {r.client_name || T("privateClient", "Verified traveler")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Other packages from this photographer */}
      {otherPackages.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {T("otherPackagesHeading", "More sessions with {photographer}", { photographer: photographer.display_name })}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              {T("otherPackagesSubtitle", "Other ways to work with {photographer} — pick what fits your story best.", { photographer: photographer.display_name })}
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {otherPackages.map((op) => (
                <Link
                  key={op.slug || op.name}
                  href={(op.slug ? `/photographers/${slug}/${op.slug}` : `/photographers/${slug}`) as never}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-warm-200 bg-white transition-shadow hover:shadow-xl"
                >
                  {op.preview_url && (
                    <div className="aspect-[16/10] overflow-hidden bg-warm-100">
                      <OptimizedImage
                        src={op.preview_url}
                        alt={op.name}
                        width={800}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-xl font-bold text-gray-900 line-clamp-1 sm:text-2xl">{op.name}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {op.duration_minutes < 60 ? `${op.duration_minutes} min` : `${op.duration_minutes / 60}h`}
                      </span>
                      <span className="text-warm-300">·</span>
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {op.num_photos} {T("photos", "photos")}
                      </span>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400">{T("from", "From")}</p>
                        <p className="font-display text-3xl font-bold text-gray-900">€{Math.round(Number(op.price))}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-primary-600">
                        {T("viewDetails", "View details")}
                        <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mobile sticky bottom CTA. Pads for the iPhone home-indicator
          via env(safe-area-inset-bottom) so the button never sits flush
          with the screen edge on devices with a gesture bar. */}
      <div
        className="sticky bottom-0 z-20 border-t border-warm-200 bg-white/95 px-4 pt-3 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.06)] lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{T("totalIncl", "Total incl. fee")}</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">€{totalPrice}</p>
          </div>
          <Link
            href={`/book/${slug}?package=${pkg.id}` as never}
            className="min-h-[48px] flex items-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-700"
          >
            {T("bookNow", "Book this session")}
          </Link>
        </div>
      </div>

      {/* Final breadcrumb-style nav back */}
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">
        <Link href={`/photographers/${slug}` as never} className="hover:text-primary-600">
          ← {T("backToPhotographer", "Back to {photographer}'s profile", { photographer: photographer.display_name })}
        </Link>
      </div>
    </>
  );
}
