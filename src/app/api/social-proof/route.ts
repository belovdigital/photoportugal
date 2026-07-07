import { NextRequest, NextResponse } from "next/server";
import { buildSocialProofFeed } from "@/lib/social-proof";

// Public, anonymized recent-activity feed for the social-proof toaster.
// All strings come back fully localized for ?locale=<en|pt|de|es|fr>.
// Cached briefly at the edge — the feed is a rolling window, not real-time,
// so a couple of minutes of staleness is fine and keeps DB load near zero.
export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") || "en";
  try {
    const events = await buildSocialProofFeed(locale);
    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[social-proof] feed build failed:", err);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
