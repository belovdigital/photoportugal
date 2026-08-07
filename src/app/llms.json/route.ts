import { NextResponse } from "next/server";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { queryOne } from "@/lib/db";
import { PLAN_PRICES } from "@/lib/stripe";
import { portugalCoverageStats } from "@/lib/location-coverage-stats";
import { country, byCountry } from "@/lib/country";
import { CHANNEL, MARKETS } from "@/lib/norteira/catalogue";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const channelLive = MARKETS[byCountry({ pt: "portugal", es: "spain", it: "italy" } as const)].enabled;
  let photographerCount = 0;
  const locationCount = portugalCoverageStats.places;
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
        (SELECT MIN(price) FROM packages pk JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id WHERE pp2.is_approved = TRUE AND pk.custom_for_user_id IS NULL) as min_price
      FROM photographer_profiles
      WHERE is_approved = TRUE`
    );
    if (stats) {
      photographerCount = parseInt(stats.photographer_count);
      reviewCount = parseInt(stats.review_count);
      avgRating = stats.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(2)) : 0;
      minPrice = stats.min_price ? parseFloat(stats.min_price) : null;
    }
  } catch (err) {
    console.error("[llms.json] DB error:", err);
  }

  const data = {
    // Brand and country come from the country pack. Hardcoding them meant
    // photospain.co/llms.json introduced itself to every agent as "Photo
    // Portugal ... across Portugal". The coverage counts above were always
    // per-market (LOCATION_TREE switches on COUNTRY) — only the labels lied.
    name: country.brand,
    url: country.baseUrl,
    description:
      `${country.brand} is a marketplace connecting travelers with professional vacation photographers across ${country.areaServed}. Travelers can browse verified photographer portfolios, read real reviews, compare prices, and book photoshoots online with instant confirmation. Photographers are vetted for quality and professionalism.`,
    photographer_count: photographerCount,
    location_count: locationCount,
    region_count: portugalCoverageStats.regions,
    review_count: reviewCount,
    avg_rating: avgRating,
    min_price_eur: minPrice,
    currency: "EUR",
    locations: locations.map((loc) => ({
      name: loc.name,
      slug: loc.slug,
      region: loc.region,
      url: `${country.baseUrl}/locations/${loc.slug}`,
    })),
    shoot_types: shootTypes.map((st) => ({
      name: st.name,
      slug: st.slug,
      url: `${country.baseUrl}/photoshoots/${st.slug}`,
    })),
    pricing: {
      photographer_plans: [
        { name: "Free", monthly_price_eur: PLAN_PRICES.free },
        { name: "Pro", monthly_price_eur: PLAN_PRICES.pro },
        { name: "Premium", monthly_price_eur: PLAN_PRICES.premium },
      ],
      client_session_prices: {
        starting_from_eur: minPrice ?? 150,
        typical_range_eur: "150-450",
        currency: "EUR",
      },
    },
    key_pages: {
      photographers: `${country.baseUrl}/photographers`,
      locations: `${country.baseUrl}/locations`,
      photoshoots: `${country.baseUrl}/photoshoots`,
      pricing: `${country.baseUrl}/for-photographers/pricing`,
      how_it_works: `${country.baseUrl}/how-it-works`,
      blog: `${country.baseUrl}/blog`,
      faq: `${country.baseUrl}/faq`,
      support: `${country.baseUrl}/support`,
    },
    languages: [...country.locales],
    country: country.areaServed,
    contact_email: country.supportEmail,
    ...(channelLive
      ? {
          agent_booking_api: {
            protocol: "mcp",
            name: CHANNEL.name,
            endpoint: CHANNEL.endpoint,
            transport: "streamable-http",
            authentication: "none",
            server_card: `${country.baseUrl}/.well-known/mcp.json`,
            documentation: CHANNEL.docs,
            tools: ["list_destinations", "get_photoshoot_quote", "create_photoshoot_booking"],
            scope: "Fixed-price blind booking. Per-photographer calendar availability is not exposed.",
          },
        }
      : {}),
  };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
