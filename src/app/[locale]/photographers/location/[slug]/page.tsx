import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { locations } from "@/lib/locations-data";
import { SHOOT_TYPES, PhotographerProfile } from "@/types";
import { PhotographerCatalog } from "../../PhotographerCatalog";
import { query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { locField } from "@/lib/locations-data";

export async function generateStaticParams() {
  return locations.map((loc) => ({ slug: loc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const location = locations.find((l) => l.slug === slug);
  if (!location) return {};

  const t = await getTranslations({ locale, namespace: "photographersMeta" });
  const localizedName = locField(location, "name", locale) || location.name;
  const title = t("locationTitle", { location: localizedName });
  const description = t("locationDescription", { location: localizedName });
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  return {
    title,
    description,
    alternates: localeAlternates(`/photographers/location/${slug}`, locale),
    openGraph: {
      title,
      description,
      url: `https://photoportugal.com${localePrefix}/photographers/location/${slug}`,
      images: [{ url: location.cover_image || "/og-image.png", width: 1200, height: 630, alt: t("ogAlt", { location: localizedName }) }],
    },
  };
}

async function getDbPhotographers(): Promise<PhotographerProfile[]> {
  try {
    const profiles = await query<{
      id: string; slug: string; name: string; tagline: string | null; bio: string | null;
      avatar_url: string | null; cover_url: string | null; cover_position_y: number;
      languages: string[]; shoot_types: string[]; experience_years: number;
      is_verified: boolean; is_featured: boolean; is_founding: boolean; plan: string;
      rating: number; review_count: number; session_count: number;
    }>(
      `SELECT p.id, p.slug, u.name, p.tagline, p.bio,
              u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
              COALESCE(CASE WHEN p.career_start_year IS NOT NULL THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT - p.career_start_year + 1 END, p.experience_years) as experience_years,
              p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
              p.plan, p.rating, p.review_count, p.session_count
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_approved = TRUE
       ORDER BY p.is_featured DESC, RANDOM()`
    );

    if (profiles.length === 0) return [];

    const allLocRows = await query<{ photographer_id: string; location_slug: string }>(
      "SELECT photographer_id, location_slug FROM photographer_locations"
    );
    const allPkgs = await query<{
      id: string; photographer_id: string; name: string; description: string | null;
      duration_minutes: number; num_photos: number; price: number; is_popular: boolean;
    }>(
      "SELECT id, photographer_id, name, description, duration_minutes, num_photos, price, is_popular FROM packages ORDER BY sort_order, price"
    );

    return profiles.map((p) => {
      const locSlugs = allLocRows.filter((r) => r.photographer_id === p.id).map((r) => r.location_slug);
      const locs = locSlugs.map((s) => locations.find((l) => l.slug === s)).filter((l): l is (typeof locations)[number] => l !== undefined);
      const pkgs = allPkgs.filter((pkg) => pkg.photographer_id === p.id).map((pkg) => ({
        id: pkg.id, name: pkg.name, description: pkg.description || "",
        duration_minutes: pkg.duration_minutes, num_photos: pkg.num_photos,
        price: pkg.price, is_popular: pkg.is_popular,
      }));

      return {
        id: p.id, user_id: "", slug: p.slug, name: p.name, tagline: p.tagline || "", bio: p.bio || "",
        avatar_url: p.avatar_url, cover_url: p.cover_url, cover_position_y: p.cover_position_y ?? 50,
        languages: p.languages || [], hourly_rate: 0, currency: "EUR",
        locations: locs, packages: pkgs, shoot_types: p.shoot_types || [],
        experience_years: p.experience_years, is_verified: p.is_verified,
        is_featured: p.is_featured, is_founding: p.is_founding, plan: p.plan,
        rating: Number(p.rating), review_count: p.review_count,
        session_count: p.session_count, created_at: "",
      } as PhotographerProfile;
    });
  } catch {
    return [];
  }
}

export default async function LocationPhotographersPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const location = locations.find((l) => l.slug === slug);
  if (!location) notFound();

  const dbPhotographers = await getDbPhotographers();

  const base = "https://photoportugal.com";
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Professional Photographers in ${location.name}, Portugal`,
    numberOfItems: dbPhotographers.filter(p => p.locations.some(l => l.slug === slug)).length,
    itemListElement: dbPhotographers
      .filter(p => p.locations.some(l => l.slug === slug))
      .slice(0, 20)
      .map((p, i) => ({
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
        key={slug}
        photographers={dbPhotographers}
        locations={locations}
        shootTypes={SHOOT_TYPES as unknown as string[]}
        initialLocation={slug}
      />
    </>
  );
}
