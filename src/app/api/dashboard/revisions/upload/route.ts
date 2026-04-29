import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { uploadToS3 } from "@/lib/s3";
import crypto from "crypto";
import sharp from "sharp";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large" }, { status: 400 });

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const finalBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const filename = `${crypto.randomUUID()}.jpg`;
    const r2Key = `revisions/${filename}`;
    await uploadToS3(r2Key, finalBuffer, "image/jpeg");

    return NextResponse.json({ url: `${R2_PUBLIC_URL}/${r2Key}` });
  } catch (error) {
    console.error("[dashboard/revisions/upload] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/revisions/upload", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
