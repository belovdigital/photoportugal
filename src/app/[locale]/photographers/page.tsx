import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations } from "@/lib/locations-data";
import { SHOOT_TYPES, PhotographerProfile } from "@/types";
import { PhotographerCatalog } from "./PhotographerCatalog";
import { getOneLinerQuotesForPhotographers } from "@/lib/reviews-data";
import { query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";
import { resolveAbsoluteImageUrl } from "@/lib/image-url";
import { getCoverageNodeSlugsByPhotographerIds } from "@/lib/photographer-location-coverage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("photographersMeta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/photographers", locale),
    openGraph: { title: t("title"), description: t("description"), url: `https://photoportugal.com${locale === "en" ? "" : "/" + locale}/photographers`, images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Photo Portugal" }] },
  };
}

// Locales that have translation columns on photographer_profiles + packages.
const TRANSLATABLE_LOCALES = new Set(["pt", "de", "es", "fr"]);

async function getDbPhotographers(locale?: string): Promise<PhotographerProfile[]> {
  try {
    const useLoc = locale && TRANSLATABLE_LOCALES.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(p.tagline_${useLoc}, p.tagline)` : "p.tagline";
    const bioSql = useLoc ? `COALESCE(p.bio_${useLoc}, p.bio)` : "p.bio";
    const profiles = await query<{
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      bio: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      cover_position_y: number;
      languages: string[];
      shoot_types: string[];
      experience_years: number;
      is_verified: boolean;
      is_featured: boolean;
      is_founding: boolean;
      plan: string;
      rating: number;
      review_count: number;
      session_count: number;
      last_seen_at: string | null;
      avg_response_minutes: number | null;
      created_at: string;
      portfolio_thumbs: string[] | null;
    }>(
      `SELECT p.id, p.slug, u.name,
              ${taglineSql} as tagline,
              ${bioSql} as bio,
              u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
              COALESCE(CASE WHEN p.career_start_year IS NOT NULL THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT - p.career_start_year + 1 END, p.experience_years) as experience_years,
              p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
              p.plan, p.rating, p.review_count, p.session_count, u.last_seen_at::text, p.avg_response_minutes,
              COALESCE(p.created_at, u.created_at)::text as created_at,
              ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = p.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 7) as portfolio_thumbs
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_approved = TRUE
       ORDER BY p.is_featured DESC, p.is_verified DESC, RANDOM()`
    );

    if (profiles.length === 0) return [];
    const coverageByPhotographer = await getCoverageNodeSlugsByPhotographerIds(profiles.map((profile) => profile.id));

    // Get locations for all photographers
    const allLocRows = await query<{ photographer_id: string; location_slug: string }>(
      "SELECT photographer_id, location_slug FROM photographer_locations"
    );

    // Get packages for all photographers
    const pkgNameSql = useLoc ? `COALESCE(name_${useLoc}, name)` : "name";
    const pkgDescSql = useLoc ? `COALESCE(description_${useLoc}, description)` : "description";
    const allPkgs = await query<{
      id: string;
      photographer_id: string;
      name: string;
      description: string | null;
      duration_minutes: number;
      num_photos: number;
      price: number;
      is_popular: boolean;
    }>(
      `SELECT id, photographer_id, ${pkgNameSql} as name, ${pkgDescSql} as description,
              duration_minutes, num_photos, price, is_popular
       FROM packages ORDER BY sort_order, price`
    );

    return profiles.map((p) => {
      const locSlugs = allLocRows
        .filter((r) => r.photographer_id === p.id)
        .map((r) => r.location_slug);
      const locs = locSlugs
        .map((s) => locations.find((l) => l.slug === s))
        .filter((l): l is (typeof locations)[number] => l !== undefined);
      const pkgs = allPkgs
        .filter((pkg) => pkg.photographer_id === p.id)
        .map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || "",
          duration_minutes: pkg.duration_minutes,
          num_photos: pkg.num_photos,
          price: pkg.price,
          is_popular: pkg.is_popular,
        }));

      return {
        id: p.id,
        user_id: "",
        slug: p.slug,
        name: p.name,
        tagline: p.tagline || "",
        bio: p.bio || "",
        avatar_url: p.avatar_url,
        cover_url: p.cover_url,
        cover_position_y: p.cover_position_y ?? 50,
        languages: p.languages || [],
        hourly_rate: 0,
        currency: "EUR",
        locations: locs,
        coverage_nodes: coverageByPhotographer[p.id] || [],
        packages: pkgs,
        shoot_types: p.shoot_types || [],
        experience_years: p.experience_years,
        is_verified: p.is_verified,
        is_featured: p.is_featured,
        is_founding: p.is_founding,
        plan: p.plan,
        rating: Number(p.rating),
        review_count: p.review_count,
        session_count: p.session_count,
        created_at: p.created_at,
        last_seen_at: p.last_seen_at,
        avg_response_minutes: p.avg_response_minutes,
        portfolio_thumbs: p.portfolio_thumbs,
      } as PhotographerProfile;
    });
  } catch (error) {
    console.error("[photographers] DB error:", error);
    return [];
  }
}

// Map shoot type slug (from location pages) or display name (from header) to canonical display name
function resolveShootType(param?: string): string | undefined {
  if (!param) return undefined;
  // Exact match (from header links: "Couples", "Solo Portrait")
  const exact = (SHOOT_TYPES as readonly string[]).find((t) => t === param);
  if (exact) return exact;
  // Slug match (from location pages: "couples", "solo", "content-creator")
  const slugMatch = (SHOOT_TYPES as readonly string[]).find(
    (t) => t.toLowerCase().replace(/\s+/g, "-") === param.toLowerCase()
  );
  if (slugMatch) return slugMatch;
  // Partial/prefix match (e.g. "solo" → "Solo Portrait")
  const partial = (SHOOT_TYPES as readonly string[]).find(
    (t) => t.toLowerCase().startsWith(param.toLowerCase())
  );
  return partial;
}

export default async function PhotographersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ location?: string; shoot?: string; shootType?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tMeta = await getTranslations("photographersMeta");

  const { location: initialLocation, shoot, shootType } = await searchParams;
  const initialShootType = shoot || shootType;
  const dbPhotographers = await getDbPhotographers(locale);
  const quotes = await getOneLinerQuotesForPhotographers(dbPhotographers.map((p) => p.id), locale);
  const resolvedShootType = resolveShootType(initialShootType);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const base = "https://photoportugal.com";
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Professional Photographers in Portugal",
    numberOfItems: dbPhotographers.length,
    itemListElement: dbPhotographers.slice(0, 20).map((p, i) => {
      const imgSrc = p.cover_url || p.avatar_url;
      const image = resolveAbsoluteImageUrl(imgSrc, base);
      return {
        "@type": "ListItem",
        position: i + 1,
        url: `${base}/photographers/${p.slug}`,
        name: p.name,
        ...(image ? { image } : {}),
      };
    }),
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
    <PhotographerCatalog
      key={`${initialLocation || ""}_${resolvedShootType || ""}`}
      photographers={dbPhotographers}
      quotes={quotes}
      locations={locations}
      shootTypes={SHOOT_TYPES as unknown as string[]}
      initialLocation={initialLocation}
      initialShootType={resolvedShootType}
    />

    {/* Browse by city — internal linking + SEO for /photographers/location/* */}
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
        {tMeta("browseByCity")}
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        {tMeta("browseByCitySub")}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {locations.map((loc) => (
          <a
            key={loc.slug}
            href={`${localePrefix}/photographers/location/${loc.slug}`}
            className="rounded-lg border border-warm-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:bg-warm-50"
          >
            {(loc as unknown as Record<string, string>)[`name_${locale}`] || loc.name}
          </a>
        ))}
      </div>
    </section>
    </>
  );
}
