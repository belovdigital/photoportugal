import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";
import crypto from "crypto";
import sharp from "sharp";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB per portfolio photo

// Client uses temp ids like "temp-1777..." for items mid-upload; those never
// reach the DB so DELETE/PATCH against them must short-circuit instead of
// crashing pg with `invalid input syntax for type uuid` (22P02).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const items = await query(
      // Alias `url` → `image_url` so mobile clients (which expect that
      // field name, matching the public /photographers/:slug shape) can
      // render thumbnails AND open the lightbox without remapping.
      "SELECT id, type, url AS image_url, thumbnail_url, caption, location_slug, shoot_type, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at ASC",
      [profile.id]
    );
    return NextResponse.json(items);
  } catch (error) {
    console.error("Portfolio list error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/portfolio", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  const profile = await queryOne<{ id: string; plan: string }>(
    "SELECT id, plan FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check portfolio limits based on plan
  const items = await query(
    "SELECT COUNT(*) as count FROM portfolio_items WHERE photographer_id = $1",
    [profile.id]
  );
  const count = parseInt((items[0] as { count: string }).count);
  const limits: Record<string, number> = { free: 100, pro: 100, premium: 100 };
  const limit = limits[profile.plan] || 100;

  if (count >= limit) {
    return NextResponse.json(
      { error: `Portfolio limit reached (${limit} photos on ${profile.plan} plan)` },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
    const rawExt = (file.name.split(".").pop() || "").toLowerCase();
    const isImage = file.type.startsWith("image/") || ALLOWED_EXTENSIONS.includes(rawExt);
    if (!isImage) {
      return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Resize + convert to JPEG. iPhone HEIC uploads were previously
    // saved with a .heic extension while the buffer was JPEG bytes —
    // browsers and image proxies refused to render them. Now if sharp
    // succeeds, we ALWAYS use .jpg extension. If sharp throws (rare)
    // we keep the original buffer + extension as a fallback.
    let buffer: Buffer;
    let convertedToJpeg = false;
    try {
      buffer = await sharp(rawBuffer)
        .rotate()
        .resize(2000, undefined, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      convertedToJpeg = true;
    } catch (err) {
      console.warn("[portfolio] sharp convert failed, using raw:", err);
      buffer = rawBuffer;
    }

    const ext = convertedToJpeg
      ? "jpg"
      : (ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : "jpg");
    const filename = `${crypto.randomUUID()}.${ext}`;
    const r2Key = `portfolio/${profile.id}/${filename}`;
    const contentType = convertedToJpeg
      ? "image/jpeg"
      : (file.type || "image/jpeg");
    await uploadToS3(r2Key, buffer, contentType);

    // Generate thumbnail (400px wide, WebP, quality 75). Upload alongside the
    // main image — thumbnail loading is no longer needed once Cloudflare Image
    // Transformations is in front, but we still write it for back-compat with
    // any caller that reads thumbnail_url directly.
    const thumbFilename = `thumb_${crypto.randomUUID()}.webp`;
    const thumbKey = `portfolio/${profile.id}/${thumbFilename}`;
    let thumbnailUrl: string | null = null;
    try {
      const thumbBuffer = await sharp(buffer)
        .rotate()
        .resize(400, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
      await uploadToS3(thumbKey, thumbBuffer, "image/webp");
      thumbnailUrl = `${R2_PUBLIC_URL}/${thumbKey}`;
    } catch {
      // Thumbnail generation failed — not critical, will fallback to API optimization
    }

    const url = `${R2_PUBLIC_URL}/${r2Key}`;
    const locationSlug = (formData.get("location_slug") as string) || null;
    const shootType = (formData.get("shoot_type") as string) || null;

    // Get image dimensions for aspect-ratio (prevents layout shift)
    let imgWidth: number | null = null;
    let imgHeight: number | null = null;
    try {
      const meta = await sharp(buffer).metadata();
      imgWidth = meta.width || null;
      imgHeight = meta.height || null;
    } catch {}

    // Newly uploaded photos go to the *top* of the portfolio (sort_order = 0).
    // Photographers expect "I just uploaded this, where is it?" to mean the
    // first slot, not the 80th. Shift every existing item by +1 in the same
    // transaction-like sequence so ordering stays a contiguous 0..N-1 with
    // no duplicates. (We already normalized away duplicate sort_orders in
    // an earlier migration; this keeps the invariant.)
    await query(
      "UPDATE portfolio_items SET sort_order = sort_order + 1 WHERE photographer_id = $1",
      [profile.id]
    );
    const item = await queryOne<{ id: string; type: string; url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null; sort_order: number; width: number | null; height: number | null }>(
      `INSERT INTO portfolio_items (photographer_id, type, url, thumbnail_url, location_slug, shoot_type, sort_order, width, height)
       VALUES ($1, 'photo', $2, $3, $4, $5, 0, $6, $7)
       RETURNING id, type, url, thumbnail_url, caption, location_slug, shoot_type, sort_order, width, height`,
      [profile.id, url, thumbnailUrl, locationSlug, shootType, imgWidth, imgHeight]
    );

    checkAndNotifyChecklistComplete(profile.id).catch(() => {});
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Upload error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/portfolio", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("id");

  if (!itemId) {
    return NextResponse.json({ error: "Item ID required" }, { status: 400 });
  }

  // Temp client-side id (e.g. "temp-1777..." for an in-flight upload) — nothing
  // to delete server-side, just acknowledge.
  if (!isUuid(itemId)) {
    return NextResponse.json({ success: true, noop: true });
  }

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const item = await queryOne<{ url: string; thumbnail_url: string | null }>(
    "DELETE FROM portfolio_items WHERE id = $1 AND photographer_id = $2 RETURNING url, thumbnail_url",
    [itemId, profile.id]
  );

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Delete from R2 (or legacy local disk for old `/uploads/...` URLs).
  // We strip both the absolute R2 prefix and the legacy `/uploads/` prefix
  // so this keeps working through the migration window.
  await deleteByUrl(item.url);
  if (item.thumbnail_url) await deleteByUrl(item.thumbnail_url);

  return NextResponse.json({ success: true });
}

async function deleteByUrl(url: string): Promise<void> {
  if (!url) return;
  if (url.startsWith(R2_PUBLIC_URL)) {
    const key = url.slice(R2_PUBLIC_URL.length + 1);
    try { await deleteFromS3(key); } catch {}
    return;
  }
  // Legacy /uploads/... — silently ignore. Old files will be cleaned up when
  // we drop the local disk after the bulk migration.
}

// Update tags or reorder portfolio items
export async function PATCH(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;
  const body = await req.json();

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]
  );
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Batch reorder. Skip any temp/non-UUID ids (in-flight uploads not yet saved).
  if (body.action === "reorder" && Array.isArray(body.items)) {
    for (const item of body.items) {
      if (!isUuid(item.id)) continue;
      await queryOne(
        "UPDATE portfolio_items SET sort_order = $1 WHERE id = $2 AND photographer_id = $3",
        [item.sort_order, item.id, profile.id]
      );
    }
    return NextResponse.json({ success: true });
  }

  // Bulk tag — apply location_slug and/or shoot_type to many items at once.
  // Only the fields explicitly present in the body are updated; an explicit
  // null clears the tag. Temp ids are filtered out.
  if (body.action === "bulk-tag" && Array.isArray(body.ids)) {
    const validIds = body.ids.filter(isUuid);
    if (validIds.length === 0) return NextResponse.json({ success: true, count: 0 });

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if ("location_slug" in body) {
      setClauses.push(`location_slug = $${idx++}`);
      params.push(body.location_slug || null);
    }
    if ("shoot_type" in body) {
      setClauses.push(`shoot_type = $${idx++}`);
      params.push(body.shoot_type || null);
    }
    if (setClauses.length === 0) return NextResponse.json({ success: true, count: 0 });

    params.push(validIds);
    params.push(profile.id);
    await query(
      `UPDATE portfolio_items SET ${setClauses.join(", ")} WHERE id = ANY($${idx++}::uuid[]) AND photographer_id = $${idx}`,
      params
    );
    return NextResponse.json({ success: true, count: validIds.length });
  }

  // Update tags on single item
  const { id: itemId, location_slug, shoot_type } = body;
  if (!itemId) return NextResponse.json({ error: "Item ID required" }, { status: 400 });
  if (!isUuid(itemId)) return NextResponse.json({ success: true, noop: true });

  await queryOne(
    "UPDATE portfolio_items SET location_slug = $1, shoot_type = $2 WHERE id = $3 AND photographer_id = $4 RETURNING id",
    [location_slug || null, shoot_type || null, itemId, profile.id]
  );

  return NextResponse.json({ success: true });
}
