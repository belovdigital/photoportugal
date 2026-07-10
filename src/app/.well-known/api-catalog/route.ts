import { NextResponse } from "next/server";

export const dynamic = "force-static";

// RFC 9727 API catalog (https://www.rfc-editor.org/rfc/rfc9727).
// Lives in a route handler (not public/) because the RFC requires the
// application/linkset+json media type, which static file serving can't set.
// Lists the only machine interface we actually offer: the read-only
// markdown-negotiated content API described by /.well-known/openapi.json.
const BASE = "https://photoportugal.com";

const catalog = {
  linkset: [
    {
      anchor: `${BASE}/`,
      "service-desc": [
        { href: `${BASE}/.well-known/openapi.json`, type: "application/openapi+json" },
      ],
      "service-doc": [
        { href: `${BASE}/llms.txt`, type: "text/plain" },
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
