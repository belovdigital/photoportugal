import { query, queryOne } from "@/lib/db";
import archiver from "archiver";
import { createReadStream } from "fs";
import path from "path";
import { uploadToS3 } from "@/lib/s3";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";
const R2_PUBLIC_PREFIX = R2_PUBLIC_URL + "/";

/**
 * Build a delivery zip for a booking. Photos can live in three places during
 * the migration window:
 *   - `https://files.photoportugal.com/...` (R2 — current)
 *   - `s3://bucket/key` (R2 — legacy s3-scheme rows)
 *   - `/uploads/...` (local disk — pre-migration)
 *
 * We always build the zip in-memory and upload it to R2 so the download URL
 * is stable regardless of where the originals lived. The local-disk branch is
 * kept only as a fallback for any straggler row that wasn't part of the
 * migration; once the local /uploads dir is removed it will simply 404 with a
 * "skipped" warning, the rest of the zip still completes.
 */
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

    console.log(`[build-zip] Building zip for booking ${bookingId} with ${photos.length} photos`);

    const { PassThrough } = await import("stream");
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.pipe(passthrough);

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
        if (photo.url.startsWith(R2_PUBLIC_PREFIX) || photo.url.startsWith("s3://")) {
          // Pull bytes via the public R2 URL — same Cloudflare CDN path everyone
          // else uses, so warmer caches and zero R2 egress cost vs the S3 API.
          const fetchUrl = photo.url.startsWith("s3://")
            ? `${R2_PUBLIC_URL}/${photo.url.replace(/^s3:\/\/[^/]+\//, "")}`
            : photo.url;
          const ctrl = new AbortController();
          const timeoutId = setTimeout(() => ctrl.abort(), 30000);
          try {
            const resp = await fetch(fetchUrl, { signal: ctrl.signal });
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
        } else if (photo.url.startsWith("/uploads/")) {
          // Legacy local-disk fallback — will 404 once /var/www/photoportugal/uploads
          // is removed; that's acceptable since the migration converted these rows.
          const filePath = path.join(UPLOAD_DIR, photo.url.replace("/uploads/", ""));
          archive.append(createReadStream(filePath), { name });
          appendedCount++;
        } else {
          console.warn(`[build-zip] Unknown URL form, skipped: ${photo.url}`);
        }
      } catch (fetchErr) {
        console.warn(`[build-zip] Skipped ${name} (booking ${bookingId}):`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
      }
    }

    console.log(`[build-zip] Finalizing for booking ${bookingId}: ${appendedCount}/${photos.length} files appended`);
    await archive.finalize();
    await endPromise;

    const zipBuffer = Buffer.concat(chunks);
    const r2Key = `delivery/${bookingId}/${zipFilename}`;
    console.log(`[build-zip] Uploading zip for booking ${bookingId}: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    await uploadToS3(r2Key, zipBuffer, "application/zip");
    const zipUrl = `${R2_PUBLIC_URL}/${r2Key}`;

    await queryOne(
      "UPDATE bookings SET zip_path = $1, zip_size = $2, zip_ready = TRUE WHERE id = $3",
      [zipUrl, zipBuffer.length, bookingId]
    );

    console.log(`[build-zip] DONE for booking ${bookingId}: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);

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

    return { path: zipUrl, size: zipBuffer.length };
  } catch (err) {
    console.error("[build-zip] error:", err);
    return null;
  }
}
