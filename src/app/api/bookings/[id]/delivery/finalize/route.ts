import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import {
  headS3Object,
  uploadToS3,
  getPresignedUrl,
  s3KeyFromPath,
  downloadS3ObjectAsBuffer,
} from "@/lib/s3";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_DELIVERY_PHOTOS = 200;
const MAX_DELIVERY_VIDEOS = 10;

/**
 * Called by the browser AFTER it has uploaded a video to R2 via the
 * presigned PUT URL. Verifies the object actually landed in R2, inserts
 * the delivery_photos row, and kicks off thumbnail/metadata extraction
 * in the background (we have to fetch the file back from R2 to run
 * ffmpeg — egress from R2 is free, so it costs us only memory + CPU).
 *
 * If thumbnail extraction fails, the row stays in place without a
 * thumbnail; the gallery already falls back to a generic video icon.
 *
 * Request body: { s3_key, filename, file_size, download_filename }
 * Response: { uploaded: [{ id, url, ... }] } — same shape as the legacy
 * multipart endpoint so the client merge logic is unchanged.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const userId = authUser.id;

  const booking = await queryOne<{
    photographer_user_id: string;
    status: string;
    delivery_accepted: boolean;
  }>(
    `SELECT u.id as photographer_user_id, b.status,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`,
    [id]
  );

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Only the photographer can finalize delivery videos" }, { status: 403 });
  }
  if (!["completed", "delivered"].includes(booking.status)) {
    return NextResponse.json({ error: "Booking must be completed first" }, { status: 400 });
  }
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "Delivery has been accepted by the client and can no longer be modified" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const s3Key = typeof body.s3_key === "string" ? body.s3_key.trim() : "";
  const originalFilename = typeof body.filename === "string" ? body.filename.trim() : "video";
  const downloadFilename = typeof body.download_filename === "string" ? body.download_filename.trim() : originalFilename;

  // Tight key check — must be inside this booking's namespace, otherwise
  // we'd let one photographer's finalize call register an arbitrary R2
  // object as their own delivery photo.
  const expectedPrefix = `delivery/${id}/`;
  if (!s3Key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid s3_key" }, { status: 400 });
  }

  // HEAD R2 to confirm the upload actually landed and to get the real
  // size/content-type from the storage layer (don't trust client claims).
  const head = await headS3Object(s3Key);
  if (!head) return NextResponse.json({ error: "Object not found in R2 — upload didn't complete" }, { status: 400 });
  if (head.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: "Uploaded file exceeds size limit" }, { status: 400 });
  }
  if (head.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }

  // Re-check counts at finalize-time — guards against races where the
  // photographer fired off N concurrent presigns and they all came back
  // before any finalize ran.
  const counts = await queryOne<{ total: string; videos: string }>(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE media_type = 'video') as videos
       FROM delivery_photos WHERE booking_id = $1`,
    [id]
  );
  const totalCount = parseInt(counts?.total || "0");
  const videoCount = parseInt(counts?.videos || "0");
  if (totalCount >= MAX_DELIVERY_PHOTOS || videoCount >= MAX_DELIVERY_VIDEOS) {
    return NextResponse.json({ error: "Delivery limit reached" }, { status: 403 });
  }

  const dbUrl = `s3://${s3Key}`;

  // Insert the row WITHOUT thumbnail/dimensions first — we'll fill them
  // in once ffmpeg finishes in the background.
  const item = await queryOne<{ id: string }>(
    `INSERT INTO delivery_photos
       (booking_id, url, filename, file_size, sort_order, media_type)
     VALUES ($1, $2, $3, $4, $5, 'video') RETURNING id`,
    [id, dbUrl, downloadFilename, head.size, totalCount]
  );

  // Background metadata extraction — fetch the file back from R2, run
  // ffmpeg/ffprobe, then UPDATE the row. Fire-and-forget; the client
  // already has the basic record and will see the thumbnail on the next
  // gallery refresh.
  (async () => {
    try {
      const buffer = await downloadS3ObjectAsBuffer(s3Key);
      const { processVideoUpload } = await import("@/lib/video-processor");
      const meta = await processVideoUpload(buffer, originalFilename);
      const thumbS3Key = `delivery/${id}/thumb_${crypto.randomUUID()}.jpg`;
      await uploadToS3(thumbS3Key, meta.thumbnailBuffer, "image/jpeg");
      await queryOne(
        `UPDATE delivery_photos
            SET thumbnail_url = $1, duration_seconds = $2, width = $3, height = $4
          WHERE id = $5`,
        [`s3://${thumbS3Key}`, meta.duration || null, meta.width || null, meta.height || null, item?.id]
      );
    } catch (err) {
      console.error("[delivery/finalize] background thumbnail error:", err);
      // Non-fatal: the gallery falls back to a generic video icon.
    }
  })();

  const publicUrl = await getPresignedUrl(s3KeyFromPath(dbUrl), 3600);
  return NextResponse.json({
    uploaded: [{
      id: item?.id,
      url: publicUrl,
      thumbnail_url: null, // populated by background job
      filename: downloadFilename,
      file_size: head.size,
      media_type: "video",
      duration_seconds: null,
      width: null,
      height: null,
    }],
  });
}
