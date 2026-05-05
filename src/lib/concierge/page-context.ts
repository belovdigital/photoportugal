// Derive a structured page-context object from the current route. The drawer
// passes this to ConciergeChat so the first message + chips can be tailored
// to the page the visitor is on (no "How can I help?" greeting when the URL
// already says they're looking at Madeira).
//
// Pure function — runs client-side, uses static data lookups only.

import { locations as ALL_LOCATIONS } from "@/lib/locations-data";
import { shootTypes as ALL_SHOOT_TYPES } from "@/lib/shoot-types-data";

export type PageContextType =
  | "homepage"
  | "location"
  | "location_occasion"
  | "occasion"
  | "photographer_profile"
  | "booking_flow"
  | "blog"
  | "catalog"
  | "spot"
  | "unknown";

export interface PageContext {
  type: PageContextType;
  pathname: string;
  location?: { slug: string; name: string };
  occasion?: { slug: string; name: string };
  photographerSlug?: string;
  spotSlug?: string;
  blogSlug?: string;
}

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(pt|de|es|fr)(?=\/|$)/, "") || "/";
}

export function derivePageContext(pathname: string): PageContext {
  const stripped = stripLocale(pathname);

  if (stripped === "/") return { type: "homepage", pathname };

  const bookMatch = stripped.match(/^\/book\/([^/?#]+)/);
  if (bookMatch) {
    return { type: "booking_flow", pathname, photographerSlug: bookMatch[1] };
  }

  const photoMatch = stripped.match(/^\/photographers\/([^/?#]+)/);
  if (photoMatch && photoMatch[1] !== "page") {
    return { type: "photographer_profile", pathname, photographerSlug: photoMatch[1] };
  }
  if (stripped === "/photographers") {
    return { type: "catalog", pathname };
  }

  // /locations/<slug>/<occasion> — location-occasion combo page
  const locOccMatch = stripped.match(/^\/locations\/([^/?#]+)\/([^/?#]+)/);
  if (locOccMatch) {
    const loc = ALL_LOCATIONS.find((l) => l.slug === locOccMatch[1]);
    const occ = ALL_SHOOT_TYPES.find((s) => s.slug === locOccMatch[2]);
    if (loc && occ) {
      return {
        type: "location_occasion",
        pathname,
        location: { slug: loc.slug, name: loc.name },
        occasion: { slug: occ.slug, name: occ.name },
      };
    }
    if (loc) {
      return { type: "location", pathname, location: { slug: loc.slug, name: loc.name } };
    }
  }

  const locMatch = stripped.match(/^\/locations\/([^/?#]+)/);
  if (locMatch) {
    const loc = ALL_LOCATIONS.find((l) => l.slug === locMatch[1]);
    if (loc) {
      return { type: "location", pathname, location: { slug: loc.slug, name: loc.name } };
    }
  }
  if (stripped === "/locations") {
    return { type: "unknown", pathname };
  }

  const photoshootMatch = stripped.match(/^\/photoshoots\/([^/?#]+)/);
  if (photoshootMatch) {
    const occ = ALL_SHOOT_TYPES.find((s) => s.slug === photoshootMatch[1]);
    if (occ) {
      return { type: "occasion", pathname, occasion: { slug: occ.slug, name: occ.name } };
    }
  }

  const spotMatch = stripped.match(/^\/spots\/([^/?#]+)\/([^/?#]+)/);
  if (spotMatch) {
    const loc = ALL_LOCATIONS.find((l) => l.slug === spotMatch[1]);
    return {
      type: "spot",
      pathname,
      location: loc ? { slug: loc.slug, name: loc.name } : undefined,
      spotSlug: spotMatch[2],
    };
  }

  const blogMatch = stripped.match(/^\/blog\/([^/?#]+)/);
  if (blogMatch) {
    return { type: "blog", pathname, blogSlug: blogMatch[1] };
  }

  return { type: "unknown", pathname };
}

/** A short server-prompt-friendly description so the AI sees it as text. */
export function pageContextToPromptString(ctx: PageContext): string {
  switch (ctx.type) {
    case "homepage":
      return "User is on the Photo Portugal homepage.";
    case "location":
      return `User is on the location page for ${ctx.location?.name} (${ctx.location?.slug}). Treat ${ctx.location?.name} as their preferred location unless they say otherwise.`;
    case "location_occasion":
      return `User is on the ${ctx.location?.name} ${ctx.occasion?.name} combo page. Treat both location=${ctx.location?.slug} and occasion=${ctx.occasion?.slug} as confirmed unless they say otherwise — go straight to show_matches.`;
    case "occasion":
      return `User is on the ${ctx.occasion?.name} shoot type page (${ctx.occasion?.slug}). Treat ${ctx.occasion?.name} as their occasion unless they say otherwise.`;
    case "photographer_profile":
      return `User is viewing photographer profile: ${ctx.photographerSlug}. They are considering THIS photographer. Help them decide / compare / check availability rather than recommending a generic match.`;
    case "booking_flow":
      return `User is in the booking checkout for photographer ${ctx.photographerSlug}. Help them finalise — answer package, date, payment, cancellation questions. Do NOT push them to switch photographers unless they explicitly want a different one.`;
    case "catalog":
      return "User is browsing the photographers catalog. They likely want help narrowing down.";
    case "blog":
      return `User is reading blog post: ${ctx.blogSlug}. They may be inspired by it and ready to plan a real shoot in that location/style.`;
    case "spot":
      return `User is on a spot page in ${ctx.location?.name || "Portugal"} (spot=${ctx.spotSlug}). They are interested in shooting at this exact spot.`;
    case "unknown":
    default:
      return "User opened the concierge from a page that doesn't carry strong context.";
  }
}
