import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Create a review (client only, after completed booking)
export async function POST(req: NextRequest) {
  const mobileUser = await authFromRequest(req);
  const session = !mobileUser ? await auth() : null;
  const userId = mobileUser?.id || (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { booking_id, rating, title, text } = await req.json();

    if (!booking_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "booking_id and rating (1-5) required" }, { status: 400 });
    }

    // Verify: booking exists, belongs to this client, is completed, no existing review
    const booking = await queryOne<{ id: string; client_id: string; photographer_id: string; status: string }>(
      "SELECT id, client_id, photographer_id, status FROM bookings WHERE id = $1",
      [booking_id]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId) {
      return NextResponse.json({ error: "Not your booking" }, { status: 403 });
    }

    if (booking.status !== "completed" && booking.status !== "delivered") {
      return NextResponse.json({ error: "Can only review completed sessions" }, { status: 400 });
    }

    const existingReview = await queryOne(
      "SELECT id FROM reviews WHERE booking_id = $1",
      [booking_id]
    );

    if (existingReview) {
      return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
    }

    // Create review (pending approval). Capture client locale as source_locale so we can
    // offer "show original" toggle in UI later.
    const clientLocale = await queryOne<{ locale: string | null }>(
      "SELECT locale FROM users WHERE id = $1",
      [userId]
    );
    const sourceLocale = clientLocale?.locale || "en";
    const review = await queryOne<{ id: string }>(
      `INSERT INTO reviews (booking_id, client_id, photographer_id, rating, title, text, is_approved, source_locale)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       RETURNING id`,
      [booking_id, userId, booking.photographer_id, rating, title || null, text || null, sourceLocale]
    );

    // Fire-and-forget translation if review has any text content
    if (review && (title || text)) {
      import("@/lib/translate-content").then(({ translateReview }) =>
        translateReview(review.id, title || null, text || null, sourceLocale),
      ).catch((e) => console.error("[reviews] translate error:", e));
    }

    // Don't update photographer rating yet — admin must approve first

    // Mint a 10% off promo code as a thank-you and email it to the client.
    // Fire-and-forget — Stripe outages must not fail the review POST.
    if (review) {
      (async () => {
        try {
          const { createReviewRewardPromoCode } = await import("@/lib/stripe");
          const reward = await createReviewRewardPromoCode({ percentOff: 10, validForDays: 365, reviewId: review.id });
          await query(
            "UPDATE reviews SET promo_code = $1, promo_code_id = $2 WHERE id = $3",
            [reward.code, reward.promotionCodeId, review.id]
          );
          const client = await queryOne<{ email: string; name: string }>(
            "SELECT email, name FROM users WHERE id = $1",
            [userId]
          );
          if (client?.email) {
            const firstName = client.name?.split(" ")[0] || "";
            const { sendEmail } = await import("@/lib/email");
            await sendEmail(
              client.email,
              "Your 10% off code is here 🎁",
              `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #C94536;">Thank you for the review${firstName ? `, ${firstName}` : ""}!</h2>
                <p>Reviews like yours help travelers find the right photographer — really, thank you.</p>
                <p>As promised, here's your <strong>10% off code</strong> for any future booking on Photo Portugal:</p>
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
          console.error("[reviews] promo reward error:", err);
          try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/reviews", method: "POST", statusCode: 500 }); } catch {}
        }
      })().catch(() => {});
    }

    // Admin-only notifications (photographer is notified after approval, not before)
    try {
      const info = await queryOne<{ email: string; name: string }>(
        `SELECT u.email, u.name FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
        [booking.photographer_id]
      );
      const client = await queryOne<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]);
      if (info && client) {
        // Telegram: notify admin of new review
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`⭐ <b>New Review!</b>\n\n${"★".repeat(rating)}${"☆".repeat(5-rating)} from ${client!.name}\nFor: ${info!.name}${title ? `\n"${title}"` : ""}`, "clients");
        }).catch((err) => console.error("[reviews] telegram error:", err));

        // Email: notify admin of new review
        import("@/lib/email").then(({ sendEmail, getAdminEmail }) => {
          getAdminEmail().then(adminEmail => {
            sendEmail(adminEmail, `New review: ${rating}★ from ${client!.name} for ${info!.name}`,
              `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #C94536;">New Review Submitted</h2>
                <p><strong>${rating}★</strong> from <strong>${client!.name}</strong> for <strong>${info!.name}</strong></p>
                ${title ? `<p><strong>${title}</strong></p>` : ""}
                ${text ? `<p>${text.slice(0, 300)}</p>` : ""}
                <p><a href="https://photoportugal.com/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review in Admin</a></p>
              </div>`
            );
          });
        }).catch((err) => console.error("[reviews] admin email error:", err));
      }
    } catch {}

    // Revalidate photographer profile and homepage
    const slugRow = await queryOne<{ slug: string }>("SELECT slug FROM photographer_profiles WHERE id = $1", [booking.photographer_id]);
    if (slugRow) revalidatePath(`/photographers/${slugRow.slug}`);
    revalidatePath("/");

    return NextResponse.json({ success: true, id: review?.id });
  } catch (error) {
    console.error("[reviews] create error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/reviews", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
