import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bookingId = formData.get("booking_id") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: "booking_id required" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Validate mime type
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
    const rawExt = (file.name.split(".").pop() || "").toLowerCase();
    const isValidExt = ALLOWED_EXTENSIONS.includes(rawExt);

    if (!isValidMime && !isValidExt) {
      return NextResponse.json(
        { error: "Only images are allowed (jpg, png, webp, heic, heif)" },
        { status: 400 }
      );
    }

    // Verify user is part of this booking (client or photographer)
    const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
      `SELECT b.client_id, u.id as photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Create upload directory
    const messageDir = path.join(UPLOAD_DIR, "messages", bookingId);
    await mkdir(messageDir, { recursive: true });

    const filename = `${crypto.randomUUID()}.jpg`;
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Resize to max 1200px wide, JPEG quality 85
    let buffer: Buffer;
    try {
      buffer = await sharp(rawBuffer)
        .rotate()
        .resize(1200, undefined, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      // If sharp fails (e.g. unsupported format), use raw buffer
      buffer = rawBuffer;
    }

    await writeFile(path.join(messageDir, filename), buffer);

    const url = `/uploads/messages/${bookingId}/${filename}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[messages/upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
