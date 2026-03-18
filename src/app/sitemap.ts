import type { MetadataRoute } from "next";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { query } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://photoportugal.com";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/photographers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/locations`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/how-it-works`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/for-photographers`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/photoshoots`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  const locationPages: MetadataRoute.Sitemap = locations.map((loc) => ({
    url: `${baseUrl}/locations/${loc.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const shootTypePages: MetadataRoute.Sitemap = shootTypes.map((type) => ({
    url: `${baseUrl}/photoshoots/${type.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // DB photographers
  let photographerPages: MetadataRoute.Sitemap = [];
  try {
    const dbProfiles = await query<{ slug: string; plan: string; updated_at: string }>(
      "SELECT slug, plan, updated_at FROM photographer_profiles WHERE is_approved = TRUE"
    );
    photographerPages = dbProfiles.map((p) => ({
      url: `${baseUrl}/photographers/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const,
      priority: p.plan === "premium" ? 0.8 : 0.7,
    }));
  } catch {}

  // Blog posts
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await query<{ slug: string; published_at: string }>(
      "SELECT slug, published_at FROM blog_posts WHERE is_published = TRUE ORDER BY published_at DESC"
    );
    blogPages = blogPosts.map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: new Date(p.published_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {}

  return [...staticPages, ...locationPages, ...shootTypePages, ...photographerPages, ...blogPages];
}
