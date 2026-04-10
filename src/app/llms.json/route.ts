import { NextResponse } from "next/server";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { query, queryOne } from "@/lib/db";
import { PLAN_PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  let photographerCount = 0;
  let locationCount = locations.length;
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
      avgRating = stats.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(2)) : 0;
      minPrice = stats.min_price ? parseFloat(stats.min_price) : null;
    }
  } catch (err) {
    console.error("[llms.json] DB error:", err);
  }

  const data = {
    name: "Photo Portugal",
    url: "https://photoportugal.com",
    description:
      "Photo Portugal is a marketplace connecting travelers with professional vacation photographers across Portugal. Travelers can browse verified photographer portfolios, read real reviews, compare prices, and book photoshoots online with instant confirmation. Photographers are vetted for quality and professionalism.",
    photographer_count: photographerCount,
    location_count: locationCount,
    review_count: reviewCount,
    avg_rating: avgRating,
    min_price_eur: minPrice,
    currency: "EUR",
    locations: locations.map((loc) => ({
      name: loc.name,
      slug: loc.slug,
      region: loc.region,
      url: `https://photoportugal.com/locations/${loc.slug}`,
    })),
    shoot_types: shootTypes.map((st) => ({
      name: st.name,
      slug: st.slug,
      url: `https://photoportugal.com/photoshoots/${st.slug}`,
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
      photographers: "https://photoportugal.com/photographers",
      locations: "https://photoportugal.com/locations",
      photoshoots: "https://photoportugal.com/photoshoots",
      pricing: "https://photoportugal.com/for-photographers/pricing",
      how_it_works: "https://photoportugal.com/how-it-works",
      blog: "https://photoportugal.com/blog",
      faq: "https://photoportugal.com/faq",
    },
    languages: ["en", "pt"],
    country: "Portugal",
    contact_email: "info@photoportugal.com",
  };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
