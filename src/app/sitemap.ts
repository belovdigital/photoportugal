import type { MetadataRoute } from "next";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { photoSpots, spotSlug } from "@/lib/photo-spots-data";
import { query } from "@/lib/db";
import { localizedUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const LOCALES = ["en", "pt", "de", "es", "fr"] as const;
const HREFLANGS: Record<(typeof LOCALES)[number], string[]> = {
  en: ["en-GB", "en-US"],
  pt: ["pt-PT"],
  de: ["de-DE"],
  es: ["es-ES"],
  fr: ["fr-FR"],
};
const CONTENT_LAST_MODIFIED = new Date("2026-05-03T00:00:00.000Z");

function urlFor(path: string, locale: string): string {
  const safeLocale = LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale as (typeof LOCALES)[number]
    : "en";
  return localizedUrl(path || "/", safeLocale);
}

function localized(path: string, opts: Omit<MetadataRoute.Sitemap[0], "url">): MetadataRoute.Sitemap {
  const languages: Record<string, string> = { "x-default": urlFor(path, "en") };
  for (const locale of LOCALES) {
    for (const hreflang of HREFLANGS[locale]) {
      languages[hreflang] = urlFor(path, locale);
    }
  }
  return LOCALES.map((locale) => ({
    ...opts,
    url: urlFor(path, locale),
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const contentLastModified = CONTENT_LAST_MODIFIED;

  const staticPages = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/photographers", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/locations", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/how-it-works", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.4 },
    { path: "/faq", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/for-photographers", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/for-photographers/pricing", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/for-photographers/how-we-select", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/for-photographers/join", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/photoshoots", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/find-photographer", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.4 },
    { path: "/support", changeFrequency: "monthly" as const, priority: 0.5 },
  ].flatMap((p) => localized(p.path, { lastModified: contentLastModified, changeFrequency: p.changeFrequency, priority: p.priority }));

  const locationPages = locations.flatMap((loc) =>
    localized(`/locations/${loc.slug}`, { lastModified: contentLastModified, changeFrequency: "weekly", priority: 0.9 })
  );

  // Occasion sub-pages — 34 locations × 7 occasions = 238 unique combos.
  // These are the primary paid-ad sitelink targets, so priority is high
  // (matches /locations/[slug]) and changefreq is weekly to reflect the
  // dynamic photographer/portfolio pulls that refresh on every render.
  const occasions = ["proposal", "honeymoon", "couples", "family", "solo", "engagement", "elopement"];
  const occasionPages = locations.flatMap((loc) =>
    occasions.flatMap((occ) =>
      localized(`/locations/${loc.slug}/${occ}`, { lastModified: contentLastModified, changeFrequency: "weekly", priority: 0.85 })
    )
  );

  const shootTypePages = shootTypes.flatMap((type) =>
    localized(`/photoshoots/${type.slug}`, { lastModified: contentLastModified, changeFrequency: "weekly", priority: 0.8 })
  );

  // Spot pages: /spots/[city]/[spot]
  const spotPages = Object.entries(photoSpots).flatMap(([city, spots]) =>
    spots.flatMap((s) =>
      localized(`/spots/${city}/${spotSlug(s.name)}`, { lastModified: contentLastModified, changeFrequency: "monthly", priority: 0.7 })
    )
  );

  let photographerPages: MetadataRoute.Sitemap = [];
  try {
    const dbProfiles = await query<{ slug: string; plan: string; updated_at: string }>(
      "SELECT slug, plan, updated_at FROM photographer_profiles WHERE is_approved = TRUE"
    );
    photographerPages = dbProfiles.flatMap((p) =>
      localized(`/photographers/${p.slug}`, {
        lastModified: new Date(p.updated_at),
        changeFrequency: "weekly",
        priority: p.plan === "premium" ? 0.8 : 0.7,
      })
    );
  } catch (err) {
    console.error("[sitemap] Failed to load photographer pages:", err);
  }

  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await query<{ slug: string; published_at: string; locale: string | null }>(
      "SELECT slug, published_at, locale FROM blog_posts WHERE is_published = TRUE ORDER BY published_at DESC"
    );
    // Each blog post exists in ONE locale only — emit a single URL for that locale,
    // not all-locale localized() output (would create false 404s for the other locales).
    blogPages = blogPosts.map((p) => {
      const loc = (p.locale || "en").toLowerCase();
      return {
        url: urlFor(`/blog/${p.slug}`, loc),
        lastModified: new Date(p.published_at),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      };
    });
  } catch (err) {
    console.error("[sitemap] Failed to load blog pages:", err);
  }

  // /photographers/location/[slug] — clean URL filtered catalogs
  const photographerLocationPages = locations.flatMap((loc) =>
    localized(`/photographers/location/${loc.slug}`, { lastModified: contentLastModified, changeFrequency: "weekly", priority: 0.85 })
  );

  const blogCategories = [
    "locations", "pricing", "elopements", "weddings", "couples",
    "family", "planning", "proposals", "solo", "comparisons",
  ];
  const blogCategoryPages = blogCategories.flatMap((cat) =>
    localized(`/blog/category/${cat}`, { lastModified: contentLastModified, changeFrequency: "weekly", priority: 0.7 })
  );

  return [...staticPages, ...locationPages, ...occasionPages, ...shootTypePages, ...spotPages, ...photographerLocationPages, ...photographerPages, ...blogPages, ...blogCategoryPages];
}
