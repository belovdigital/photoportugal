import { NextResponse } from "next/server";

// Route handler instead of the metadata robots.ts convention because
// MetadataRoute.Robots can't emit Content-Signal directives
// (https://contentsignals.org/) — the agent-readiness signal that tells AI
// crawlers what they may do with the content.

// Private/transactional routes — disallow English + every locale prefix
// explicitly. The pages already noindex via metadata, but a robots.txt
// disallow saves Google's crawl budget on URLs that will never return
// indexable content.
const PRIVATE_PATHS = ["/dashboard/", "/api/", "/auth/", "/book/", "/delivery/", "/gift/claim", "/gift-card/claim", "/gift-cards/success", "/try-yourself"];
const LOCALES = ["pt", "de", "es", "fr"];

const disallow = [
  ...PRIVATE_PATHS,
  ...LOCALES.flatMap((l) => PRIVATE_PATHS.map((p) => `/${l}${p}`)),
];

export const dynamic = "force-static";

export function GET() {
  const text = `# Photo Portugal — https://photoportugal.com
# AI agents: site overview at https://photoportugal.com/llms.txt
# Key public pages also serve markdown via content negotiation (Accept: text/markdown)

# Content Signals (https://contentsignals.org/):
#   search   = yes  — index and link to this content in search results
#   ai-input = yes  — AI assistants may use this content to answer user queries
#   ai-train = no   — do not train models on it (portfolio photos are the
#                     photographers' copyright)

User-Agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /
${disallow.map((p) => `Disallow: ${p}`).join("\n")}

Sitemap: https://photoportugal.com/sitemap.xml
Sitemap: https://photoportugal.com/sitemap-images.xml
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
