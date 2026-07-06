import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { query, queryOne } from "@/lib/db";
import { maskSurname } from "@/lib/photographer-name";

// Markdown representations of key public pages, served via content
// negotiation (`Accept: text/markdown`) for AI agents. English only —
// agents overwhelmingly consume EN; localized URLs map to the same content.
//
// Names are masked with maskSurname(): agents relay this text directly to
// clients, so it is a visible discovery surface, not an SEO meta surface.

const SITE = "https://photoportugal.com";

interface CatalogRow {
  slug: string; name: string; tagline: string | null; rating: number; review_count: number;
  min_price: number | null; shoot_types: string[]; languages: string[]; locations: string[];
}

function locationName(slug: string): string {
  return locations.find((l) => l.slug === slug)?.name || slug;
}

function photographerLine(p: CatalogRow): string {
  const rating = p.review_count > 0 ? `★${Number(p.rating).toFixed(1)} (${p.review_count} reviews)` : "new";
  const price = p.min_price ? `from EUR${Math.round(Number(p.min_price))}` : "contact for price";
  const types = (p.shoot_types || []).slice(0, 4).join(", ");
  const locs = (p.locations || []).slice(0, 5).map(locationName).join(", ");
  const langs = (p.languages || []).join(", ");
  return [
    `### [${maskSurname(p.name)}](${SITE}/photographers/${p.slug})`,
    p.tagline ? `*${p.tagline}*` : null,
    `- Rating: ${rating}`,
    `- Price: ${price}`,
    types ? `- Shoot types: ${types}` : null,
    locs ? `- Locations: ${locs}` : null,
    langs ? `- Languages: ${langs}` : null,
  ].filter(Boolean).join("\n");
}

async function catalogRows(where = "", params: unknown[] = []): Promise<CatalogRow[]> {
  return query<CatalogRow>(
    `SELECT pp.slug, u.name, pp.tagline, pp.rating, pp.review_count,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
            pp.shoot_types, pp.languages,
            ARRAY(SELECT l.location_slug FROM photographer_locations l WHERE l.photographer_id = pp.id ORDER BY l.location_slug) as locations
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     WHERE pp.is_approved = TRUE ${where}
     ORDER BY pp.review_count DESC NULLS LAST, pp.rating DESC NULLS LAST`,
    params
  );
}

export async function photographersMarkdown(): Promise<string> {
  let rows: CatalogRow[] = [];
  try { rows = await catalogRows(); } catch {}
  return `# Photographers in Portugal — Photo Portugal
> ${rows.length} vetted professional photographers available for booking across Portugal. Filter by location, shoot type, language and budget at ${SITE}/photographers

Every photographer is personally vetted and approved. Booking is online with instant confirmation, secure Stripe payment (escrow-protected until photo delivery), and free cancellation up to 48h before the shoot.

${rows.map(photographerLine).join("\n\n") || `See the live catalog at ${SITE}/photographers`}

---
Book online: ${SITE}/photographers · AI Concierge (free matching): ${SITE}/concierge · Site overview: ${SITE}/llms.txt
`;
}

export async function photographerProfileMarkdown(slug: string): Promise<string | null> {
  interface ProfileRow extends CatalogRow { bio: string | null; experience_years: number | null; is_verified: boolean; id: string }
  let p: ProfileRow | null = null;
  try {
    p = await queryOne<ProfileRow>(
      `SELECT pp.id, pp.slug, u.name, pp.tagline, pp.bio, pp.rating, pp.review_count,
              pp.experience_years, pp.is_verified, pp.shoot_types, pp.languages,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
              ARRAY(SELECT l.location_slug FROM photographer_locations l WHERE l.photographer_id = pp.id ORDER BY l.location_slug) as locations
       FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.slug = $1 AND pp.is_approved = TRUE`,
      [slug]
    );
  } catch {}
  if (!p) return null;

  interface PackageRow { name: string; description: string | null; duration_minutes: number; num_photos: number; price: number; delivery_days: number }
  let packages: PackageRow[] = [];
  try {
    packages = await query<PackageRow>(
      `SELECT name, description, duration_minutes, num_photos, price, delivery_days
       FROM packages WHERE photographer_id = $1 AND is_public = TRUE AND custom_for_user_id IS NULL
       ORDER BY sort_order, price`,
      [p.id]
    );
  } catch {}

  interface ReviewRow { text: string; rating: number; client_name: string | null; country: string | null }
  let reviews: ReviewRow[] = [];
  try {
    reviews = await query<ReviewRow>(
      `SELECT r.text, r.rating, COALESCE(r.client_name_override, u.name) as client_name, r.client_country_override as country
       FROM reviews r LEFT JOIN users u ON u.id = r.client_id
       WHERE r.photographer_id = $1 AND r.is_approved = TRUE AND r.text IS NOT NULL
       ORDER BY LENGTH(r.text) DESC LIMIT 5`,
      [p.id]
    );
  } catch {}

  const name = maskSurname(p.name);
  const rating = p.review_count > 0 ? `★${Number(p.rating).toFixed(1)} from ${p.review_count} verified reviews` : "New on the platform";

  return `# ${name} — Photographer in Portugal
> ${p.tagline || `Professional photographer on Photo Portugal.`} Book online: ${SITE}/photographers/${p.slug}

- ${rating}${p.is_verified ? " · Identity verified" : ""}
${p.experience_years ? `- ${p.experience_years}+ years of experience\n` : ""}${p.languages?.length ? `- Speaks: ${p.languages.join(", ")}\n` : ""}${p.shoot_types?.length ? `- Shoot types: ${p.shoot_types.join(", ")}\n` : ""}${p.locations?.length ? `- Works in: ${p.locations.map(locationName).join(", ")}\n` : ""}
${p.bio ? `## About\n${p.bio}\n` : ""}
## Packages
${packages.length > 0
  ? packages.map((pk) => `### ${pk.name} — EUR${pk.price}\n- ${pk.duration_minutes} minutes, ${pk.num_photos} edited photos, delivery in ~${pk.delivery_days} days${pk.description ? `\n- ${pk.description}` : ""}`).join("\n\n")
  : `Package details and prices: ${SITE}/photographers/${p.slug}`}

${reviews.length > 0 ? `## Verified Reviews\n${reviews.map((r) => `- ★${r.rating} — "${r.text.length > 300 ? r.text.slice(0, 300).replace(/\s\S*$/, "") + "..." : r.text}" — ${maskSurname(r.client_name) || "A client"}${r.country ? ` (${r.country})` : ""}`).join("\n")}\n` : ""}
## Booking
Book ${name} online with instant confirmation and secure Stripe payment (held in escrow until photos are delivered): ${SITE}/photographers/${p.slug}
Free cancellation up to 48h before the shoot. Full portfolio and availability calendar on the profile page.
`;
}

export async function locationsMarkdown(): Promise<string> {
  interface Coverage { location_slug: string; count: string; min_price: string | null }
  let coverage: Coverage[] = [];
  try {
    coverage = await query<Coverage>(
      `SELECT l.location_slug, COUNT(DISTINCT pp.id)::text as count, MIN(pk.price)::text as min_price
       FROM photographer_locations l
       JOIN photographer_profiles pp ON pp.id = l.photographer_id AND pp.is_approved = TRUE
       LEFT JOIN packages pk ON pk.photographer_id = pp.id AND pk.is_public = TRUE
       GROUP BY l.location_slug ORDER BY count DESC`
    );
  } catch {}
  const byslug = new Map(coverage.map((c) => [c.location_slug, c]));

  return `# Photoshoot Locations in Portugal — Photo Portugal
> Professional photographers available in ${locations.length} destinations across Portugal. Browse: ${SITE}/locations

${locations.map((l) => {
    const c = byslug.get(l.slug);
    const stats = c ? ` — ${c.count} photographer${c.count === "1" ? "" : "s"}${c.min_price ? `, from EUR${Math.round(parseFloat(c.min_price))}` : ""}` : "";
    return `## [${l.name}](${SITE}/locations/${l.slug}) (${l.region})${stats}\n${l.description}`;
  }).join("\n\n")}
`;
}

export async function locationMarkdown(slug: string): Promise<string | null> {
  const loc = locations.find((l) => l.slug === slug);
  if (!loc) return null;
  let rows: CatalogRow[] = [];
  try {
    rows = await catalogRows(
      "AND EXISTS (SELECT 1 FROM photographer_locations pl WHERE pl.photographer_id = pp.id AND pl.location_slug = $1)",
      [slug]
    );
  } catch {}

  return `# Photographers in ${loc.name}, Portugal — Photo Portugal
> ${loc.description} Book online: ${SITE}/locations/${loc.slug}

${loc.long_description}

## Available Photographers (${rows.length})
${rows.map(photographerLine).join("\n\n") || `See live availability at ${SITE}/locations/${loc.slug}`}

---
All bookings: instant online confirmation, secure Stripe payment held until delivery, free cancellation up to 48h before the shoot.
`;
}

export async function photoshootsMarkdown(): Promise<string> {
  return `# Photoshoot Types in Portugal — Photo Portugal
> Book a professional photographer in Portugal for any occasion. Browse: ${SITE}/photoshoots

${shootTypes.map((st) => `## [${st.name}](${SITE}/photoshoots/${st.slug})\n${st.heroText}`).join("\n\n")}
`;
}

export async function photoshootMarkdown(slug: string): Promise<string | null> {
  const st = shootTypes.find((s) => s.slug === slug);
  if (!st) return null;
  const matchNames = st.photographerShootTypeNames?.length ? st.photographerShootTypeNames : [st.name];
  let rows: CatalogRow[] = [];
  try {
    rows = await catalogRows("AND pp.shoot_types && $1::text[]", [matchNames]);
  } catch {}

  return `# ${st.h1} — Photo Portugal
> ${st.metaDescription} Book online: ${SITE}/photoshoots/${st.slug}

${st.heroText}

## Best Locations for ${st.name}
${st.bestLocations.map((bl) => `- [${bl.name}](${SITE}/locations/${bl.slug}) — ${bl.reason}`).join("\n")}

## Available Photographers (${rows.length})
${rows.slice(0, 15).map(photographerLine).join("\n\n") || `See the live catalog at ${SITE}/photoshoots/${st.slug}`}

${st.faqs.length > 0 ? `## FAQ\n${st.faqs.map((f) => `### ${f.question}\n${f.answer}`).join("\n\n")}\n` : ""}`;
}
