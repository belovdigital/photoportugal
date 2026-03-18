import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB raw (will be compressed)

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "avatar";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only images allowed" }, { status: 400 });

    const filename = `${crypto.randomUUID()}.jpg`;
    const dir = path.join(UPLOAD_DIR, type === "cover" ? "covers" : "avatars");
    await mkdir(dir, { recursive: true });

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Convert any format (HEIC, PNG, WebP, etc.) to JPEG
    const processedBuffer = await sharp(rawBuffer)
      .rotate() // auto-rotate based on EXIF
      .resize(type === "cover" ? 1600 : 800, type === "cover" ? 900 : 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const filePath = path.join(dir, filename);
    const { writeFile } = await import("fs/promises");
    await writeFile(filePath, processedBuffer);

    const url = `/uploads/${type === "cover" ? "covers" : "avatars"}/${filename}`;

    if (type === "cover") {
      await queryOne(
        "UPDATE photographer_profiles SET cover_url = $1 WHERE user_id = $2 RETURNING id",
        [url, userId]
      );
    } else {
      await queryOne(
        "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id",
        [url, userId]
      );
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
