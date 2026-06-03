import type { MetadataRoute } from "next";

// Private/transactional routes — disallow English + every locale prefix
// explicitly. The pages already noindex via metadata, but a robots.txt
// disallow saves Google's crawl budget on URLs that will never return
// indexable content.
const PRIVATE_PATHS = ["/dashboard/", "/api/", "/auth/", "/book/", "/delivery/", "/gift/claim", "/gift-card/claim", "/gift-cards/success", "/try-yourself"];
const LOCALES = ["pt", "de", "es", "fr"];

const disallow = [
  ...PRIVATE_PATHS,
  ...LOCALES.flatMap((l) => PRIVATE_PATHS.map((p) => `/${l}${p}`)),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: [
      "https://photoportugal.com/sitemap.xml",
      "https://photoportugal.com/sitemap-images.xml",
    ],
  };
}
