import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { queryOne, query } from "@/lib/db";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

// GET: Download all delivery photos as ZIP
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
    delivery_accepted: boolean;
    zip_path: string | null;
    zip_size: number | null;
    zip_ready: boolean;
  }>(
    `SELECT b.id, u.name as photographer_name, b.delivery_password, b.delivery_expires_at,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            b.zip_path, b.zip_size, COALESCE(b.zip_ready, FALSE) as zip_ready
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`,
    [token]
  );

  if (!booking) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  // Verify password
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

  if (!booking.delivery_accepted) {
    return NextResponse.json({ error: "Please accept the delivery first" }, { status: 403 });
  }

  const sanitizedName = booking.photographer_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

  // Serve pre-built ZIP if available
  if (booking.zip_ready && booking.zip_path) {
    // S3-stored ZIP: redirect to presigned URL
    if (isS3Path(booking.zip_path)) {
      try {
        const presignedUrl = await getPresignedUrl(s3KeyFromPath(booking.zip_path), 3600);
        return NextResponse.redirect(presignedUrl);
      } catch {
        // S3 error, fall through to build on-the-fly
      }
    } else {
      // Local ZIP (backwards compatible for existing deliveries)
      const zipFullPath = path.join(UPLOAD_DIR, booking.zip_path.replace("/uploads/", ""));
      try {
        const stats = await stat(zipFullPath);
        const stream = createReadStream(zipFullPath);
        const readable = new ReadableStream({
          start(controller) {
            stream.on("data", (chunk) => controller.enqueue(chunk));
            stream.on("end", () => controller.close());
            stream.on("error", (err) => controller.error(err));
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Length": String(stats.size),
            "Content-Disposition": `attachment; filename="PhotoPortugal_${sanitizedName}.zip"`,
          },
        });
      } catch {
        // ZIP file missing, fall through to build on-the-fly
      }
    }
  }

  // Fallback: build ZIP on-the-fly (slower, for old deliveries or if pre-build failed)
  const archiver = (await import("archiver")).default;
  const { PassThrough } = await import("stream");

  const photos = await query<{ url: string; filename: string }>(
    "SELECT url, filename FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
    [booking.id]
  );

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos found" }, { status: 404 });
  }

  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  const usedNames = new Set<string>();
  for (const photo of photos) {
    let name = (photo.filename || path.basename(photo.url)).replace(/[^\w\s.-]/g, "_").replace(/\s+/g, "_");
    if (usedNames.has(name)) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      let i = 2;
      while (usedNames.has(`${base}_${i}${ext}`)) i++;
      name = `${base}_${i}${ext}`;
    }
    usedNames.add(name);
    try {
      if (isS3Path(photo.url)) {
        // Fetch from S3 via presigned URL and append buffer
        const presigned = await getPresignedUrl(s3KeyFromPath(photo.url), 300);
        const resp = await fetch(presigned);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          archive.append(buf, { name });
        }
      } else {
        const filePath = path.join(UPLOAD_DIR, photo.url.replace("/uploads/", ""));
        archive.append(createReadStream(filePath), { name });
      }
    } catch {}
  }

  archive.finalize();

  // Also save ZIP for next time (non-blocking)
  import("@/lib/build-zip").then(({ buildDeliveryZip }) => {
    buildDeliveryZip(booking.id).catch(() => {});
  });

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
