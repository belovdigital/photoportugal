import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomBytes } from "crypto";
import OpenAI from "openai";
import { queryOne } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { checkRateLimit } from "@/lib/rate-limit";
import { getScene } from "@/lib/ai-scenes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-image-2";
const COST_CENTS_PER_IMAGE = 5;

const FREE_NO_EMAIL = 1;
const FREE_WITH_EMAIL = 3;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024; // 8 MB

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

  // Coarse abuse guard
  if (!checkRateLimit(`ai-gen:s:${sessionId}`, 1, 60_000)) {
    return NextResponse.json({ error: "Too fast — wait a minute and try again." }, { status: 429 });
  }
  if (ip && !checkRateLimit(`ai-gen:ip:${ip}`, 5, 60 * 60_000)) {
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

  // Quota check
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

  if (used >= FREE_WITH_EMAIL) {
    return NextResponse.json({ error: "limit_reached", reason: "limit_reached", used, cap: FREE_WITH_EMAIL }, { status: 429 });
  }
  if (used >= FREE_NO_EMAIL && !effectiveEmail) {
    return NextResponse.json({ error: "email_required", reason: "email_required", used }, { status: 402 });
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

  // Run the slow part AFTER the response is sent. `after()` keeps the work alive
  // on self-hosted Next.js (pm2 process) without holding the HTTP connection.
  after(async () => {
    await runGeneration({
      genId,
      sessionId: sessionId!,
      refBuf,
      refExt,
      refContentType,
      scenePrompt: scene.prompt,
    });
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
  genId, sessionId, refBuf, refExt, refContentType, scenePrompt,
}: {
  genId: string;
  sessionId: string;
  refBuf: Buffer;
  refExt: string;
  refContentType: string;
  scenePrompt: string;
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180_000 });
  let resultB64: string | null = null;
  try {
    const refFile = new File([new Uint8Array(refBuf)], `selfie.${refExt}`, { type: refContentType });
    const res = await openai.images.edit({
      model: MODEL,
      image: refFile,
      prompt: scenePrompt,
      size: "1024x1024",
      n: 1,
    });
    resultB64 = res.data?.[0]?.b64_json || null;
    if (!resultB64) throw new Error("no image data in OpenAI response");
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 500) || "unknown";
    console.error(`[ai-generate ${genId}] OpenAI error:`, msg);
    await queryOne(
      "UPDATE ai_generations SET status='failed', error=$1 WHERE id=$2",
      [msg, genId]
    ).catch(() => {});
    return;
  }

  const resultBuf = Buffer.from(resultB64, "base64");
  const resultKey = `ai-generations/out/${sessionId}/${genId}.png`;
  try {
    await uploadToS3(resultKey, resultBuf, "image/png");
  } catch (e) {
    console.error(`[ai-generate ${genId}] R2 result upload failed:`, e);
    await queryOne(
      "UPDATE ai_generations SET status='failed', error='r2_upload_failed' WHERE id=$1",
      [genId]
    ).catch(() => {});
    return;
  }

  await queryOne(
    "UPDATE ai_generations SET status='success', result_image_key=$1, cost_cents=$2 WHERE id=$3",
    [resultKey, COST_CENTS_PER_IMAGE, genId]
  ).catch(() => {});
}
