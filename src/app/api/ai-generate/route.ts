import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { checkRateLimit } from "@/lib/rate-limit";
import { getScene, VARIANT_FRAMINGS, buildVariantPrompt } from "@/lib/ai-scenes";

// User IDs allowed to generate unlimited AI previews (test/staff accounts).
// Kate Belova — test account also hidden from Recent Visitors.
const UNLIMITED_USER_IDS = new Set([
  "1fe40315-bd00-4530-a6be-39fa970617bd",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-image-2";
// Each generation produces 4 images at vertical 1024×1536, ~$0.05/image
// = ~$0.20/session. quality:"medium" → ~30-90s per call, parallel ≈ same wall time.
const COST_CENTS_PER_GENERATION = 20;
const IMAGES_PER_GENERATION = 4;

const FREE_NO_EMAIL = 1;
const FREE_WITH_EMAIL = 3;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_REFERENCE_BYTES = 15 * 1024 * 1024; // 15 MB — modern phone photos can hit ~10-12 MB

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

/**
 * POST /api/ai-generate
 *
 * Async architecture: this returns the generation `id` immediately and runs the
 * OpenAI call in `after()` so we don't hit Cloudflare's ~100s edge timeout
 * (gpt-image-2 takes 30-120s). Client polls GET /api/ai-generate/[id] for the
 * result.
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI generation not configured" }, { status: 503 });
  }

  let sessionId = req.cookies.get("ai_session")?.value || null;
  let setSessionCookie = false;
  if (!sessionId || !/^[a-f0-9]{32}$/.test(sessionId)) {
    sessionId = randomBytes(16).toString("hex");
    setSessionCookie = true;
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;

  // Logged-in staff/test users get unlimited generations — bypass quota + abuse guards.
  let unlimited = false;
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = (session?.user as { id?: string } | undefined)?.id || null;
    if (userId && UNLIMITED_USER_IDS.has(userId)) unlimited = true;
  } catch { /* not logged in */ }

  // Coarse abuse guard (still applies even to unlimited users — protects against runaway loops)
  if (!checkRateLimit(`ai-gen:s:${sessionId}`, 1, 60_000)) {
    return NextResponse.json({ error: "Too fast — wait a minute and try again." }, { status: 429 });
  }
  if (!unlimited && ip && !checkRateLimit(`ai-gen:ip:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Hourly limit reached on this network." }, { status: 429 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "Bad form data" }, { status: 400 }); }

  const sceneId = String(form.get("scene_id") || "");
  const emailRaw = String(form.get("email") || "").trim().toLowerCase();
  const file = form.get("photo");

  const scene = getScene(sceneId);
  if (!scene) return NextResponse.json({ error: "Unknown scene" }, { status: 400 });

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Photo required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_REFERENCE_BYTES) {
    return NextResponse.json({ error: `Photo must be 0–${MAX_REFERENCE_BYTES / 1024 / 1024}MB` }, { status: 400 });
  }
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Photo must be JPEG, PNG or WebP" }, { status: 400 });
  }

  const email: string | null = emailRaw && isValidEmail(emailRaw) ? emailRaw : null;

  // Mark any "pending" rows older than 10 min as failed before counting — covers
  // the case where a deploy/restart killed an in-flight Promise; without this
  // the row would count toward quota indefinitely.
  await query(
    "UPDATE ai_generations SET status='failed', error='timeout' WHERE status='pending' AND created_at < NOW() - INTERVAL '10 minutes'"
  ).catch(() => {});

  // Quota check (counts both successful and currently-in-flight pending rows so
  // a user can't fire a second generation while the first is still rendering).
  const usageRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM ai_generations
     WHERE (session_id = $1 OR (ip = $2 AND $2 IS NOT NULL))
       AND status IN ('success','pending') AND created_at > NOW() - INTERVAL '24 hours'`,
    [sessionId, ip]
  );
  const used = Number(usageRow?.total || 0);
  const priorEmail = await queryOne<{ email: string | null }>(
    `SELECT email FROM ai_generations
     WHERE (session_id = $1 OR (ip = $2 AND $2 IS NOT NULL)) AND email IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [sessionId, ip]
  );
  const effectiveEmail = email || priorEmail?.email || null;

  if (!unlimited) {
    if (used >= FREE_WITH_EMAIL) {
      return NextResponse.json({ error: "limit_reached", reason: "limit_reached", used, cap: FREE_WITH_EMAIL }, { status: 429 });
    }
    if (used >= FREE_NO_EMAIL && !effectiveEmail) {
      return NextResponse.json({ error: "email_required", reason: "email_required", used }, { status: 402 });
    }
  }

  // Persist reference image
  const refBuf = Buffer.from(await file.arrayBuffer());
  const refContentType = file.type || "image/jpeg";
  const refExt = refContentType === "image/png" ? "png" : refContentType === "image/webp" ? "webp" : "jpg";
  const refKey = `ai-generations/ref/${sessionId}/${Date.now()}.${refExt}`;
  try { await uploadToS3(refKey, refBuf, refContentType); }
  catch (e) { console.error("[ai-generate] R2 ref upload failed:", e); }

  // Insert pending row
  const pending = await queryOne<{ id: string }>(
    `INSERT INTO ai_generations (session_id, ip, email, scene_id, reference_image_key, user_agent, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
    [sessionId, ip, effectiveEmail, sceneId, refKey, userAgent]
  );
  const genId = pending?.id;
  if (!genId) {
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
  }

  // Fire-and-forget: don't await — return immediately so the client doesn't hold
  // the connection through Cloudflare's ~100s edge timeout. Node + pm2 keep the
  // unawaited Promise alive until it settles. Errors are written to the row.
  runGeneration({
    genId,
    sessionId: sessionId!,
    refBuf,
    refExt,
    refContentType,
    sceneId: scene.id,
  }).catch((err) => {
    console.error(`[ai-generate ${genId}] background error:`, err);
  });

  const newUsed = used + 1;
  const cap = effectiveEmail ? FREE_WITH_EMAIL : FREE_NO_EMAIL;

  const res = NextResponse.json({
    success: true,
    id: genId,
    status: "pending",
    scene_id: sceneId,
    concierge_loc: scene.conciergeLoc,
    used: newUsed,
    remaining: Math.max(0, cap - newUsed),
    has_email: !!effectiveEmail,
    requires_email_next: newUsed >= FREE_NO_EMAIL && !effectiveEmail,
  });
  if (setSessionCookie) {
    res.cookies.set("ai_session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
  }
  return res;
}

async function runGeneration({
  genId, sessionId, refBuf, refExt, refContentType, sceneId,
}: {
  genId: string;
  sessionId: string;
  refBuf: Buffer;
  refExt: string;
  refContentType: string;
  sceneId: string;
}) {
  const scene = getScene(sceneId);
  if (!scene) {
    await queryOne("UPDATE ai_generations SET status='failed', error='unknown_scene' WHERE id=$1", [genId]).catch(() => {});
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180_000 });

  // Fire 4 parallel images.edit calls — one per framing variant. Each gets the
  // same reference image but a different composition prompt (wide / portrait /
  // candid / atmospheric). Output is vertical 1024×1536 (Instagram-friendly).
  const variantTasks = VARIANT_FRAMINGS.map(async (_, i) => {
    const prompt = buildVariantPrompt(scene, i);
    const refFile = new File([new Uint8Array(refBuf)], `selfie.${refExt}`, { type: refContentType });
    const res = await openai.images.edit({
      model: MODEL,
      image: refFile,
      prompt,
      size: "1024x1536", // portrait — vertical, Instagram Stories ratio
      quality: "medium",
      n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error(`variant ${i} returned no image`);
    return { idx: i, b64 };
  });

  let outputs: { idx: number; b64: string }[];
  try {
    outputs = await Promise.all(variantTasks);
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 500) || "unknown";
    console.error(`[ai-generate ${genId}] OpenAI error:`, msg);
    await queryOne("UPDATE ai_generations SET status='failed', error=$1 WHERE id=$2", [msg, genId]).catch(() => {});
    return;
  }

  // Upload all 4 to R2 in parallel
  const uploads = outputs.map(async ({ idx, b64 }) => {
    const buf = Buffer.from(b64, "base64");
    const key = `ai-generations/out/${sessionId}/${genId}-${idx}.png`;
    await uploadToS3(key, buf, "image/png");
    return key;
  });

  let resultKeys: string[];
  try {
    resultKeys = await Promise.all(uploads);
  } catch (e) {
    console.error(`[ai-generate ${genId}] R2 upload failed:`, e);
    await queryOne("UPDATE ai_generations SET status='failed', error='r2_upload_failed' WHERE id=$1", [genId]).catch(() => {});
    return;
  }

  // Save the array of keys; result_image_key (legacy) gets the first one for
  // back-compat with code paths that still expect a single key.
  await queryOne(
    "UPDATE ai_generations SET status='success', result_image_keys=$1::text[], result_image_key=$2, cost_cents=$3 WHERE id=$4",
    [resultKeys, resultKeys[0], COST_CENTS_PER_GENERATION, genId]
  ).catch(() => {});
}
