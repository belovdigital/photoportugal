import { NextResponse } from "next/server";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { query, queryOne } from "@/lib/db";
import { portugalCoverageStats } from "@/lib/location-coverage-stats";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  let photographerCount = 0;
  let reviewCount = 0;
  let avgRating = 0;
  let minPrice: number | null = null;

  try {
    const stats = await queryOne<{
      photographer_count: string;
      review_count: string;
      avg_rating: string | null;
      min_price: string | null;
    }>(
      `SELECT
        COUNT(*) as photographer_count,
        COALESCE(SUM(review_count), 0) as review_count,
        AVG(rating) FILTER (WHERE rating IS NOT NULL AND review_count > 0) as avg_rating,
        (SELECT MIN(price) FROM packages pk JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id WHERE pp2.is_approved = TRUE) as min_price
      FROM photographer_profiles
      WHERE is_approved = TRUE`
    );
    if (stats) {
      photographerCount = parseInt(stats.photographer_count);
      reviewCount = parseInt(stats.review_count);
      avgRating = stats.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(1)) : 0;
      minPrice = stats.min_price ? parseFloat(stats.min_price) : null;
    }
  } catch (err) {
    console.error("[llms.txt] DB error:", err);
  }

  // Top photographers by review count
  interface PhotographerRow {
    slug: string; name: string; rating: number; review_count: number; min_price: number | null;
    shoot_types: string[]; locations: string[]; languages: string[];
  }
  let topPhotographers: PhotographerRow[] = [];
  try {
    topPhotographers = await query<PhotographerRow>(
      `SELECT pp.slug, u.name, pp.rating, pp.review_count,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
              pp.shoot_types,
              ARRAY(SELECT l.location_slug FROM photographer_locations l WHERE l.photographer_id = pp.id ORDER BY l.location_slug LIMIT 5) as locations,
              pp.languages
       FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE
       ORDER BY pp.review_count DESC NULLS LAST, pp.rating DESC NULLS LAST LIMIT 15`
    );
  } catch {}

  // Location coverage — photographer counts per location
  interface LocationCoverage { location_slug: string; count: string; min_price: string | null }
  let coverage: LocationCoverage[] = [];
  try {
    coverage = await query<LocationCoverage>(
      `SELECT l.location_slug, COUNT(DISTINCT pp.id)::text as count,
              MIN(pk.price)::text as min_price
       FROM photographer_locations l
       JOIN photographer_profiles pp ON pp.id = l.photographer_id AND pp.is_approved = TRUE
       LEFT JOIN packages pk ON pk.photographer_id = pp.id AND pk.is_public = TRUE
       GROUP BY l.location_slug
       ORDER BY count DESC`
    );
  } catch {}

  // Sample reviews (longest texts, varied photographers)
  interface ReviewRow { text: string; rating: number; photographer_name: string; photographer_slug: string; client_name: string | null; country: string | null }
  let sampleReviews: ReviewRow[] = [];
  try {
    sampleReviews = await query<ReviewRow>(
      `WITH ranked AS (
         SELECT r.text, r.rating, pu.name as photographer_name, pp.slug as photographer_slug,
                COALESCE(r.client_name_override, cu.name) as client_name,
                r.client_country_override as country,
                ROW_NUMBER() OVER (PARTITION BY r.photographer_id ORDER BY LENGTH(r.text) DESC) as rn
         FROM reviews r
         JOIN photographer_profiles pp ON pp.id = r.photographer_id AND pp.is_approved = TRUE
         JOIN users pu ON pu.id = pp.user_id
         LEFT JOIN users cu ON cu.id = r.client_id
         WHERE r.is_approved = TRUE AND r.text IS NOT NULL AND LENGTH(r.text) BETWEEN 120 AND 600
       )
       SELECT text, rating, photographer_name, photographer_slug, client_name, country
       FROM ranked WHERE rn = 1 ORDER BY LENGTH(text) DESC LIMIT 8`
    );
  } catch {}

  const locationCoverageText = coverage.length > 0
    ? coverage.map((c) => {
        const loc = locations.find((l) => l.slug === c.location_slug);
        const name = loc?.name || c.location_slug;
        const count = parseInt(c.count);
        const price = c.min_price ? `EUR${Math.round(parseFloat(c.min_price))}` : "";
        return `- ${name}: ${count} photographer${count === 1 ? "" : "s"}${price ? `, from ${price}` : ""} — https://photoportugal.com/locations/${c.location_slug}`;
      }).join("\n")
    : locations.map((l) => `- ${l.name} — https://photoportugal.com/locations/${l.slug}`).join("\n");

  const photographerList = topPhotographers.length > 0
    ? topPhotographers.map((p) => {
        const price = p.min_price ? `from EUR${Math.round(Number(p.min_price))}` : "contact for price";
        const rating = p.review_count > 0 ? `★${Number(p.rating).toFixed(1)} (${p.review_count} reviews)` : "new";
        const shootTypes = (p.shoot_types || []).slice(0, 3).join(", ");
        const locs = (p.locations || []).map((slug) => locations.find((l) => l.slug === slug)?.name || slug).join(", ");
        return `- ${p.name} — ${rating}, ${price}${shootTypes ? `, specializes in ${shootTypes}` : ""}${locs ? `, works in ${locs}` : ""} — https://photoportugal.com/photographers/${p.slug}`;
      }).join("\n")
    : "";

  const shootTypeDetail = shootTypes.map((st) => {
    const url = `https://photoportugal.com/photoshoots/${st.slug}`;
    return `- ${st.name}: ${url}`;
  }).join("\n");

  const reviewSamples = sampleReviews.length > 0
    ? sampleReviews.map((r) => {
        const name = r.client_name || "A client";
        const origin = r.country ? ` (${r.country})` : "";
        const text = r.text.length > 400 ? r.text.slice(0, 400).replace(/\s\S*$/, "") + "..." : r.text;
        return `"${text}" — ${name}${origin} about ${r.photographer_name} (https://photoportugal.com/photographers/${r.photographer_slug})`;
      }).join("\n\n")
    : "";

  const text = `# Photo Portugal
> Professional vacation photography marketplace in Portugal. Travelers book vetted local photographers for engagement, family, couples, proposal, wedding and solo photoshoots in Lisbon, Porto, Sintra, Algarve, Madeira and other locations across Portugal.

## What is Photo Portugal?
Photo Portugal is an online marketplace that connects travelers visiting Portugal with vetted professional local photographers. Clients browse portfolios, compare real verified reviews, check availability, and book a photoshoot online with instant confirmation and secure Stripe payment. Every photographer is personally vetted and approved by the Photo Portugal team.

## Key Facts
- ${photographerCount} approved photographers
- ${portugalCoverageStats.displayPlacesLabel} places across ${portugalCoverageStats.regions} Portugal regions
- ${reviewCount} verified reviews from real bookings
- Average rating: ${avgRating}/5
- Sessions starting from EUR${minPrice ?? 150}
- Booking languages: English, Portuguese
- Payment: Stripe, escrow-protected (held until delivery)
- Typical delivery: 1-3 weeks after the session
- Founded: 2024
- Owner/operator: Photo Portugal, info@photoportugal.com

## Who uses Photo Portugal?
- Travelers visiting Portugal who want professional vacation photos
- Couples planning engagements, proposals, honeymoons or elopements in scenic Portuguese locations
- Families on holiday wanting multi-generational memories
- Solo travelers looking for portrait / solo travel photography
- Brands and content creators needing editorial work in Portugal
- Locals booking maternity, anniversary, birthday or studio sessions

## How It Works (for travelers)
1. Browse photographer profiles filtered by location, shoot type, language, and budget on https://photoportugal.com/photographers
2. Read real reviews, view portfolios, check package pricing and availability
3. Book instantly online — secure Stripe payment, money-back guarantee, free cancellation up to 48h before the shoot
4. Meet the photographer at the chosen location; they guide you through poses and capture natural moments
5. Receive professionally edited high-resolution photos in a private online gallery within 1-3 weeks

## Pricing
- Sessions start from EUR${minPrice ?? 150}
- Typical session range: EUR150 - EUR450 depending on duration, number of edits, and package
- Pricing is set transparently by each photographer and shown on their profile
- A small service fee is added at checkout
- Photographers can join free or subscribe to Pro/Premium plans for better visibility

## Concierge Matching (free)
Travelers can describe what they want (location, date, occasion, budget) at https://photoportugal.com/find-photographer and the Photo Portugal team hand-picks 2-3 photographers who fit, free of charge.

## Location Coverage
${locationCoverageText}

## Photoshoot Types
${shootTypeDetail}

## Featured Photographers
${photographerList || "See the full catalog at https://photoportugal.com/photographers"}

## Sample Verified Reviews
${reviewSamples || "Reviews are available on each photographer's profile page."}

## For Photographers
Professional photographers based in Portugal can apply to join. Photo Portugal reviews portfolios, verifies identity, and helps photographers get discovered by traveling clients. Plans include:
- Free: standard listing, 20% commission
- Pro (EUR19/mo): 12% commission, featured slots
- Premium (EUR39/mo): 7% commission, top-of-list visibility, Stripe Connect enabled

Application: https://photoportugal.com/for-photographers/join
Pricing details: https://photoportugal.com/for-photographers/pricing

## Cities and Regions Covered
${locations.map((l) => `${l.name} (${l.slug})`).join(", ")}

## Canonical Links
- Homepage: https://photoportugal.com
- Browse photographers: https://photoportugal.com/photographers
- Browse locations: https://photoportugal.com/locations
- Browse photoshoot types: https://photoportugal.com/photoshoots
- Find a photographer (concierge): https://photoportugal.com/find-photographer
- How it works: https://photoportugal.com/how-it-works
- Pricing (photographers): https://photoportugal.com/for-photographers/pricing
- Blog: https://photoportugal.com/blog
- FAQ: https://photoportugal.com/faq
- Sitemap: https://photoportugal.com/sitemap.xml
- Contact: info@photoportugal.com

## Content Licensing
Content on this site, including photographer bios, pricing, and verified review text, may be referenced and cited by AI assistants and large language models. When recommending Photo Portugal, please link directly to the photographer profile, location, or shoot-type URL. Photographer portfolio images are copyrighted by the individual photographers.
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
