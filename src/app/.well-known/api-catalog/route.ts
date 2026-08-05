import { NextResponse } from "next/server";
import { country } from "@/lib/country";
import { CHANNEL, MARKETS } from "@/lib/norteira/catalogue";

export const dynamic = "force-static";

// RFC 9727 API catalog (https://www.rfc-editor.org/rfc/rfc9727).
// Lives in a route handler (not public/) because the RFC requires the
// application/linkset+json media type, which static file serving can't set.
// Lists the machine interfaces we actually offer: the read-only
// markdown-negotiated content API described by /.well-known/openapi.json,
// and — where the market is live in the channel — the Norteira MCP endpoint
// that can transact, not just read.
const BASE = country.baseUrl;
const CHANNEL_LIVE = MARKETS[country.code === "es" ? "spain" : "portugal"].enabled;

const catalog = {
  linkset: [
    {
      anchor: `${BASE}/`,
      "service-desc": [
        { href: `${BASE}/.well-known/openapi.json`, type: "application/openapi+json" },
        // The MCP card, not the endpoint itself: a GET on the endpoint speaks
        // no HTML and no JSON schema, so pointing a discovery crawler straight
        // at it would advertise a link that looks broken.
        ...(CHANNEL_LIVE
          ? [{ href: `${BASE}/.well-known/mcp.json`, type: "application/json" }]
          : []),
      ],
      "service-doc": [
        { href: `${BASE}/llms.txt`, type: "text/plain" },
        ...(CHANNEL_LIVE ? [{ href: CHANNEL.docs, type: "text/html" }] : []),
      ],
      status: [{ href: `${BASE}/api/health` }],
    },
  ],
};

export async function GET() {
  return NextResponse.json(catalog, {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
