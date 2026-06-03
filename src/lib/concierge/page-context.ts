// Derive a structured page-context object from the current route. The drawer
// passes this to ConciergeChat so the first message + chips can be tailored
// to the page the visitor is on (no "How can I help?" greeting when the URL
// already says they're looking at Madeira).
//
// Pure function — runs client-side, uses static data lookups only.

import { locations as ALL_LOCATIONS } from "@/lib/locations-data";
import { shootTypes as ALL_SHOOT_TYPES } from "@/lib/shoot-types-data";
import { photoSpots, spotSlug as makeSpotSlug } from "@/lib/photo-spots-data";

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
  /** When type=="blog", topic derived from the post (location + shoot type).
   *  Lets the concierge respond contextually instead of generically:
   *  "you're reading about Algarve photo spots — want cliff/beach/cave vibe?"
   *  rather than "tell me where in Portugal you're going." */
  blogTopic?: { locationSlug?: string; locationName?: string; shootTypeSlug?: string; shootTypeName?: string };
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
    case "blog": {
      const topic = ctx.blogTopic;
      let topicLine = "";
      if (topic?.locationName && topic?.shootTypeName) {
        topicLine = ` The post focuses on **${topic.shootTypeName} in ${topic.locationName}** (location_slug=${topic.locationSlug}, occasion_slug=${topic.shootTypeSlug}). Treat these as the likely context — if the visitor asks "where should I shoot" or "find me a photographer" without naming a place, lean into ${topic.locationName} first.`;
      } else if (topic?.locationName) {
        topicLine = ` The post is about **${topic.locationName}** (location_slug=${topic.locationSlug}). Treat that location as the most likely intent.`;
      } else if (topic?.shootTypeName) {
        topicLine = ` The post is about **${topic.shootTypeName}** (occasion_slug=${topic.shootTypeSlug}). Treat that shoot type as the most likely intent.`;
      }
      return `User is reading blog post: ${ctx.blogSlug}. They may be inspired by it and ready to plan a real shoot in that location/style.${topicLine}`;
    }
    case "spot": {
      // Look up the actual spot in photo-spots-data so Lens has its name
      // and 1-line description, not just the slug. This way "what's the
      // best time to shoot here" + "any other Sintra spots" can be
      // answered concretely without an extra round-trip to the model.
      const cityKey = ctx.location?.slug;
      const spotData = cityKey && ctx.spotSlug
        ? (photoSpots[cityKey] || []).find((s) => makeSpotSlug(s.name) === ctx.spotSlug)
        : undefined;
      const spotName = spotData?.name || ctx.spotSlug;
      const spotDesc = spotData?.description ? ` — ${spotData.description}` : "";
      const cityName = ctx.location?.name || "Portugal";
      return `User is on the spot page for **${spotName}** in ${cityName}${spotDesc}. They're considering shooting at this exact landmark. When they ask "best time", "where exactly", "is it open" — answer using the spot's known info. If they ask "what other places nearby" — recommend other spots in ${cityName} via show_spots. When they're ready for a photographer, call show_matches for ${cityName}.`;
    }
    case "unknown":
    default:
      return "User opened the concierge from a page that doesn't carry strong context.";
  }
}
