import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import crypto from "crypto";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const reviewId = formData.get("review_id") as string;

    if (!file || !reviewId) {
      return NextResponse.json({ error: "File and review_id required" }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: "Video too large (max 50MB)" }, { status: 400 });
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files allowed" }, { status: 400 });
    }

    // Verify review belongs to user
    const userId = (session.user as { id?: string }).id;
    const review = await queryOne<{ id: string; client_id: string | null; promo_code: string | null; promo_code_id: string | null }>(
      "SELECT id, client_id, promo_code, promo_code_id FROM reviews WHERE id = $1",
      [reviewId]
    );

    if (!review || review.client_id !== userId) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const ext = file.type.includes("mp4") ? "mp4" : "webm";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const r2Key = `reviews/videos/${filename}`;
    await uploadToS3(r2Key, buffer, file.type || `video/${ext}`);
    const videoUrl = `${R2_PUBLIC_URL}/${r2Key}`;

    // Store video URL in review
    await queryOne(
      "UPDATE reviews SET video_url = $1 WHERE id = $2 RETURNING id",
      [videoUrl, reviewId]
    );

    // Upgrade reward: video reviewers get 15% (vs 10% for text-only). If a
    // 10% code was already minted on /api/reviews, deactivate it and replace.
    // Fire-and-forget so Stripe outages don't fail the upload.
    (async () => {
      try {
        const { createReviewRewardPromoCode, requireStripe } = await import("@/lib/stripe");
        if (review.promo_code_id) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (requireStripe().promotionCodes.update as any)(review.promo_code_id, { active: false });
          } catch (e) {
            console.error("[reviews/video] could not deactivate previous promo:", e);
          }
        }
        const reward = await createReviewRewardPromoCode({ percentOff: 15, validForDays: 365, reviewId: review.id });
        await queryOne(
          "UPDATE reviews SET promo_code = $1, promo_code_id = $2 WHERE id = $3 RETURNING id",
          [reward.code, reward.promotionCodeId, review.id]
        );
        const client = await queryOne<{ email: string; name: string }>(
          "SELECT email, name FROM users WHERE id = $1",
          [userId]
        );
        if (client?.email) {
          const firstName = client.name?.split(" ")[0] || "";
          const upgraded = !!review.promo_code; // had a 10% one before
          const { sendEmail } = await import("@/lib/email");
          await sendEmail(
            client.email,
            "Your 15% off code is here 🎬",
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Thank you for the video review${firstName ? `, ${firstName}` : ""}!</h2>
              <p>Video reviews are gold — they help travelers feel confident about booking. Really, thank you.</p>
              ${upgraded ? `<p style="background: #FFF3E0; border: 1px solid #FFB74D; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #6D4C41;">Your previous 10% code has been upgraded to <strong>15% off</strong>. Use the new code below.</p>` : ""}
              <p>Here's your <strong>15% off code</strong> for any future booking on Photo Portugal:</p>
              <div style="background: #FFF8E1; border: 2px dashed #FFCA28; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                <div style="font-size: 11px; color: #888; letter-spacing: 1px; text-transform: uppercase;">Your code</div>
                <div style="font-size: 28px; font-weight: 800; letter-spacing: 2px; color: #333; margin-top: 6px; font-family: monospace;">${reward.code}</div>
                <div style="font-size: 12px; color: #666; margin-top: 8px;">Valid for 12 months · One use</div>
              </div>
              <p>Apply it at checkout when you book your next session.</p>
              <p><a href="https://photoportugal.com" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Browse photographers</a></p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );
        }
      } catch (err) {
        console.error("[reviews/video] promo upgrade error:", err);
        try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/reviews/video", method: "POST", statusCode: 500 }); } catch {}
      }
    })().catch(() => {});

    return NextResponse.json({ success: true, url: videoUrl });
  } catch (error) {
    console.error("[reviews/video] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/reviews/video", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
