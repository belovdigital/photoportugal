import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight portfolio fetch used by the on-card lightbox modal.
 * Only returns photos (no videos) and only the URL + caption — keeps the
 * payload small enough to load on-click without noticeable delay.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  }

  // The lightbox must show the same body of work the card was showing. A card
  // under the catalog's Business filter carries corporate photos, so opening
  // it full-screen has to stay in that set — the default (leisure) would swap
  // the gallery out from under the visitor.
  const scope = req.nextUrl.searchParams.get("scope") === "business" ? "business" : "leisure";
  const scopeSql = scope === "business"
    ? "lower(pi.shoot_type) = 'business'"
    : "COALESCE(lower(pi.shoot_type), '') <> 'business'";

  const rows = await query<{ url: string; caption: string | null }>(
    `SELECT pi.url, pi.caption
     FROM portfolio_items pi
     JOIN photographer_profiles pp ON pp.id = pi.photographer_id
     WHERE pp.slug = $1 AND pi.type = 'photo' AND ${scopeSql}
     ORDER BY pi.sort_order NULLS LAST, pi.created_at
     LIMIT 40`,
    [slug],
  ).catch(() => []);

  return NextResponse.json(
    { items: rows },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
  );
}
