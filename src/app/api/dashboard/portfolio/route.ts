import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per portfolio photo

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

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
  const limits: Record<string, number> = { free: 10, pro: 30, premium: 100 };
  const limit = limits[profile.plan] || 10;

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
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const portfolioDir = path.join(UPLOAD_DIR, "portfolio", profile.id);
    await mkdir(portfolioDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
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

    const item = await queryOne<{ id: string; type: string; url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null; sort_order: number }>(
      `INSERT INTO portfolio_items (photographer_id, type, url, thumbnail_url, location_slug, shoot_type, sort_order)
       VALUES ($1, 'photo', $2, $3, $4, $5, $6)
       RETURNING id, type, url, thumbnail_url, caption, location_slug, shoot_type, sort_order`,
      [profile.id, url, thumbnailUrl, locationSlug, shootType, count]
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("id");

  if (!itemId) {
    return NextResponse.json({ error: "Item ID required" }, { status: 400 });
  }

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const item = await queryOne<{ url: string }>(
    "DELETE FROM portfolio_items WHERE id = $1 AND photographer_id = $2 RETURNING url",
    [itemId, profile.id]
  );

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Delete file from disk
  try {
    const filePath = path.join(UPLOAD_DIR, item.url.replace("/uploads/", ""));
    await unlink(filePath);
  } catch {
    // File may not exist, that's ok
  }

  return NextResponse.json({ success: true });
}

// Update tags or reorder portfolio items
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const body = await req.json();

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]
  );
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Batch reorder
  if (body.action === "reorder" && Array.isArray(body.items)) {
    for (const item of body.items) {
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

  await queryOne(
    "UPDATE portfolio_items SET location_slug = $1, shoot_type = $2 WHERE id = $3 AND photographer_id = $4 RETURNING id",
    [location_slug || null, shoot_type || null, itemId, profile.id]
  );

  return NextResponse.json({ success: true });
}
