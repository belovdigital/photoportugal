import type { MetadataRoute } from "next";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const BASE = "https://photoportugal.com";
const LOCALES = ["en", "pt"] as const;

function localized(path: string, opts: Omit<MetadataRoute.Sitemap[0], "url">): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    ...opts,
    url: locale === "en" ? `${BASE}${path}` : `${BASE}/pt${path}`,
    alternates: {
      languages: {
        "en-GB": `${BASE}${path}`,
        "en-US": `${BASE}${path}`,
        "pt-PT": `${BASE}/pt${path}`,
        "x-default": `${BASE}${path}`,
      },
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

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
  ].flatMap((p) => localized(p.path, { lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority }));

  const locationPages = locations.flatMap((loc) =>
    localized(`/locations/${loc.slug}`, { lastModified: now, changeFrequency: "weekly", priority: 0.9 })
  );

  // Occasion sub-pages for top locations
  const occasions = ["proposal", "honeymoon", "couples", "family", "solo", "engagement", "elopement"];
  const occasionPages = locations.flatMap((loc) =>
    occasions.flatMap((occ) =>
      localized(`/locations/${loc.slug}/${occ}`, { lastModified: now, changeFrequency: "monthly", priority: 0.7 })
    )
  );

  const shootTypePages = shootTypes.flatMap((type) =>
    localized(`/photoshoots/${type.slug}`, { lastModified: now, changeFrequency: "weekly", priority: 0.8 })
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
    const blogPosts = await query<{ slug: string; published_at: string }>(
      "SELECT slug, published_at FROM blog_posts WHERE is_published = TRUE ORDER BY published_at DESC"
    );
    blogPages = blogPosts.flatMap((p) =>
      localized(`/blog/${p.slug}`, {
        lastModified: new Date(p.published_at),
        changeFrequency: "monthly",
        priority: 0.7,
      })
    );
  } catch (err) {
    console.error("[sitemap] Failed to load blog pages:", err);
  }

  // /photographers/location/[slug] — clean URL filtered catalogs
  const photographerLocationPages = locations.flatMap((loc) =>
    localized(`/photographers/location/${loc.slug}`, { lastModified: now, changeFrequency: "weekly", priority: 0.85 })
  );

  const blogCategories = [
    "locations", "pricing", "elopements", "weddings", "couples",
    "family", "planning", "proposals", "solo", "comparisons",
  ];
  const blogCategoryPages = blogCategories.flatMap((cat) =>
    localized(`/blog/category/${cat}`, { lastModified: now, changeFrequency: "weekly", priority: 0.7 })
  );

  return [...staticPages, ...locationPages, ...occasionPages, ...shootTypePages, ...photographerLocationPages, ...photographerPages, ...blogPages, ...blogCategoryPages];
}
