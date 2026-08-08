import { NextResponse } from "next/server";
import { country, byCountry } from "@/lib/country";
import { MARKETS } from "@/lib/norteira/catalogue";

// Root alias — the Cloudflare agent-readiness checker requests /auth.md at
// the site root (workos auth.md convention); /.well-known/auth.md stays for
// tools that look there instead.
// auth.md — the agent-readable answer to "how do I authenticate here?".
// The honest answer for this site is mostly "you don't": public content is
// open, and the MCP server (where enabled) takes blind-booking requests
// without an account. Saying that explicitly beats a 404, which reads as
// "nobody thought about agents".
export const dynamic = "force-static";

export function GET() {
  const market = MARKETS[byCountry({ pt: "portugal", es: "spain", it: "italy" } as const)];
  const mcpSection = market.enabled
    ? `## MCP server

\`${country.baseUrl}/api/mcp\` (Streamable HTTP). No authentication required.
Read-only catalogue tools plus a blind-booking flow: the traveller supplies a
destination, date and occasion, pays one all-in price by card, and a
photographer is hand-picked within 24 hours. Server card:
\`${country.baseUrl}/.well-known/mcp.json\`.
`
    : `## MCP server

Not yet enabled on this market. The server card at
\`/.well-known/mcp.json\` returns 404 until there is a bookable roster here.
`;

  const body = `# Authentication — ${country.brand}

## Public content

Everything under ${country.baseUrl} that a signed-out visitor can see is open
to agents with no authentication: photographer profiles, locations, packages,
prices, the blog and the FAQ. Key pages also serve markdown via content
negotiation (\`Accept: text/markdown\`), and a site overview lives at
[/llms.txt](${country.baseUrl}/llms.txt).

Usage terms are declared as Content Signals in
[/robots.txt](${country.baseUrl}/robots.txt): search yes, ai-input yes,
ai-train no.

${mcpSection}
## OAuth

None. There is no OAuth/OIDC provider on this domain; the absence of
\`/.well-known/oauth-authorization-server\` metadata is deliberate, not an
omission. Client and photographer dashboards are session-based and not
intended for agent access.

## Contact

Questions about agent access: ${country.supportEmail}
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
