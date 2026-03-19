import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne, query } from "@/lib/db";
import archiver from "archiver";
import { createReadStream } from "fs";
import path from "path";
import { PassThrough } from "stream";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

// GET: Download all delivery photos as ZIP (password-protected)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { searchParams } = new URL(req.url);
  const password = searchParams.get("password");

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const booking = await queryOne<{
    id: string;
    photographer_name: string;
    delivery_password: string;
    delivery_expires_at: string;
  }>(
    `SELECT b.id, pp.display_name as photographer_name, b.delivery_password, b.delivery_expires_at
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.delivery_token = $1 AND b.status = 'delivered'`,
    [token]
  );

  if (!booking) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  // Verify password (bcrypt, with SHA256 fallback for old deliveries)
  const { compare: bcryptCompare } = await import("bcryptjs");
  const crypto = await import("crypto");
  const isBcrypt = booking.delivery_password.startsWith("$2");
  const passwordMatch = isBcrypt
    ? await bcryptCompare(password, booking.delivery_password)
    : crypto.createHash("sha256").update(password).digest("hex") === booking.delivery_password;
  if (!passwordMatch) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  if (new Date(booking.delivery_expires_at) < new Date()) {
    return NextResponse.json({ error: "Gallery expired" }, { status: 410 });
  }

  const photos = await query<{ url: string; filename: string }>(
    "SELECT url, filename FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
    [booking.id]
  );

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos found" }, { status: 404 });
  }

  // Create ZIP archive streamed to response
  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();

  archive.pipe(passthrough);

  // Add each photo to the archive
  const usedNames = new Set<string>();
  for (const photo of photos) {
    const filePath = path.join(UPLOAD_DIR, photo.url.replace("/uploads/", ""));
    let name = photo.filename || path.basename(photo.url);

    // Deduplicate filenames
    if (usedNames.has(name)) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      let i = 2;
      while (usedNames.has(`${base}_${i}${ext}`)) i++;
      name = `${base}_${i}${ext}`;
    }
    usedNames.add(name);

    try {
      archive.append(createReadStream(filePath), { name });
    } catch {
      // Skip files that don't exist on disk
    }
  }

  archive.finalize();

  const sanitizedName = booking.photographer_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

  // Convert Node stream to Web ReadableStream
  const readable = new ReadableStream({
    start(controller) {
      passthrough.on("data", (chunk) => controller.enqueue(chunk));
      passthrough.on("end", () => controller.close());
      passthrough.on("error", (err) => controller.error(err));
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="PhotoPortugal_${sanitizedName}.zip"`,
    },
  });
}
