import { NextResponse } from "next/server";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { queryOne } from "@/lib/db";

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

  const locationNames = locations.map((l) => l.name).join(", ");
  const shootTypeNames = shootTypes.map((st) => st.name).join(", ");

  const text = `# Photo Portugal
> Professional vacation photography marketplace in Portugal

## What is Photo Portugal?
Photo Portugal connects travelers with vetted professional photographers across Portugal. Travelers browse portfolios, read verified reviews, compare prices, and book photoshoots online with instant confirmation.

## Key Facts
- ${photographerCount} approved photographers
- ${locations.length} locations across Portugal
- ${reviewCount} verified reviews
- Average rating: ${avgRating}/5
- Sessions starting from EUR${minPrice ?? 150}
- Languages: English, Portuguese

## Locations
${locationNames}

## Photoshoot Types
${shootTypeNames}

## How It Works
1. Browse photographer profiles filtered by location, shoot type, and budget
2. Book instantly online with secure Stripe payments
3. Meet your photographer at the chosen location for a relaxed session
4. Receive professionally edited photos in a private online gallery within 1-3 weeks

## Pricing
- Client sessions start from EUR${minPrice ?? 150}
- Typical session range: EUR150-450
- Photographers can join free or subscribe to Pro/Premium plans for better visibility

## Links
- Website: https://photoportugal.com
- Photographers: https://photoportugal.com/photographers
- Locations: https://photoportugal.com/locations
- How It Works: https://photoportugal.com/how-it-works
- Pricing: https://photoportugal.com/for-photographers/pricing
- Blog: https://photoportugal.com/blog
- FAQ: https://photoportugal.com/faq
- Contact: info@photoportugal.com
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
