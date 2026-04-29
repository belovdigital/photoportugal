import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { uploadToS3 } from "@/lib/s3";
import crypto from "crypto";
import sharp from "sharp";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";

async function verifyAdmin(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const data = verifyToken(token);
  if (!data) return null;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin" ? data : null;
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    console.error("[admin/revisions/upload] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/revisions/upload", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
