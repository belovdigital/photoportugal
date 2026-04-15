import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

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
    console.error("[admin/revisions/upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
