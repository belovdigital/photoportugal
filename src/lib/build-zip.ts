import { query, queryOne } from "@/lib/db";
import archiver from "archiver";
import { createReadStream, createWriteStream } from "fs";
import { stat, mkdir } from "fs/promises";
import path from "path";
import { uploadToS3, getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

export async function buildDeliveryZip(bookingId: string): Promise<{ path: string; size: number } | null> {
  try {
    const booking = await queryOne<{
      photographer_name: string;
      client_email: string;
      client_name: string;
      delivery_token: string | null;
    }>(
      `SELECT pu.name as photographer_name, cu.email as client_email, cu.name as client_name, b.delivery_token
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
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
      console.log(`[build-zip] Starting S3 ZIP build for booking ${bookingId} with ${photos.length} photos`);
      // Build ZIP into a buffer, then upload to S3
      const { PassThrough } = await import("stream");
      const chunks: Buffer[] = [];
      const passthrough = new PassThrough();
      passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));

      const archive = archiver("zip", { zlib: { level: 5 } });
      archive.pipe(passthrough);

      // Listen for end/error BEFORE finalize to avoid race condition
      const endPromise = new Promise<void>((resolve, reject) => {
        passthrough.on("end", resolve);
        passthrough.on("error", reject);
        archive.on("error", reject);
      });

      const usedNames = new Set<string>();
      let appendedCount = 0;
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
            // 30s timeout per file fetch — never hang forever
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 30000);
            try {
              const resp = await fetch(presigned, { signal: ctrl.signal });
              if (resp.ok) {
                const buf = Buffer.from(await resp.arrayBuffer());
                archive.append(buf, { name });
                appendedCount++;
              } else {
                console.warn(`[build-zip] R2 fetch ${resp.status} for ${name} (booking ${bookingId})`);
              }
            } finally {
              clearTimeout(timeoutId);
            }
          } else {
            const filePath = path.join(UPLOAD_DIR, photo.url.replace("/uploads/", ""));
            archive.append(createReadStream(filePath), { name });
            appendedCount++;
          }
        } catch (fetchErr) {
          console.warn(`[build-zip] Skipped ${name} (booking ${bookingId}):`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
        }
      }

      console.log(`[build-zip] Finalizing ZIP for booking ${bookingId}: ${appendedCount}/${photos.length} files appended`);
      await archive.finalize();
      await endPromise;

      const zipBuffer = Buffer.concat(chunks);
      const s3Key = `delivery/${bookingId}/${zipFilename}`;
      console.log(`[build-zip] Uploading ZIP for booking ${bookingId}: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);
      await uploadToS3(s3Key, zipBuffer, "application/zip");

      const s3Path = `s3://${s3Key}`;
      await queryOne(
        "UPDATE bookings SET zip_path = $1, zip_size = $2, zip_ready = TRUE WHERE id = $3",
        [s3Path, zipBuffer.length, bookingId]
      );

      console.log(`[build-zip] DONE for booking ${bookingId}: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);

      // Email client with direct download link
      if (booking.delivery_token && booking.client_email) {
        try {
          const { sendEmail, emailLayout, emailButton } = await import("@/lib/email");
          const galleryUrl = `https://photoportugal.com/delivery/${booking.delivery_token}`;
          const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(0);
          const firstName = booking.client_name?.split(" ")[0] || "there";
          await sendEmail(
            booking.client_email,
            `Your photos are ready to download (${sizeMB} MB)`,
            emailLayout(`
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Great news — your full-resolution photos from <strong>${booking.photographer_name}</strong> are ready to download as a ZIP file (${sizeMB} MB).</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4A4A;">Click the button below to open your gallery and download:</p>
              ${emailButton(galleryUrl, "Open Gallery & Download")}
              <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#999;">Tip: the gallery and download stay available for 90 days. If you need help, just reply to this email.</p>
            `)
          );
          console.log(`[build-zip] Notified ${booking.client_email} that ZIP is ready`);
        } catch (emailErr) {
          console.error(`[build-zip] email notification error for ${bookingId}:`, emailErr);
        }
      }

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
