/**
 * Resolve a photo URL stored in the DB (or hardcoded) to a fetchable browser URL.
 *
 * After the R2 migration, almost every URL in the DB is already a full
 * `https://files.photoportugal.com/...` link — those pass through unchanged
 * (Cloudflare's regular CDN handles the cache).
 *
 * Legacy `/uploads/...` rows that slipped past the migration still go through
 * the local `/api/img/` Sharp proxy so the page doesn't break.
 *
 * Anything else (Unsplash, blob:, data:, http(s) external) passes through as-is.
 */
const R2_HOST = "files.photoportugal.com";

export function resolveImageUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith(`https://${R2_HOST}/`)) return src;
  if (src.startsWith("/uploads/")) {
    // Legacy fallback through the Sharp proxy. Should be rare post-migration.
    const path = src.replace("/uploads/", "");
    return `/api/img/${path}?w=800&q=80&f=webp`;
  }
  return src;
}

/**
 * Same as `resolveImageUrl`, but always returns an absolute URL — needed for
 * meta tags (og:image, schema.org), email content, sitemaps, and anything that
 * gets consumed off-site.
 */
export function resolveAbsoluteImageUrl(src: string | null | undefined, baseUrl = "https://photoportugal.com"): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("https://") || src.startsWith("http://")) return src;
  const resolved = resolveImageUrl(src);
  if (resolved.startsWith("https://") || resolved.startsWith("http://")) return resolved;
  return `${baseUrl}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}
