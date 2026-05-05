// Context-aware first message + chip set rendered the moment the drawer
// opens on a non-empty conversation. Replaces the generic 5-second shy
// nudge for pages where the URL already tells us where the visitor is.
//
// Strings are EN-only for v1. Localisation pass will move them into
// messages/{locale}.json under concierge.intros.<key>.
//
// Chips auto-send on click — pick wording the AI can act on directly
// (e.g. "Surprise!" → AI knows occasion sub-flavor; "Compare with similar"
// → AI calls show_matches with peers).

import type { PageContext } from "@/lib/concierge/page-context";

export interface IntroTemplate {
  /** Markdown-light first message body. */
  message: string;
  /** Drilldown + action chips. Click → auto-send as user message. Order
   *  is the order they render in. Keep ≤5 to avoid mobile crowding. */
  chips: string[];
}

/** Return the intro template for the given page context, or null when
 *  the context is too thin (homepage / unknown) — caller falls back to
 *  the existing 5-second shy nudge. */
export function getIntroTemplate(ctx: PageContext): IntroTemplate | null {
  switch (ctx.type) {
    case "location_occasion": {
      const loc = ctx.location!.name;
      const occ = ctx.occasion!.name.toLowerCase();
      // Both location AND occasion are confirmed — skip clarifying questions
      // entirely, ask only about timing.
      return {
        message: `Hi! I'm Lens 👋 — a ${occ} shoot in ${loc} sounds gorgeous. When are you thinking?`,
        chips: [
          "Within a month",
          "2–3 months out",
          "Later this year",
          "Date is set",
          "Show me photographers now",
        ],
      };
    }

    case "location": {
      const loc = ctx.location!.name;
      const slug = ctx.location!.slug;
      // Special-case Azores group page — guide to island choice.
      if (slug === "azores") {
        return {
          message: `Hi! I'm Lens 👋 — Azores has 9 islands, each with its own vibe 🌋. Have you picked one, or want help choosing?`,
          chips: [
            "São Miguel",
            "Pico",
            "Faial",
            "Help me choose",
            "I'm flexible",
          ],
        };
      }
      if (slug === "madeira") {
        return {
          message: `Hi! I'm Lens 👋 — Madeira is stunning 🌋. What's the occasion?`,
          chips: ["Couples", "Family", "Honeymoon", "Solo", "Just exploring"],
        };
      }
      if (slug === "algarve") {
        return {
          message: `Hi! I'm Lens 👋 — the Algarve cliffs at sunset are unreal. What kind of shoot are you planning?`,
          chips: ["Couples", "Family", "Proposal 💍", "Honeymoon", "Just exploring"],
        };
      }
      // Generic location intro
      return {
        message: `Hi! I'm Lens 👋 — ${loc} is a great pick. What's the occasion?`,
        chips: ["Couples", "Family", "Proposal 💍", "Solo", "Just exploring"],
      };
    }

    case "occasion": {
      const occ = ctx.occasion!.name;
      const slug = ctx.occasion!.slug;
      if (slug === "proposal") {
        return {
          message: `Hi! I'm Lens 👋 — proposals are my favorite 💍. Is it a surprise, planned together, or already set? And where in Portugal?`,
          chips: ["Surprise!", "Planned together", "Lisbon", "Algarve", "Sintra"],
        };
      }
      if (slug === "wedding") {
        return {
          message: `Hi! I'm Lens 👋 — wedding shoots in Portugal, beautiful. Where are you tying the knot?`,
          chips: ["Lisbon", "Sintra", "Douro Valley", "Algarve", "Help me decide"],
        };
      }
      if (slug === "elopement") {
        return {
          message: `Hi! I'm Lens 👋 — elopements are intimate magic. Where in Portugal calls to you?`,
          chips: ["Sintra", "Douro Valley", "Madeira", "Algarve cliffs", "Help me choose"],
        };
      }
      if (slug === "honeymoon") {
        return {
          message: `Hi! I'm Lens 👋 — honeymoon shoots in Portugal, fantastic. Beach vibes or mountain magic?`,
          chips: ["Beach (Algarve)", "Madeira", "Comporta", "Sintra forests", "Help me decide"],
        };
      }
      // Generic occasion intro
      return {
        message: `Hi! I'm Lens 👋 — ${occ.toLowerCase()} shoots in Portugal — where are you headed?`,
        chips: ["Lisbon", "Algarve", "Sintra", "Porto", "Not sure yet"],
      };
    }

    case "photographer_profile": {
      // Photographer name not resolved client-side (would need DB lookup).
      // Use generic phrasing — still useful, more friendly than shy nudge.
      return {
        message: `Hi! I'm Lens 👋 — considering this photographer? I can help you decide or compare with similar pros.`,
        chips: [
          "Compare with similar",
          "Check availability",
          "Tell me more about their style",
          "Find a different photographer",
        ],
      };
    }

    case "booking_flow": {
      return {
        message: `Hi! I'm Lens 👋 — need a hand finalising? I can clarify the package, date, payment or anything else.`,
        chips: [
          "What's included?",
          "Different date?",
          "Cancellation policy",
          "Different photographer",
        ],
      };
    }

    case "catalog": {
      return {
        message: `Hi! I'm Lens 👋 — 50+ photographers can be a lot. Tell me what you need and I'll narrow it down to 3.`,
        chips: [
          "Find photographers for me",
          "Help me choose location",
          "Couples shoot",
          "Family shoot",
          "Compare prices",
        ],
      };
    }

    case "blog": {
      // Without resolving the blog post topic client-side, we use a
      // generic blog intro. Could be enhanced later to use deriveBlogTopic.
      return {
        message: `Hi! I'm Lens 👋 — inspired by what you're reading? I can match you with a photographer who knows these spots firsthand.`,
        chips: [
          "Find photographers for me",
          "Couples shoot",
          "Family shoot",
          "Plan around these spots",
        ],
      };
    }

    case "spot": {
      const loc = ctx.location?.name;
      return {
        message: loc
          ? `Hi! I'm Lens 👋 — that's a beautiful spot in ${loc}. Want me to find a photographer who shoots there?`
          : `Hi! I'm Lens 👋 — beautiful spot. Want me to find a photographer who shoots there?`,
        chips: [
          "Yes, find photographers",
          "Tell me more about this spot",
          "Best time of day?",
          "Different location",
        ],
      };
    }

    case "homepage":
    case "unknown":
    default:
      // Caller falls back to the existing 5-second shy nudge — generic
      // intros here would dilute that flow.
      return null;
  }
}
