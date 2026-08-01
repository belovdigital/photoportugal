import { country } from "@/lib/country";
import { locationImage } from "@/lib/unsplash-images";

/**
 * An absolute, actually-resolving cover image URL for a location.
 *
 * Every location in `locations-data*.ts` carries a `cover_image` like
 * `/images/locations/lisbon-cover.jpg`, and **that directory has never existed
 * in the repository**. og:image, twitter:image and the schema.org `image`
 * property on every location page — on BOTH markets, since launch — have been
 * pointing at a 404. Social shares showed no preview and Google had no image to
 * attach to the LocalBusiness entity.
 *
 * The pages themselves render the Unsplash-backed photo via `locationImage()`,
 * so that is what the metadata should point at too. Falls back to the market's
 * OG card if a slug has no photo mapped.
 */
export function locationCoverUrl(location: { slug: string; cover_image?: string | null }): string {
  const raw = location.cover_image;
  if (raw?.startsWith("http")) return raw;
  return locationImage(location.slug, "hero") || `${country.baseUrl}${country.ogImage}`;
}
