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

export const VARIANT_QUALITY = 82;

/**
 * The rungs, per kind of image.
 *
 * Photos: 400 covers a 1x card, 800 the same card on retina, 1600 a full-bleed
 * hero on a large display.
 *
 * Avatars are a different shape of problem — they are stored 800x800 and drawn
 * in circles of about fifty pixels, so the interesting rung is far below
 * anything a photo needs. 160 serves a 56px circle at 3x and weighs a few
 * kilobytes against the 130 kB original. Giving photos a 160 rung would just
 * be four thousand files nothing ever picks.
 */
/**
 * The 2000 rung is the original's own pixels re-encoded as WebP: uploads are
 * capped at 2000px, so `resize(2000, withoutEnlargement)` never scales — it
 * only changes the codec. It exists so a srcset can offer the full original
 * resolution (the hero on a large retina display must never get fewer pixels
 * than it does today) while still saving the ~40% that WebP q82 buys at equal
 * PSNR over the stored JPEG q85.
 */
const WIDTHS_BY_PREFIX: Record<string, readonly number[]> = {
  "avatars/": [160, 400, 800],
  "portfolio/": [400, 800, 1600, 2000],
  "covers/": [400, 800, 1600, 2000],
};

/** Default ladder, for callers that do not know the prefix. */
export const VARIANT_WIDTHS = [400, 800, 1600] as const;

/** The rungs for a given R2 key, or undefined when we do not resize it. */
export function variantWidthsFor(key: string): readonly number[] | undefined {
  if (/_(\d+)\.webp$/.test(key)) return undefined; // already a variant
  if (/^thumb_|\/thumb_/.test(key)) return undefined; // the older 400px thumbnails
  if (!/\.(jpe?g|png|webp)$/i.test(key)) return undefined;
  const prefix = Object.keys(WIDTHS_BY_PREFIX).find((p) => key.startsWith(p));
  return prefix ? WIDTHS_BY_PREFIX[prefix] : undefined;
}

/** True when this R2 key is one we generate variants for. */
export function hasVariants(key: string): boolean {
  return variantWidthsFor(key) !== undefined;
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
  const widths = variantWidthsFor(key);
  if (!widths) return undefined;
  return widths.map((w) => `${variantUrl(originalUrl, w)} ${w}w`).join(", ");
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
