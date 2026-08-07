import { NextResponse } from "next/server";
import { country, byCountry } from "@/lib/country";
import { MARKETS, bookableDestinations, enabledMarkets, CHANNEL } from "@/lib/norteira/catalogue";

export const dynamic = "force-dynamic";

/**
 * MCP server card.
 *
 * We built the endpoint and then left it undiscoverable: an agent had to be
 * told the URL by a human. This is the file agent-readiness checkers look
 * for, and the one an MCP client reads to find out that a booking tool
 * exists here at all.
 *
 * The card is served from each country site but advertises the UMBRELLA
 * address, not this site's own /api/mcp. Both resolve to the same handler;
 * publishing the umbrella one means the address an agent caches stays valid
 * when markets come and go.
 *
 * Deliberately describes the tools in prose as well as by name — a model
 * deciding whether to connect reads this before it can call `tools/list`.
 */
export function GET() {
  // Only advertise the server on a domain whose own market it can book.
  // Spain is switched off in the catalogue until it has a roster, and a card
  // on photospain.co offering Portuguese destinations would be worse than no
  // card. Flipping that flag publishes this too.
  const thisMarket = MARKETS[byCountry({ pt: "portugal", es: "spain", it: "italy" } as const)];
  if (!thisMarket.enabled) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const countries = enabledMarkets().map((m) => m.country);
  const destinations = bookableDestinations().length;

  return NextResponse.json(
    {
      name: CHANNEL.name,
      description:
        `Book a professional holiday photographer in ${countries.join(" and ")}. ` +
        `Quote and reserve a photoshoot in ${destinations} destinations: the traveller gives a place, ` +
        `a date and an occasion, pays one all-in price, and a photographer is hand-picked within 24 hours.`,
      version: "0.1.0",
      vendor: { name: country.brand, url: country.baseUrl },
      // Streamable HTTP, POST-only: the server never pushes, so it offers no
      // server-initiated event stream.
      endpoint: CHANNEL.endpoint,
      transport: "streamable-http",
      authentication: { type: "none" },
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        { name: "list_destinations", description: "Every place a photoshoot can currently be booked in." },
        { name: "get_photoshoot_quote", description: "The exact all-in price for a place, date, occasion, length and party size." },
        { name: "create_photoshoot_booking", description: "Creates the booking and returns a secure checkout link." },
      ],
      documentation: CHANNEL.docs,
      contact: country.supportEmail,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
