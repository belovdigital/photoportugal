import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import crypto from "crypto";
import sharp from "sharp";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "pdf"];
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "application/pdf",
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
      return NextResponse.json({ error: "File too large (max 30MB)" }, { status: 400 });
    }

    // Validate mime type
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
    const rawExt = (file.name.split(".").pop() || "").toLowerCase();
    const isValidExt = ALLOWED_EXTENSIONS.includes(rawExt);

    if (!isValidMime && !isValidExt) {
      return NextResponse.json(
        { error: "Only images and PDFs are allowed (jpg, png, webp, heic, heif, gif, pdf)" },
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

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const isPdf = rawExt === "pdf" || file.type === "application/pdf";
    const isGif = rawExt === "gif" || file.type === "image/gif";

    let filename: string;
    let buffer: Buffer;

    if (isPdf) {
      // Save PDFs as-is, no sharp processing
      filename = `${crypto.randomUUID()}.pdf`;
      buffer = rawBuffer;
    } else if (isGif) {
      // Save GIFs as-is to preserve animation
      filename = `${crypto.randomUUID()}.gif`;
      buffer = rawBuffer;
    } else {
      // Resize images to max 1200px wide, JPEG quality 85
      filename = `${crypto.randomUUID()}.jpg`;
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
    }

    const r2Key = `messages/${bookingId}/${filename}`;
    const contentType = isPdf ? "application/pdf" : isGif ? "image/gif" : "image/jpeg";
    await uploadToS3(r2Key, buffer, contentType);
    const url = `${R2_PUBLIC_URL}/${r2Key}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[messages/upload] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/messages/upload", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
