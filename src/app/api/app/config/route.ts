import { NextResponse } from "next/server";
import { country } from "@/lib/country";
import { LOCATION_TREE, flattenLocationNodes, type LocationNode } from "@/lib/location-hierarchy";

export const runtime = "nodejs";
// Public, market-specific, and slow-changing. The mobile app fetches it once
// per market per device and caches it, so it must not depend on auth or the
// database — it is built entirely from the country pack and the location tree,
// both compiled into this deployment.
export const dynamic = "force-static";
export const revalidate = 3600;

// Strip the web tree's extra fields (type, legacySlugs) down to what the app
// renders. Extra keys would just be dead weight in every payload.
function toAppNode(n: LocationNode): { slug: string; name: string; children?: { slug: string; name: string }[] } {
  return {
    slug: n.slug,
    name: n.name,
    ...(n.children?.length ? { children: n.children.map(toAppNode) } : {}),
  };
}

/**
 * Everything the app needs about the market it is pointed at, except the
 * address it fetched this from. Mirrors src/lib/country.ts so the two cannot
 * drift — the app bundles none of this.
 */
export async function GET() {
  const portfolioLocations = flattenLocationNodes(LOCATION_TREE)
    .filter((n) => n.type === "city")
    .map((n) => ({ slug: n.slug, name: n.name }));

  return NextResponse.json({
    // Echoed so the app can assert the host it asked answered for the market
    // it expected — a CDN/DNS misroute must fail loudly, not silently
    // configure the app for the wrong database.
    code: country.code,
    brand: country.brand,
    countryName: country.countryName,
    countryIn: country.countryIn,
    locales: country.locales,
    dialCode: country.dialCode,
    phonePlaceholder: country.phonePlaceholder,
    contactLanguages: country.contactLanguages,
    supportEmail: country.supportEmail,
    areaServed: country.areaServed,
    primaryLocationSlug: country.defaultRegionSlug,
    locationTree: LOCATION_TREE.map(toAppNode),
    portfolioLocations,
    legal: {
      support: `${country.baseUrl}/support`,
      terms: `${country.baseUrl}/terms`,
      privacy: `${country.baseUrl}/privacy`,
    },
  });
}
