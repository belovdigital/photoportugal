import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";

interface Row {
  session_id: string;
  scene_id: string;
  status: string;
  result_image_key: string | null;
}

/**
 * GET /api/ai-generate/[id]/download
 *
 * Streams the generated image with a Content-Disposition: attachment header so
 * the browser triggers a real download. We can't use <a download> on the
 * direct R2 url because it's a different origin (files.photoportugal.com vs
 * photoportugal.com) and the download attribute is ignored cross-origin.
 *
 * Authorisation by the same ai_session cookie as the polling endpoint — only
 * the session that produced the image can download it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const sessionId = req.cookies.get("ai_session")?.value || null;
  if (!sessionId) return NextResponse.json({ error: "no session" }, { status: 403 });

  const row = await queryOne<Row>(
    "SELECT session_id, scene_id, status, result_image_key FROM ai_generations WHERE id = $1",
    [id]
  );
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.session_id !== sessionId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (row.status !== "success" || !row.result_image_key) {
    return NextResponse.json({ error: "not ready" }, { status: 409 });
  }

  const upstream = await fetch(`${PUBLIC_URL}/${row.result_image_key}`);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }

  const filename = `photoportugal-${row.scene_id}.png`;
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
