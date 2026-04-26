import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const reviewId = formData.get("review_id") as string;

    if (!file || !reviewId) {
      return NextResponse.json({ error: "File and review_id required" }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: "Video too large (max 50MB)" }, { status: 400 });
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files allowed" }, { status: 400 });
    }

    // Verify review belongs to user
    const userId = (session.user as { id?: string }).id;
    const review = await queryOne<{ id: string; client_id: string | null }>(
      "SELECT id, client_id FROM reviews WHERE id = $1",
      [reviewId]
    );

    if (!review || review.client_id !== userId) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const dir = path.join(UPLOAD_DIR, "reviews/videos");
    await mkdir(dir, { recursive: true });

    const ext = file.type.includes("mp4") ? "mp4" : "webm";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(dir, filename), buffer);
    const videoUrl = `/uploads/reviews/videos/${filename}`;

    // Store video URL in review
    await queryOne(
      "UPDATE reviews SET video_url = $1 WHERE id = $2 RETURNING id",
      [videoUrl, reviewId]
    );

    return NextResponse.json({ success: true, url: videoUrl });
  } catch (error) {
    console.error("[reviews/video] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/reviews/video", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
