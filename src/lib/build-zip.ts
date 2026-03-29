import { query, queryOne } from "@/lib/db";
import archiver from "archiver";
import { createReadStream, createWriteStream } from "fs";
import { stat, mkdir } from "fs/promises";
import path from "path";

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

    const zipDir = path.join(UPLOAD_DIR, "delivery", bookingId);
    await mkdir(zipDir, { recursive: true });
    const sanitizedName = booking.photographer_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    const zipFilename = `PhotoPortugal_${sanitizedName}.zip`;
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
