import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB per delivery photo
const MAX_DELIVERY_PHOTOS = 200; // max photos per delivery
const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";


// GET: List delivery photos for a booking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id?: string }).id;

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id?: string }).id;

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

      // Auto-send message in booking chat with link + password
      try {
        const photoCount = await queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM delivery_photos WHERE booking_id = $1", [id]
        );
        const count = photoCount?.count || "0";

        await queryOne(
          `INSERT INTO messages (booking_id, sender_id, text) VALUES ($1, $2, $3)`,
          [id, userId, `📸 Your ${count} photos are ready!\n\n🔗 Gallery: ${deliveryUrl}\n🔑 Password: ${password}\n\nThis link is available for 90 days. You can view photos online or download them all as a ZIP file.`]
        );
      } catch (e) {
        console.error("[delivery] chat message error:", e);
      }

      // Send email to client with gallery link and password
      try {
        const details = await queryOne<{ client_email: string; client_name: string; photographer_name: string }>(
          `SELECT u.email as client_email, u.name as client_name, pp.display_name as photographer_name
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           WHERE b.id = $1`, [id]
        );

        if (details) {
          await sendEmail(
            details.client_email,
            `Your photos from ${details.photographer_name} are ready!`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Your Photos Are Ready!</h2>
              <p>Hi ${details.client_name},</p>
              <p><strong>${details.photographer_name}</strong> has delivered your photos from the photoshoot.</p>
              <p>Open the gallery below and enter the password to view and download your photos.</p>
              <div style="margin: 16px 0; padding: 16px; background: #faf8f5; border-radius: 8px; border: 1px solid #e8e0d8;">
                <p style="margin: 0 0 4px 0; font-size: 13px; color: #5f4a3d;"><strong>Gallery Password:</strong></p>
                <p style="margin: 0; font-size: 18px; font-family: monospace; color: #C94536; letter-spacing: 1px;"><strong>${password}</strong></p>
              </div>
              <p><a href="${deliveryUrl}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Open Photo Gallery</a></p>
              <p style="margin-top: 16px; padding: 12px; background: #faf8f5; border-radius: 8px; font-size: 13px; color: #5f4a3d;">
                <strong>Important:</strong> Please review your photos and click "Accept Delivery" in the gallery. Your photos will be available for download for <strong>60 days</strong> after acceptance.
              </p>
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
          `SELECT b.client_id, cu.phone as client_phone, pp.display_name as photographer_name
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           WHERE b.id = $1`,
          [id]
        );
        if (deliveryDetails?.client_phone) {
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [deliveryDetails.client_id]
          );
          if (smsPrefs?.sms_bookings !== false) {
            sendSMS(
              deliveryDetails.client_phone,
              `Photo Portugal: Your photos from ${deliveryDetails.photographer_name} are ready! Check your email for the gallery link.`
            ).catch(err => console.error("[sms] error:", err));
          }
        }
      } catch (smsErr) {
        console.error("[delivery] sms error:", smsErr);
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
      if (file.size > MAX_FILE_SIZE) continue;
      if (!file.type.startsWith("image/")) continue;

      const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
      const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
      const ext = ALLOWED_EXT.includes(rawExt) ? rawExt : "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(deliveryDir, filename), buffer);

      const url = `/uploads/delivery/${id}/${filename}`;
      const item = await queryOne<{ id: string }>(
        `INSERT INTO delivery_photos (booking_id, url, filename, file_size, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [id, url, file.name, file.size, sortOrder++]
      );

      uploaded.push({ id: item?.id, url, filename: file.name, file_size: file.size });
    }

    return NextResponse.json({ success: true, uploaded, count: uploaded.length });
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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id?: string }).id;
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

  const photo = await queryOne<{ url: string }>(
    "DELETE FROM delivery_photos WHERE id = $1 AND booking_id = $2 RETURNING url",
    [photoId, id]
  );

  if (photo) {
    try {
      const filePath = path.join(UPLOAD_DIR, photo.url.replace("/uploads/", ""));
      await unlink(filePath);
    } catch {}
  }

  return NextResponse.json({ success: true });
}
