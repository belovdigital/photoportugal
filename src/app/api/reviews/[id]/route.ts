import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { revalidatePath } from "next/cache";
import { requireStripe } from "@/lib/stripe";
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
  if (body.is_approved !== undefined) { sets.push(`is_approved = $${paramIdx++}`); vals.push(body.is_approved); }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  vals.push(id);
  const review = await queryOne<{ photographer_id: string; video_url: string | null; client_id: string | null }>(
    `UPDATE reviews SET ${sets.join(", ")} WHERE id = $${paramIdx} RETURNING photographer_id, video_url, client_id`,
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
      const reviewDetails = await queryOne<{ rating: number; client_name: string; photographer_email: string; photographer_name: string; slug: string }>(
        `SELECT r.rating, COALESCE(r.client_name_override, cu.name, 'A client') as client_name,
                pu.email as photographer_email, pp.display_name as photographer_name, pp.slug
         FROM reviews r
         LEFT JOIN users cu ON cu.id = r.client_id
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         WHERE r.id = $1`, [id]
      );
      if (reviewDetails) {
        sendReviewApprovedToPhotographer(
          reviewDetails.photographer_email, reviewDetails.photographer_name,
          reviewDetails.client_name, reviewDetails.rating, reviewDetails.slug
        ).catch(err => console.error("[reviews] review approved email error:", err));
      }
    } catch (err) {
      console.error("[reviews] review approved notification error:", err);
    }
  }

  // If approving a VIDEO review, generate discount code and email client
  if (body.is_approved === true && review.video_url && review.client_id) {
    try {
      const stripe = requireStripe();
      const coupon = await stripe.coupons.create({
        percent_off: 10,
        duration: "once",
        name: "Video Review Reward",
        metadata: { review_id: id, type: "video_review" },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promoCode = await (stripe.promotionCodes.create as any)({
        coupon: coupon.id,
        max_redemptions: 1,
        metadata: { review_id: id },
      });

      // Email the discount code to the client
      const client = await queryOne<{ email: string; name: string }>(
        "SELECT email, name FROM users WHERE id = $1", [review.client_id]
      );
      if (client) {
        const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
        sendEmail(
          client.email,
          "Your 10% discount code — thank you for your video review!",
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Thank you for your video review! 🎬</h2>
            <p>Hi ${client.name},</p>
            <p>Your video review has been approved and is now live on the photographer's profile. As a thank you, here's your exclusive discount code:</p>
            <div style="margin: 24px 0; padding: 20px; background: #faf8f5; border-radius: 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #666;">Your discount code:</p>
              <p style="margin: 0; font-size: 28px; font-weight: bold; font-family: monospace; color: #C94536; letter-spacing: 3px;">${promoCode.code}</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #666;">10% off your next booking — no expiry date</p>
            </div>
            <p><a href="${BASE_URL}/photographers" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Book Your Next Session</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        ).catch(err => console.error("[reviews] Failed to send discount email:", err));
      }
    } catch (err) {
      console.error("[reviews] Failed to create video review promo code:", err);
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
