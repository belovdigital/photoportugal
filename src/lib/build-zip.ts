import { query, queryOne } from "@/lib/db";
import archiver from "archiver";
import { createReadStream, createWriteStream } from "fs";
import { stat, mkdir } from "fs/promises";
import path from "path";
import { uploadToS3, getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

export async function buildDeliveryZip(bookingId: string): Promise<{ path: string; size: number } | null> {
  try {
    const booking = await queryOne<{ photographer_name: string }>(
      `SELECT u.name as photographer_name
       FROM bookings b JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`, [bookingId]
    );
    if (!booking) return null;

    const photos = await query<{ url: string; filename: string }>(
      "SELECT url, filename FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
      [bookingId]
    );
    if (photos.length === 0) return null;

    const sanitizedName = booking.photographer_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    const zipFilename = `PhotoPortugal_${sanitizedName}.zip`;

    // Check if any photo uses S3 — if so, build ZIP in memory and upload to S3
    const hasS3Photos = photos.some(p => isS3Path(p.url));

    if (hasS3Photos) {
      // Build ZIP into a buffer, then upload to S3
      const { PassThrough } = await import("stream");
      const chunks: Buffer[] = [];
      const passthrough = new PassThrough();
      passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));

      const archive = archiver("zip", { zlib: { level: 5 } });
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
        } catch {
          // Skip files that don't exist
        }
      }

      await archive.finalize();

      // Wait for passthrough to finish
      await new Promise<void>((resolve, reject) => {
        passthrough.on("end", resolve);
        passthrough.on("error", reject);
      });

      const zipBuffer = Buffer.concat(chunks);
      const s3Key = `delivery/${bookingId}/${zipFilename}`;
      await uploadToS3(s3Key, zipBuffer, "application/zip");

      const s3Path = `s3://${s3Key}`;
      await queryOne(
        "UPDATE bookings SET zip_path = $1, zip_size = $2, zip_ready = TRUE WHERE id = $3",
        [s3Path, zipBuffer.length, bookingId]
      );

      return { path: s3Path, size: zipBuffer.length };
    }

    // Local photos: build ZIP on disk (backwards compatible)
    const zipDir = path.join(UPLOAD_DIR, "delivery", bookingId);
    await mkdir(zipDir, { recursive: true });
    const zipPath = path.join(zipDir, zipFilename);

    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 5 } });

      output.on("close", async () => {
        try {
          const stats = await stat(zipPath);
          await queryOne(
            "UPDATE bookings SET zip_path = $1, zip_size = $2, zip_ready = TRUE WHERE id = $3",
            [`/uploads/delivery/${bookingId}/${zipFilename}`, stats.size, bookingId]
          );
          resolve({ path: zipPath, size: stats.size });
        } catch (err) {
          reject(err);
        }
      });

      output.on("error", reject);
      archive.on("error", reject);

      archive.pipe(output);

      const usedNames = new Set<string>();
      for (const photo of photos) {
        const filePath = path.join(UPLOAD_DIR, photo.url.replace("/uploads/", ""));
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
          archive.append(createReadStream(filePath), { name });
        } catch {
          // Skip files that don't exist
        }
      }

      archive.finalize();
    });
  } catch (err) {
    console.error("[build-zip] error:", err);
    return null;
  }
}
