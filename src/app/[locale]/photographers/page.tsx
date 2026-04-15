import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations } from "@/lib/locations-data";
import { SHOOT_TYPES, PhotographerProfile } from "@/types";
import { PhotographerCatalog } from "./PhotographerCatalog";
import { query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("photographersMeta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/photographers", locale),
    openGraph: { title: t("title"), description: t("description"), url: `https://photoportugal.com${locale === "pt" ? "/pt" : ""}/photographers` },
  };
}

async function getDbPhotographers(): Promise<PhotographerProfile[]> {
  try {
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
    }>(
      `SELECT p.id, p.slug, u.name, p.tagline, p.bio,
              u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
              p.experience_years, p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
              p.plan, p.rating, p.review_count, p.session_count, u.last_seen_at::text, p.avg_response_minutes
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_approved = TRUE
       ORDER BY p.is_featured DESC, RANDOM()`
    );

    if (profiles.length === 0) return [];

    // Get locations for all photographers
    const allLocRows = await query<{ photographer_id: string; location_slug: string }>(
      "SELECT photographer_id, location_slug FROM photographer_locations"
    );

    // Get packages for all photographers
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
      "SELECT id, photographer_id, name, description, duration_minutes, num_photos, price, is_popular FROM packages ORDER BY sort_order, price"
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
        created_at: "",
        last_seen_at: p.last_seen_at,
        avg_response_minutes: p.avg_response_minutes,
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

  const { location: initialLocation, shoot, shootType } = await searchParams;
  const initialShootType = shoot || shootType;
  const dbPhotographers = await getDbPhotographers();
  const resolvedShootType = resolveShootType(initialShootType);

  const base = "https://photoportugal.com";
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Professional Photographers in Portugal",
    numberOfItems: dbPhotographers.length,
    itemListElement: dbPhotographers.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${base}/photographers/${p.slug}`,
      name: p.name,
    })),
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
    <PhotographerCatalog
      key={`${initialLocation || ""}_${resolvedShootType || ""}`}
      photographers={dbPhotographers}
      locations={locations}
      shootTypes={SHOOT_TYPES as unknown as string[]}
      initialLocation={initialLocation}
      initialShootType={resolvedShootType}
    />
    </>
  );
}
