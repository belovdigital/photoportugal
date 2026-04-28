import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";

interface Row {
  id: string;
  session_id: string;
  scene_id: string;
  status: string;
  result_image_key: string | null;
  result_image_keys: string[] | null;
  error: string | null;
}

/**
 * GET /api/ai-generate/[id]
 * Polling endpoint: returns current status of a generation kicked off via POST.
 * Authorisation is by session cookie — only the session that started the
 * generation can read its result.
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
  if (!sessionId) {
    return NextResponse.json({ error: "no session" }, { status: 403 });
  }

  const row = await queryOne<Row>(
    "SELECT id, session_id, scene_id, status, result_image_key, result_image_keys, error FROM ai_generations WHERE id = $1",
    [id]
  );
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.session_id !== sessionId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // New rows have result_image_keys (4 variants); legacy rows just result_image_key.
  const keys = row.result_image_keys && row.result_image_keys.length > 0
    ? row.result_image_keys
    : (row.result_image_key ? [row.result_image_key] : []);

  return NextResponse.json({
    id: row.id,
    status: row.status,
    image_url: keys[0] ? `${PUBLIC_URL}/${keys[0]}` : null, // legacy field — first photo
    image_urls: keys.map((k) => `${PUBLIC_URL}/${k}`),
    scene_id: row.scene_id,
    error: row.error,
  });
}
