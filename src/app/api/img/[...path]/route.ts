import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, stat } from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const CACHE_DIR = path.join(UPLOAD_DIR, ".cache");

// Allowed widths to prevent abuse (cache explosion)
const ALLOWED_WIDTHS = [200, 400, 600, 800, 1200, 1600, 2000];
const DEFAULT_QUALITY = 85;
const MAX_QUALITY = 95;

function closestWidth(requested: number): number {
  return ALLOWED_WIDTHS.reduce((prev, curr) =>
    Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;
  const filePath = segments.join("/");

  // Validate path — prevent directory traversal
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const resolvedPath = path.resolve(UPLOAD_DIR, filePath);
  if (!resolvedPath.startsWith(UPLOAD_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const requestedWidth = parseInt(searchParams.get("w") || "800");
  const quality = Math.min(parseInt(searchParams.get("q") || String(DEFAULT_QUALITY)), MAX_QUALITY);
  const format = searchParams.get("f") === "avif" ? "avif" : "webp";

  const width = closestWidth(requestedWidth);

  // Build cache key
  const cacheKey = `${filePath}_w${width}_q${quality}.${format}`;
  const cachePath = path.join(CACHE_DIR, cacheKey.replace(/\//g, "__"));

  // Try serving from cache first
  try {
    const cached = await readFile(cachePath);
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        "Content-Type": `image/${format}`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "HIT",
      },
    });
  } catch {
    // Cache miss — process the image
  }

  // Read original file
  const originalPath = path.join(UPLOAD_DIR, filePath);
  let originalBuffer: Buffer;
  try {
    originalBuffer = await readFile(originalPath);
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Process with Sharp
  try {
    let pipeline = sharp(originalBuffer).rotate(); // auto-rotate EXIF

    // Only resize if original is larger
    const metadata = await sharp(originalBuffer).metadata();
    if (metadata.width && metadata.width > width) {
      pipeline = pipeline.resize(width, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    let outputBuffer: Buffer;
    if (format === "avif") {
      outputBuffer = await pipeline.avif({ quality }).toBuffer();
    } else {
      outputBuffer = await pipeline.webp({ quality }).toBuffer();
    }

    // Cache to disk (non-blocking)
    mkdir(path.dirname(cachePath), { recursive: true })
      .then(() => writeFile(cachePath, outputBuffer))
      .catch(() => {}); // Silent fail on cache write

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": `image/${format}`,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("Image processing error:", err);
    // Fallback: serve original
    const ext = path.extname(originalPath).slice(1).toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(originalBuffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
}
