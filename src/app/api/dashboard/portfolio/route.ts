import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
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
      "SELECT id, type, url, thumbnail_url, caption, location_slug, shoot_type, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order, created_at",
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
    const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const portfolioDir = path.join(UPLOAD_DIR, "portfolio", profile.id);
    await mkdir(portfolioDir, { recursive: true });

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Resize main image to max 2000px wide, JPEG quality 85
    let buffer: Buffer;
    try {
      buffer = await sharp(rawBuffer)
        .rotate()
        .resize(2000, undefined, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      buffer = rawBuffer;
    }
    await writeFile(path.join(portfolioDir, filename), buffer);

    // Generate thumbnail (400px wide, WebP, quality 75)
    const thumbFilename = `thumb_${crypto.randomUUID()}.webp`;
    let thumbnailUrl: string | null = null;
    try {
      const thumbBuffer = await sharp(buffer)
        .rotate()
        .resize(400, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
      await writeFile(path.join(portfolioDir, thumbFilename), thumbBuffer);
      thumbnailUrl = `/uploads/portfolio/${profile.id}/${thumbFilename}`;
    } catch {
      // Thumbnail generation failed — not critical, will fallback to API optimization
    }

    const url = `/uploads/portfolio/${profile.id}/${filename}`;
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

    const item = await queryOne<{ id: string; type: string; url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null; sort_order: number; width: number | null; height: number | null }>(
      `INSERT INTO portfolio_items (photographer_id, type, url, thumbnail_url, location_slug, shoot_type, sort_order, width, height)
       VALUES ($1, 'photo', $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, type, url, thumbnail_url, caption, location_slug, shoot_type, sort_order, width, height`,
      [profile.id, url, thumbnailUrl, locationSlug, shootType, count, imgWidth, imgHeight]
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

  // Delete original file from disk
  try {
    await unlink(path.join(UPLOAD_DIR, item.url.replace("/uploads/", "")));
  } catch {}
  // Delete thumbnail from disk
  if (item.thumbnail_url) {
    try {
      await unlink(path.join(UPLOAD_DIR, item.thumbnail_url.replace("/uploads/", "")));
    } catch {}
  }

  return NextResponse.json({ success: true });
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
