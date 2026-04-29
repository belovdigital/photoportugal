import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getScene } from "@/lib/ai-scenes";

export const dynamic = "force-dynamic";

const PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";

// Free quota WITHOUT email; quota WITH email; absolute hard cap per session+ip per day.
const FREE_NO_EMAIL = 1;
const FREE_WITH_EMAIL = 3;

// Mirror of UNLIMITED_USER_IDS in the POST route — staff/test accounts.
const UNLIMITED_USER_IDS = new Set([
  "1fe40315-bd00-4530-a6be-39fa970617bd", // Kate Belova
]);

interface UsageRow {
  total_count: string;
  has_email_count: string;
  email: string | null;
}

interface LatestRow {
  id: string;
  scene_id: string;
  result_image_key: string | null;
  result_image_keys: string[] | null;
  result_scene_ids: string[] | null;
}

async function fetchLatestResult(sessionId: string | null, ip: string | null) {
  if (!sessionId && !ip) return null;
  const row = await queryOne<LatestRow>(
    `SELECT id, scene_id, result_image_key, result_image_keys, result_scene_ids
     FROM ai_generations
     WHERE ((session_id = $1 AND $1 IS NOT NULL) OR (ip = $2 AND $2 IS NOT NULL))
       AND status = 'success'
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId, ip]
  );
  if (!row) return null;
  const keys = row.result_image_keys && row.result_image_keys.length > 0
    ? row.result_image_keys
    : (row.result_image_key ? [row.result_image_key] : []);
  if (keys.length === 0) return null;
  const sceneIds = row.result_scene_ids && row.result_scene_ids.length === keys.length
    ? row.result_scene_ids
    : keys.map(() => row.scene_id);
  const scene = getScene(row.scene_id);
  return {
    gen_id: row.id,
    scene_id: row.scene_id,
    image_urls: keys.map((k) => `${PUBLIC_URL}/${k}`),
    scene_ids: sceneIds,
    concierge_loc: scene?.conciergeLoc || "",
  };
}

/**
 * Returns how many generations remain for the current session+ip combo,
 * and which email is on file (if any). Used by the client to decide
 * whether to show the email-capture step before the next generation.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("ai_session")?.value || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  let unlimited = false;
  try {
    const session = await auth();
    const uid = (session?.user as { id?: string } | undefined)?.id;
    if (uid && UNLIMITED_USER_IDS.has(uid)) unlimited = true;
  } catch { /* anon */ }

  if (unlimited) {
    const latest_result = await fetchLatestResult(sessionId, ip);
    return NextResponse.json({
      used: 0,
      free_no_email: 999,
      free_with_email: 999,
      remaining: 999,
      email: null,
      requires_email: false,
      blocked: false,
      unlimited: true,
      latest_result,
    });
  }

  // Auto-fail any "pending" rows older than 10 min — they can't be in flight any more
  // (gpt-image-2 max ~3-4 min, plus a deploy or process restart kills the unawaited
  // Promise mid-flight). Without this, those rows count toward quota forever.
  await query(
    "UPDATE ai_generations SET status='failed', error='timeout' WHERE status='pending' AND created_at < NOW() - INTERVAL '10 minutes'"
  ).catch(() => {});

  // Look up by session_id OR ip (matches the POST route's quota check), so a
  // user without a cookie yet still sees an accurate "0 remaining" if their IP
  // already used today's quota. Without this, the page would advertise "1 free
  // preview left" and only fail at click time with limit_reached.
  if (!sessionId && !ip) {
    return NextResponse.json({
      used: 0,
      free_no_email: FREE_NO_EMAIL,
      free_with_email: FREE_WITH_EMAIL,
      remaining: FREE_NO_EMAIL,
      email: null,
      requires_email: false,
      blocked: false,
      latest_result: null,
    });
  }

  const row = await queryOne<UsageRow>(
    `SELECT
       COUNT(*)::text AS total_count,
       COUNT(*) FILTER (WHERE email IS NOT NULL)::text AS has_email_count,
       MAX(email) AS email
     FROM ai_generations
     WHERE ((session_id = $1 AND $1 IS NOT NULL) OR (ip = $2 AND $2 IS NOT NULL))
       AND status = 'success'
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [sessionId, ip]
  );

  const used = Number(row?.total_count || 0);
  const email = row?.email || null;
  const cap = email ? FREE_WITH_EMAIL : FREE_NO_EMAIL;
  const remaining = Math.max(0, cap - used);
  const requires_email = used >= FREE_NO_EMAIL && !email;
  const blocked = used >= FREE_WITH_EMAIL;

  const latest_result = await fetchLatestResult(sessionId, ip);

  return NextResponse.json({
    used,
    free_no_email: FREE_NO_EMAIL,
    free_with_email: FREE_WITH_EMAIL,
    remaining,
    email,
    requires_email,
    blocked,
    latest_result,
  });
}
