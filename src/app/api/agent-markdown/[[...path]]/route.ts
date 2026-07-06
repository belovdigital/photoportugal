import { NextResponse } from "next/server";
import { buildLlmsText } from "@/lib/llms-text";
import {
  photographersMarkdown,
  photographerProfileMarkdown,
  locationsMarkdown,
  locationMarkdown,
  photoshootsMarkdown,
  photoshootMarkdown,
} from "@/lib/agent-markdown";

export const dynamic = "force-dynamic";

// Markdown for Agents (content negotiation). The middleware rewrites public
// page requests carrying `Accept: text/markdown` here with the canonical EN
// path appended (e.g. /api/agent-markdown/photographers/<slug>). The page
// path travels in the URL path, NOT a query param: query params added by a
// middleware rewrite don't survive to the route handler (the original
// request's own — empty — query wins). The visible URL stays the page's own
// URL; robots.txt's /api/ disallow doesn't apply to internal rewrites.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const segments = (await params).path || [];
  const path = "/" + segments.join("/");

  let markdown: string | null = null;
  if (path === "/") {
    markdown = await buildLlmsText();
  } else if (path === "/photographers") {
    markdown = await photographersMarkdown();
  } else if (path === "/locations") {
    markdown = await locationsMarkdown();
  } else if (path === "/photoshoots") {
    markdown = await photoshootsMarkdown();
  } else {
    const m = path.match(/^\/(photographers|locations|photoshoots)\/([a-z0-9-]+)$/);
    if (m) {
      const [, section, slug] = m;
      if (section === "photographers") markdown = await photographerProfileMarkdown(slug);
      else if (section === "locations") markdown = await locationMarkdown(slug);
      else markdown = await photoshootMarkdown(slug);
    }
  }

  if (!markdown) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Accept" },
    });
  }

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      Vary: "Accept",
      "X-Robots-Tag": "noindex",
    },
  });
}
