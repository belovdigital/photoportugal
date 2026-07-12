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
// Default lastModified for static SEO pages whose source is hand-edited
// (homepage, about, how-it-works, for-photographers/*). Bump this when
// you do a meaningful content refresh; Google uses it to decide whether
// to recrawl. For dynamic content (photographers, blog posts, locations)
// we override below from the actual DB updated_at timestamps.
const STATIC_CONTENT_LAST_MODIFIED = new Date("2026-05-13T00:00:00.000Z");

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
  // Freshness signal for catalog-style pages (locations/photoshoots/photographers
  // index) — they're derived from the photographers table. Whenever a
  // photographer updates their profile, the catalog they appear on is
  // effectively updated too. We use the latest profile update as the
  // sitemap lastModified so Google picks up real freshness, not the
  // hardcoded constant.
  let catalogLastModified = STATIC_CONTENT_LAST_MODIFIED;
  try {
    const r = await query<{ ts: string }>(
      "SELECT MAX(updated_at)::text AS ts FROM photographer_profiles WHERE is_approved = TRUE"
    );
    if (r[0]?.ts) catalogLastModified = new Date(r[0].ts);
  } catch {}

  // Same idea for /blog/category/X — latest post date among posts in
  // that category. Fallback to static.
  let blogLastModified = STATIC_CONTENT_LAST_MODIFIED;
  try {
    const r = await query<{ ts: string }>(
      "SELECT MAX(updated_at)::text AS ts FROM blog_posts WHERE is_published = TRUE"
    );
    if (r[0]?.ts) blogLastModified = new Date(r[0].ts);
  } catch {}

  const contentLastModified = STATIC_CONTENT_LAST_MODIFIED;

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
    { path: "/weddings", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/concierge", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.4 },
    { path: "/support", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/gift-cards", changeFrequency: "monthly" as const, priority: 0.7 },
  ].flatMap((p) => localized(p.path, { lastModified: contentLastModified, changeFrequency: p.changeFrequency, priority: p.priority }));

  const locationPages = locations.flatMap((loc) =>
    localized(`/locations/${loc.slug}`, { lastModified: catalogLastModified, changeFrequency: "weekly", priority: 0.9 })
  );

  // Occasion sub-pages — public location × occasion cross-product, but only
  // for pairs that ACTUALLY have at least one approved photographer covering
  // that location AND offering that shoot type. Prevents thin-content pages
  // (a /locations/coimbra/kids-birthday page with zero photographers offers
  // nothing to Google and looks like doorway content). Auto-updates: as
  // soon as a photographer adds the shoot type to a covered location, the
  // sitemap (revalidate=3600s) picks the new pair up.
  //
  // Keep `occasions` aligned with the OCCASIONS map in
  // /locations/[slug]/[occasion]/page.tsx. Each slug also needs a
  // matching entry in shootTypes so we can resolve its photographer-side
  // label set (Solo → ["Solo Travel","Solo Portrait"], Birthday → ["Birthday"]).
  const occasions = [
    "proposal", "honeymoon", "couples", "family", "solo",
    "engagement", "elopement", "wedding", "kids-birthday", "studio-portrait",
  ];
  // Resolve each occasion slug → the labels photographers store in
  // photographer_profiles.shoot_types[]. Default is [name] when not overridden.
  const occasionLabelsBySlug = new Map<string, string[]>();
  for (const occ of occasions) {
    const st = shootTypes.find((s) => s.slug === occ);
    if (st) occasionLabelsBySlug.set(occ, st.photographerShootTypeNames || [st.name]);
  }
  // One query, one pass — get every (location, occasion) pair that has
  // approved coverage. Cheap and avoids the dumb 33×9 cartesian.
  let coveredPairs: Set<string> = new Set();
  try {
    const allLabels = Array.from(new Set(Array.from(occasionLabelsBySlug.values()).flat()));
    if (allLabels.length > 0) {
      const rows = await query<{ location_slug: string; shoot_label: string }>(
        `SELECT DISTINCT pl.location_slug, label AS shoot_label
           FROM photographer_profiles pp
           JOIN photographer_locations pl ON pl.photographer_id = pp.id
           JOIN users u ON u.id = pp.user_id,
                LATERAL UNNEST(pp.shoot_types) AS label
          WHERE pp.is_approved = TRUE
            AND COALESCE(u.is_banned, FALSE) = FALSE
            AND label = ANY($1::text[])`,
        [allLabels]
      );
      for (const r of rows) {
        for (const [slug, labels] of occasionLabelsBySlug) {
          if (labels.includes(r.shoot_label)) {
            coveredPairs.add(`${r.location_slug}|${slug}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[sitemap] Failed to resolve occasion coverage, falling back to full cartesian:", err);
    // Fallback: emit the full cartesian rather than skipping the section.
    for (const loc of locations) for (const occ of occasions) coveredPairs.add(`${loc.slug}|${occ}`);
  }
  const occasionPages = locations.flatMap((loc) =>
    occasions
      .filter((occ) => coveredPairs.has(`${loc.slug}|${occ}`))
      .flatMap((occ) =>
        localized(`/locations/${loc.slug}/${occ}`, { lastModified: catalogLastModified, changeFrequency: "weekly", priority: 0.85 })
      )
  );

  // Wedding is excluded: /photoshoots/wedding 301-redirects to the
  // dedicated /weddings landing (see next.config.ts), which is in
  // staticPages above.
  const shootTypePages = shootTypes
    .filter((type) => type.slug !== "wedding" && type.slug !== "business")
    .flatMap((type) =>
      localized(`/photoshoots/${type.slug}`, { lastModified: catalogLastModified, changeFrequency: "weekly", priority: 0.8 })
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

  // Per-package pages are deliberately NOT in the sitemap: since the
  // "Duplicate without user-selected canonical" fix they canonicalize to
  // the parent photographer profile (see [package]/page.tsx), and a
  // sitemap must only list canonical URLs. Listing them fed Search
  // Console "Duplicate" noise, and the fr/es/de variants were 301→404
  // chains (564 dead URLs) until the pathnames entry in routing.ts.

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
    localized(`/photographers/location/${loc.slug}`, { lastModified: catalogLastModified, changeFrequency: "weekly", priority: 0.85 })
  );

  const blogCategories = [
    "locations", "pricing", "elopements", "weddings", "couples",
    "family", "planning", "proposals", "solo", "comparisons", "business",
  ];
  const blogCategoryPages = blogCategories.flatMap((cat) =>
    localized(`/blog/category/${cat}`, { lastModified: blogLastModified, changeFrequency: "weekly", priority: 0.7 })
  );

  return [...staticPages, ...locationPages, ...occasionPages, ...shootTypePages, ...spotPages, ...photographerLocationPages, ...photographerPages, ...blogPages, ...blogCategoryPages];
}
