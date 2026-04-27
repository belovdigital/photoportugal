import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Estimated wall-clock duration of an AI generation. Used by the client to
 * drive a smooth fake-progress bar (0 → 95 % over expectedSec, hold, then
 * snap to 100 % on actual success). Hardcoded for now — observed median
 * for gpt-image-2 quality:medium, 1536×1024 is around 70-100 s.
 */
export async function GET() {
  return NextResponse.json({ expectedSec: 90 });
}
