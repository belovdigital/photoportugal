/**
 * Resized WebP copies of the photos we host on R2, addressed by a name derived
 * from the original.
 *
 *   portfolio/<profile>/<uuid>.jpg  ->  portfolio/<profile>/<uuid>_800.webp
 *   avatars/<uuid>.jpg              ->  avatars/<uuid>_400.webp
 *
 * Derived rather than recorded on purpose: no schema change, no join, and any
 * surface can build a srcset from a URL it already has.
 *
 * Why this exists: every photo on the site was served as its upload-time
 * original — capped at 2000px, q=85 JPEG — whatever size it was displayed at.
 * The Portugal homepage spent 2.16 MB on 32 images, including five 800x800
 * avatars rendered as 56px circles, and its LCP element was a 231 kB portfolio
 * shot in a card a few hundred pixels wide.
 *
 * Cloudflare Image Transformations were tried for this in the past and rolled
 * back: resizing at request time made the first visitor wait on a cold cache.
 * These are plain static objects behind the same CDN, so there is no such
 * thing as a miss that costs a resize — the only cost is a one-off backfill.
 *
 * WebP, not AVIF, for now: at the sizes we serve, most of the saving comes
 * from sending the right number of pixels rather than from the codec, and WebP
 * encodes fast enough to backfill four thousand photos without a fuss. On a
 * real portfolio shot at 800px wide, WebP q82 measured 65 kB against 111 kB
 * for the JPEG we serve today, at the same PSNR.
 */

/** The rungs we generate. 400 covers a 1x card, 800 the same card on retina,
 *  1600 a full-bleed hero on a large display. */
export const VARIANT_WIDTHS = [400, 800, 1600] as const;

export const VARIANT_QUALITY = 82;

/** Objects we generate variants for. Anything else is left alone. */
const VARIANT_PREFIXES = ["portfolio/", "avatars/", "covers/"];

/** True when this R2 key is one we generate variants for. */
export function hasVariants(key: string): boolean {
  if (/_(\d+)\.webp$/.test(key)) return false; // already a variant
  if (/^thumb_|\/thumb_/.test(key)) return false; // the older 400px thumbnails
  if (!/\.(jpe?g|png|webp)$/i.test(key)) return false;
  return VARIANT_PREFIXES.some((p) => key.startsWith(p));
}

/** The key of one rung, from the original's key. */
export function variantKey(originalKey: string, width: number): string {
  return originalKey.replace(/\.[^.]+$/, `_${width}.webp`);
}

/** The URL of one rung, from the original's URL. */
export function variantUrl(originalUrl: string, width: number): string {
  return originalUrl.replace(/\.[^.?]+(?=($|\?))/, `_${width}.webp`);
}

/**
 * A srcset over the rungs, or undefined when this is not an image we resize.
 *
 * Only ever returns rungs that are actually smaller than the original would
 * be; the browser still gets the original as `src`, so a missing variant
 * degrades to what we serve today rather than to a broken image.
 */
export function r2SrcSet(originalUrl: string, filesHost: string): string | undefined {
  if (!originalUrl.startsWith(`https://${filesHost}/`)) return undefined;
  const key = originalUrl.slice(`https://${filesHost}/`.length).split("?")[0];
  if (!hasVariants(key)) return undefined;
  return VARIANT_WIDTHS.map((w) => `${variantUrl(originalUrl, w)} ${w}w`).join(", ");
}

/**
 * srcset + sizes ready to spread onto a plain `<img>`.
 *
 * Most photos on the site are rendered by hand-written `<img>` tags rather
 * than by OptimizedImage — 44 of them at the last count — and those were the
 * ones still pulling full originals. Spreading this is a one-line change per
 * call site, which is a far smaller edit than swapping the component.
 *
 * Returns an empty object for anything that is not one of our R2 photos, so
 * it is always safe to spread.
 */
export function r2ImgProps(
  src: string | null | undefined,
  filesHost: string,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
): { srcSet?: string; sizes?: string } {
  if (!src) return {};
  const srcSet = r2SrcSet(src, filesHost);
  return srcSet ? { srcSet, sizes } : {};
}
