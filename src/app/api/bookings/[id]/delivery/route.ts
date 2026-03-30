import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per delivery photo (high-res)
const MAX_DELIVERY_PHOTOS = 200; // max photos per delivery
const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";


// GET: List delivery photos for a booking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = authUser.id;

  const booking = await queryOne<{ client_id: string; photographer_user_id: string; status: string; delivery_token: string | null }>(
    `SELECT b.client_id, u.id as photographer_user_id, b.status, b.delivery_token
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`, [id]
  );

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }



  const photos = await query(
    "SELECT id, url, filename, file_size, sort_order, created_at FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
    [id]
  );

  return NextResponse.json({
    photos,
    delivery_token: booking.delivery_token,
    status: booking.status,
  });
}

// POST: Upload delivery photos or share with client
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = authUser.id;

  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string; client_id: string; status: string }>(
    `SELECT b.photographer_id, u.id as photographer_user_id, b.client_id, b.status
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`, [id]
  );

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Only the photographer can upload delivery photos" }, { status: 403 });
  }
  if (!["completed", "delivered"].includes(booking.status)) {
    return NextResponse.json({ error: "Booking must be completed first" }, { status: 400 });
  }



  const contentType = req.headers.get("content-type") || "";

  // Check if this is a "share" action (JSON body)
  if (contentType.includes("application/json")) {
    const body = await req.json();

    if (body.action === "share") {
      const password = body.password?.trim();
      if (!password || password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }

      // Generate delivery token and mark as delivered
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      const { hash: bcryptHash } = await import("bcryptjs");
      const hashedPassword = await bcryptHash(password, 10);

      // Add 'delivered' to enum if not exists
      try {
        await queryOne("ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'delivered' AFTER 'completed'", []);
      } catch {}

      await queryOne(
        "UPDATE bookings SET status = 'delivered', delivery_token = $1, delivery_password = $2, delivery_expires_at = $3 WHERE id = $4 RETURNING id",
        [token, hashedPassword, expiresAt.toISOString(), id]
      );

      const deliveryUrl = `${BASE_URL}/delivery/${token}`;

      const photoCount = await queryOne<{ count: string }>(
        "SELECT COUNT(*) as count FROM delivery_photos WHERE booking_id = $1", [id]
      );
      const count = photoCount?.count || "0";

      // Auto-send message in booking chat with link + password
      try {

        await queryOne(
          `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
          [id, userId, `DELIVERY:${count}:${deliveryUrl}:${password}`]
        );
      } catch (e) {
        console.error("[delivery] chat message error:", e);
      }

      // Send email to client with gallery link and password
      try {
        const details = await queryOne<{ client_email: string; client_name: string; photographer_name: string }>(
          `SELECT u.email as client_email, u.name as client_name, pu.name as photographer_name
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`, [id]
        );

        if (details) {
          const firstName = details.client_name?.split(" ")[0] || "there";
          await sendEmail(
            details.client_email,
            `${details.photographer_name} has uploaded your photo previews — please review`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Your Photo Previews Are Ready!</h2>
              <p>Hi ${firstName},</p>
              <p><strong>${details.photographer_name}</strong> has uploaded <strong>${count} photo previews</strong> from your session for you to review.</p>
              <p>Please take a moment to browse through them. The previews include a watermark — this is normal and will be removed once you approve the delivery.</p>

              <div style="margin: 20px 0; padding: 16px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                <p style="margin: 0 0 8px 0; font-weight: bold; color: #166534;">What to do:</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 4px 0; color: #166534; font-weight: bold; vertical-align: top;">1.</td><td style="padding: 4px 8px;">Open the gallery and review your photos</td></tr>
                  <tr><td style="padding: 4px 0; color: #166534; font-weight: bold; vertical-align: top;">2.</td><td style="padding: 4px 8px;">If you're happy, click <strong>"Accept Delivery"</strong></td></tr>
                  <tr><td style="padding: 4px 0; color: #166534; font-weight: bold; vertical-align: top;">3.</td><td style="padding: 4px 8px;">You'll get full-resolution photos without watermarks + a ZIP download</td></tr>
                </table>
              </div>

              <div style="margin: 16px 0; padding: 16px; background: #faf8f5; border-radius: 8px; border: 1px solid #e8e0d8;">
                <p style="margin: 0 0 4px 0; font-size: 13px; color: #5f4a3d;"><strong>Gallery Password:</strong></p>
                <p style="margin: 0; font-size: 24px; font-family: monospace; color: #C94536; letter-spacing: 3px;"><strong>${password}</strong></p>
              </div>

              <p><a href="${deliveryUrl}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Review Your Photos</a></p>

              <p style="margin-top: 16px; font-size: 13px; color: #666;">Not happy with the results? You can report an issue directly from the gallery and our team will help resolve it within 48 hours.</p>
              <p style="font-size: 12px; color: #999;">This gallery is available until ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );
        }
      } catch (e) {
        console.error("[delivery] email error:", e);
      }

      // SMS to client about delivery
      try {
        const deliveryDetails = await queryOne<{
          client_id: string; client_phone: string | null; photographer_name: string;
        }>(
          `SELECT b.client_id, cu.phone as client_phone, pu.name as photographer_name
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`,
          [id]
        );
        if (deliveryDetails?.client_phone) {
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [deliveryDetails.client_id]
          );
          if (smsPrefs?.sms_bookings !== false) {
            sendWhatsApp(
              deliveryDetails.client_phone,
              "photos_delivered",
              [deliveryDetails.photographer_name],
              `Photo Portugal: Your photos from ${deliveryDetails.photographer_name} are ready! Check your email for the gallery link.`
            ).catch(err => console.error("[whatsapp] error:", err));
          }
        }
      } catch (smsErr) {
        console.error("[delivery] whatsapp/sms error:", smsErr);
      }

      return NextResponse.json({ success: true, token, deliveryUrl });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // File upload
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      const singleFile = formData.get("file") as File;
      if (singleFile) files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate all files upfront before writing any to disk
    const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "tiff"];
    const ALLOWED_MIME_PREFIXES = ["image/"];
    const rejectedFiles: string[] = [];

    for (const file of files) {
      if (!file.type || !ALLOWED_MIME_PREFIXES.some(prefix => file.type.startsWith(prefix))) {
        rejectedFiles.push(`"${file.name}" — not an image file (type: ${file.type || "unknown"})`);
        continue;
      }
      const rawExt = (file.name.split(".").pop() || "").toLowerCase();
      if (!rawExt || !ALLOWED_EXT.includes(rawExt)) {
        rejectedFiles.push(`"${file.name}" — unsupported file type (.${rawExt || "unknown"}). Allowed: ${ALLOWED_EXT.join(", ")}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`"${file.name}" — file too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        continue;
      }
    }

    if (rejectedFiles.length === files.length) {
      return NextResponse.json({
        error: "All files were rejected",
        details: rejectedFiles,
      }, { status: 400 });
    }

    const deliveryDir = path.join(UPLOAD_DIR, "delivery", id);
    await mkdir(deliveryDir, { recursive: true });

    const currentCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM delivery_photos WHERE booking_id = $1", [id]
    );
    let sortOrder = parseInt(currentCount?.count || "0");

    if (sortOrder >= MAX_DELIVERY_PHOTOS) {
      return NextResponse.json({ error: `Delivery limit reached (max ${MAX_DELIVERY_PHOTOS} photos)` }, { status: 403 });
    }

    const uploaded = [];
    for (const file of files) {
      // Skip files that fail validation
      if (!file.type || !file.type.startsWith("image/")) continue;
      const rawExt = (file.name.split(".").pop() || "").toLowerCase();
      if (!rawExt || !ALLOWED_EXT.includes(rawExt)) continue;
      if (file.size > MAX_FILE_SIZE) continue;

      const ext = rawExt;
      const filename = `${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const originalPath = path.join(deliveryDir, filename);
      await writeFile(originalPath, buffer);

      const url = `/uploads/delivery/${id}/${filename}`;

      // Generate watermarked preview
      let previewUrl: string | null = null;
      try {
        const previewFilename = `preview_${crypto.randomUUID()}.jpg`;
        const previewPath = path.join(deliveryDir, previewFilename);
        const watermarkPath = path.join(process.cwd(), "public", "icon-512.png");

        // Resize original for preview
        const { data: previewBuffer, info: previewInfo } = await sharp(buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 60 })
          .toBuffer({ resolveWithObject: true });

        // Prepare watermark: resize to fit and set opacity
        const previewWidth = previewInfo.width || 1200;
        const previewHeight = previewInfo.height || 800;
        const wmSize = Math.min(previewWidth, previewHeight, 256);
        const watermark = await sharp(watermarkPath)
          .resize({ width: wmSize, height: wmSize, fit: "inside" })
          .ensureAlpha()
          .composite([{
            input: Buffer.from([255, 255, 255, Math.round(255 * 0.3)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: "dest-in",
          }])
          .toBuffer();

        // Composite watermark onto preview at center
        await sharp(previewBuffer)
          .composite([{ input: watermark, gravity: "centre" }])
          .jpeg({ quality: 60 })
          .toFile(previewPath);

        previewUrl = `/uploads/delivery/${id}/${previewFilename}`;
      } catch (previewErr) {
        console.error("[delivery] preview generation error:", previewErr);
        // Continue without preview — full-res will be used as fallback
      }

      const item = await queryOne<{ id: string }>(
        `INSERT INTO delivery_photos (booking_id, url, preview_url, filename, file_size, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [id, url, previewUrl, file.name, file.size, sortOrder++]
      );

      uploaded.push({ id: item?.id, url, filename: file.name, file_size: file.size });
    }

    return NextResponse.json({
      success: true,
      uploaded,
      count: uploaded.length,
      ...(rejectedFiles.length > 0 ? { rejected: rejectedFiles } : {}),
    });
  } catch (error) {
    console.error("[delivery] upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// DELETE: Remove a delivery photo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");

  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  const booking = await queryOne<{ photographer_user_id: string }>(
    `SELECT u.id as photographer_user_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`, [id]
  );

  if (!booking || booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const photo = await queryOne<{ url: string; preview_url: string | null }>(
    "DELETE FROM delivery_photos WHERE id = $1 AND booking_id = $2 RETURNING url, preview_url",
    [photoId, id]
  );

  if (photo) {
    // Delete original file
    try {
      await unlink(path.join(UPLOAD_DIR, photo.url.replace("/uploads/", "")));
    } catch {}
    // Delete preview/watermark file
    if (photo.preview_url) {
      try {
        await unlink(path.join(UPLOAD_DIR, photo.preview_url.replace("/uploads/", "")));
      } catch {}
    }
  }

  return NextResponse.json({ success: true });
}
