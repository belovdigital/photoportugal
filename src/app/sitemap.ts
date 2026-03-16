import type { MetadataRoute } from "next";
import { locations } from "@/lib/locations-data";
import { demoPhotographers } from "@/lib/demo-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://photoportugal.com";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/photographers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/locations`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const locationPages: MetadataRoute.Sitemap = locations.map((loc) => ({
    url: `${baseUrl}/locations/${loc.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const photographerPages: MetadataRoute.Sitemap = demoPhotographers.map(
    (p) => ({
      url: `${baseUrl}/photographers/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: p.plan === "premium" ? 0.8 : 0.7,
    })
  );

  return [...staticPages, ...locationPages, ...photographerPages];
}
