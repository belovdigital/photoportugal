import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { verifyToken } from "@/app/api/admin/login/route";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const admin = await isAdmin();
  if (!session?.user && !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const reviewId = formData.get("review_id") as string;

    if (!file || !reviewId) {
      return NextResponse.json({ error: "File and review_id required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
    }

    // Verify review exists and belongs to user (or admin); also need photographer_id for folder
    const userId = session?.user ? (session.user as { id?: string }).id : null;
    const review = await queryOne<{ id: string; client_id: string | null; photographer_id: string }>(
      "SELECT id, client_id, photographer_id FROM reviews WHERE id = $1",
      [reviewId]
    );

    if (!review || (!admin && (!review.client_id || review.client_id !== userId))) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Check photo count limit
    const photoCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM review_photos WHERE review_id = $1",
      [reviewId]
    );
    if (parseInt(photoCount?.count || "0") >= 5) {
      return NextResponse.json({ error: "Maximum 5 photos per review" }, { status: 400 });
    }

    const dir = path.join(UPLOAD_DIR, "reviews", review.photographer_id);
    await mkdir(dir, { recursive: true });

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    let finalBuffer: Buffer;
    let filename: string;
    try {
      finalBuffer = await sharp(rawBuffer)
        .rotate()
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      filename = `${crypto.randomUUID()}.jpg`;
    } catch {
      return NextResponse.json({ error: "Could not process image" }, { status: 400 });
    }

    await writeFile(path.join(dir, filename), finalBuffer);
    const url = `/uploads/reviews/${review.photographer_id}/${filename}`;

    await queryOne(
      "INSERT INTO review_photos (review_id, url, is_public) VALUES ($1, $2, true) RETURNING id",
      [reviewId, url]
    );

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[reviews/photos] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/reviews/photos", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
