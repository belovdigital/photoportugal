import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// POST /api/revalidate?secret=<CRON_SECRET>&path=/photographers/slug
//
// On-demand ISR revalidation for pages changed by direct DB edits (manual
// SQL imports, admin scripts run over psql). The admin API routes call
// revalidatePath() themselves — this exists for everything that bypasses
// them. Revalidates the bare path AND all locale variants, mirroring how
// profile pages are cached per locale (ISR 24h).
const LOCALES = ["pt", "de", "es", "fr"];

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const path = req.nextUrl.searchParams.get("path") || "";
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "path must start with /" }, { status: 400 });
  }
  const revalidated = [path, ...LOCALES.map((l) => `/${l}${path === "/" ? "" : path}`)];
  for (const p of revalidated) revalidatePath(p);
  return NextResponse.json({ revalidated });
}
