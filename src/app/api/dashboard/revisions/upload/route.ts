import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large" }, { status: 400 });

    const dir = path.join(UPLOAD_DIR, "revisions");
    await mkdir(dir, { recursive: true });

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const finalBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const filename = `${crypto.randomUUID()}.jpg`;
    await writeFile(path.join(dir, filename), finalBuffer);

    return NextResponse.json({ url: `/uploads/revisions/${filename}` });
  } catch (error) {
    console.error("[dashboard/revisions/upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
