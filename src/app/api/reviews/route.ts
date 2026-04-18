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

    // Create review (pending approval)
    const review = await queryOne<{ id: string }>(
      `INSERT INTO reviews (booking_id, client_id, photographer_id, rating, title, text, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id`,
      [booking_id, userId, booking.photographer_id, rating, title || null, text || null]
    );

    // Don't update photographer rating yet — admin must approve first

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
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
