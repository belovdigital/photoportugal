import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { getPresignedPutUrl } from "@/lib/s3";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Server-side mirrors of the limits enforced in the main /delivery POST. We
// duplicate them here rather than import to keep this endpoint self-contained.
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DELIVERY_PHOTOS = 200;
const MAX_DELIVERY_VIDEOS = 10;
const ALLOWED_VID_EXT = ["mp4", "mov", "webm", "m4v"];

/**
 * Issue a presigned PUT URL so the photographer's browser can upload a
 * video directly to R2, bypassing Cloudflare's 100MB body limit on the
 * proxy edge.
 *
 * Request body: { filename, content_type, file_size }
 * Response: { upload_url, s3_key, download_filename }
 *
 * Validation runs BEFORE the URL is signed: ownership, file extension,
 * size cap, video-count cap, status preconditions. If anything fails we
 * never hand out a URL — so a malicious client can't burn R2 quota by
 * mass-uploading. The signature itself locks both content-type and
 * exact byte length, so the client can't swap files at upload time.
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
    photographer_name: string;
  }>(
    `SELECT u.id as photographer_user_id, b.status,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            u.name as photographer_name
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`,
    [id]
  );

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Only the photographer can upload delivery videos" }, { status: 403 });
  }
  if (!["completed", "delivered"].includes(booking.status)) {
    return NextResponse.json({ error: "Booking must be completed first" }, { status: 400 });
  }
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "Delivery has been accepted by the client and can no longer be modified" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  const fileSize = typeof body.file_size === "number" ? body.file_size : Number(body.file_size);

  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });
  if (!Number.isFinite(fileSize) || fileSize <= 0) return NextResponse.json({ error: "file_size required" }, { status: 400 });
  if (fileSize > MAX_VIDEO_SIZE) {
    return NextResponse.json({
      error: `Video too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Max ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
    }, { status: 400 });
  }

  const rawExt = (filename.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_VID_EXT.includes(rawExt)) {
    return NextResponse.json({
      error: `Unsupported video format .${rawExt || "unknown"}. Allowed: ${ALLOWED_VID_EXT.join(", ")}`,
    }, { status: 400 });
  }

  const counts = await queryOne<{ total: string; videos: string }>(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE media_type = 'video') as videos
       FROM delivery_photos WHERE booking_id = $1`,
    [id]
  );
  const totalCount = parseInt(counts?.total || "0");
  const videoCount = parseInt(counts?.videos || "0");

  if (totalCount >= MAX_DELIVERY_PHOTOS) {
    return NextResponse.json({ error: `Delivery limit reached (max ${MAX_DELIVERY_PHOTOS} items)` }, { status: 403 });
  }
  if (videoCount >= MAX_DELIVERY_VIDEOS) {
    return NextResponse.json({ error: `Video limit reached (max ${MAX_DELIVERY_VIDEOS} per delivery)` }, { status: 403 });
  }

  // Pretty client-facing download name (mirrors the logic in the main
  // delivery route so all delivery filenames look the same regardless of
  // upload path).
  const sanitizedPhotographer = (booking.photographer_name || "Photographer")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  const bookingShort = id.replace(/-/g, "").slice(0, 8);
  const seq = totalCount + 1;
  const downloadFilename = `PhotoPortugal_${sanitizedPhotographer}_${bookingShort}_${String(seq).padStart(3, "0")}.${rawExt}`;

  const uniqueName = `${crypto.randomUUID()}.${rawExt}`;
  const s3Key = `delivery/${id}/${uniqueName}`;
  const finalContentType = contentType.startsWith("video/") ? contentType : `video/${rawExt}`;

  const uploadUrl = await getPresignedPutUrl(s3Key, finalContentType, fileSize, 60 * 15);

  return NextResponse.json({
    upload_url: uploadUrl,
    s3_key: s3Key,
    content_type: finalContentType,
    download_filename: downloadFilename,
  });
}
