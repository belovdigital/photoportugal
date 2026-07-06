import { NextResponse } from "next/server";
import { buildLlmsText } from "@/lib/llms-text";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const text = await buildLlmsText();
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
