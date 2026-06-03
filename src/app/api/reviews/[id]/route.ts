import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { revalidatePath } from "next/cache";
import { sendEmail, sendReviewApprovedToPhotographer } from "@/lib/email";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

// PATCH - Edit or approve review (admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Build update dynamically
  const sets: string[] = [];
  const vals: (string | number | boolean | null)[] = [];
  let paramIdx = 1;

  if (body.rating !== undefined) { sets.push(`rating = $${paramIdx++}`); vals.push(body.rating); }
  if (body.title !== undefined) { sets.push(`title = $${paramIdx++}`); vals.push(body.title || null); }
  if (body.text !== undefined) { sets.push(`text = $${paramIdx++}`); vals.push(body.text || null); }
  if (body.is_approved !== undefined) {
    sets.push(`is_approved = $${paramIdx++}`); vals.push(body.is_approved);
    // Approving clears any prior reject — moving back into the active pool.
    if (body.is_approved === true) sets.push(`rejected_at = NULL`);
  }
  if (body.rejected !== undefined) {
    // Reject: explicit "decided no". Keeps the row for audit but drops
    // out of the pending queue. Also flips is_approved=FALSE so the
    // photographer's public profile never surfaces it.
    if (body.rejected === true) {
      sets.push(`rejected_at = NOW()`, `is_approved = FALSE`);
    } else {
      sets.push(`rejected_at = NULL`);
    }
  }
  if (body.client_name !== undefined) { sets.push(`client_name_override = $${paramIdx++}`); vals.push((body.client_name || "").trim() || null); }
  if (body.client_country !== undefined) { sets.push(`client_country_override = $${paramIdx++}`); vals.push((body.client_country || "").trim().toUpperCase().slice(0, 2) || null); }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  vals.push(id);
  const review = await queryOne<{ photographer_id: string; video_url: string | null; client_id: string | null; promo_code: string | null }>(
    `UPDATE reviews SET ${sets.join(", ")} WHERE id = $${paramIdx} RETURNING photographer_id, video_url, client_id, promo_code`,
    vals
  );

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Recalculate photographer rating (only approved reviews)
  await query(
    `UPDATE photographer_profiles SET
      review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1 AND is_approved = true),
      rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1 AND is_approved = true), 0)
     WHERE id = $1`,
    [review.photographer_id]
  );

  // Notify photographer that a review was approved
  if (body.is_approved === true) {
    try {
      const reviewDetails = await queryOne<{ rating: number; client_name: string; photographer_email: string; photographer_name: string; photographer_user_id: string; slug: string; title: string | null; text: string | null }>(
        `SELECT r.rating, r.title, r.text, COALESCE(r.client_name_override, cu.name, 'A client') as client_name,
                pu.email as photographer_email, pu.name as photographer_name, pu.id as photographer_user_id, pp.slug
         FROM reviews r
         LEFT JOIN users cu ON cu.id = r.client_id
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         WHERE r.id = $1`, [id]
      );
      if (reviewDetails) {
        sendReviewApprovedToPhotographer(
          reviewDetails.photographer_email, reviewDetails.photographer_name,
          reviewDetails.client_name, reviewDetails.rating, reviewDetails.slug,
          reviewDetails.title, reviewDetails.text
        ).catch(err => console.error("[reviews] review approved email error:", err));
        // Push to photographer — celebratory notif, opens profile.
        const stars = "⭐".repeat(reviewDetails.rating);
        import("@/lib/push").then(m =>
          m.sendPushNotification(
            reviewDetails.photographer_user_id,
            `${stars} ${(reviewDetails.client_name || "").split(" ")[0] || "A client"} left you a review`,
            "Tap to read it on your profile.",
            { type: "review", slug: reviewDetails.slug, channelId: "default", categoryId: "REVIEW" }
          )
        ).catch(err => console.error("[reviews] push error:", err));
        import("@/lib/realtime").then((m) =>
          m.notifyUser(reviewDetails.photographer_user_id, "review_approved")
        );
      }
    } catch (err) {
      console.error("[reviews] review approved notification error:", err);
    }
  }

  // Backfill the review thank-you code if the review was submitted
  // while Stripe promo-code creation was failing. No duplicate if it already
  // has a code from /api/reviews or /api/reviews/video. Video reviews keep
  // their larger reward even if the upload-time promo creation failed.
  if (body.is_approved === true && review.client_id && !review.promo_code) {
    try {
      const { createReviewRewardPromoCode } = await import("@/lib/stripe");
      const percentOff = review.video_url ? 15 : 10;
      const reward = await createReviewRewardPromoCode({ percentOff, validForDays: 365, reviewId: id });
      await query(
        "UPDATE reviews SET promo_code = $1, promo_code_id = $2 WHERE id = $3",
        [reward.code, reward.promotionCodeId, id]
      );

      const client = await queryOne<{ email: string; name: string }>(
        "SELECT email, name FROM users WHERE id = $1",
        [review.client_id]
      );
      if (client?.email) {
        const firstName = client.name?.split(" ")[0] || "";
        const { getUserLocaleById } = await import("@/lib/email-locale");
        const { buildReviewThankYouEmail } = await import("@/lib/review-thank-you-email");
        const locale = await getUserLocaleById(review.client_id);
        const email = buildReviewThankYouEmail({
          locale,
          firstName,
          code: reward.code,
          percentOff,
          isVideoReview: !!review.video_url,
        });
        await sendEmail(client.email, email.subject, email.html);
      }
    } catch (err) {
      console.error("[reviews] failed to backfill review reward:", err);
      try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/reviews/:id", method: "PATCH", statusCode: 500 }); } catch {}
    }
  }

  const slugRow = await queryOne<{ slug: string }>("SELECT slug FROM photographer_profiles WHERE id = $1", [review.photographer_id]);
  if (slugRow) revalidatePath(`/photographers/${slugRow.slug}`);
  revalidatePath("/");

  return NextResponse.json({ success: true });
}

// DELETE - Remove review (admin moderation)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  const review = await queryOne<{ photographer_id: string }>(
    "DELETE FROM reviews WHERE id = $1 RETURNING photographer_id",
    [id]
  );

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Recalculate photographer rating (only approved reviews)
  await query(
    `UPDATE photographer_profiles SET
      review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1 AND is_approved = true),
      rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1 AND is_approved = true), 0)
     WHERE id = $1`,
    [review.photographer_id]
  );

  // Revalidate
  const slugRow = await queryOne<{ slug: string }>("SELECT slug FROM photographer_profiles WHERE id = $1", [review.photographer_id]);
  if (slugRow) revalidatePath(`/photographers/${slugRow.slug}`);
  revalidatePath("/");

  return NextResponse.json({ success: true });
}
