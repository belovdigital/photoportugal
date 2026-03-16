import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

// Create a review (client only, after completed booking)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

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

    if (booking.status !== "completed") {
      return NextResponse.json({ error: "Can only review completed bookings" }, { status: 400 });
    }

    const existingReview = await queryOne(
      "SELECT id FROM reviews WHERE booking_id = $1",
      [booking_id]
    );

    if (existingReview) {
      return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
    }

    // Create review
    const review = await queryOne<{ id: string }>(
      `INSERT INTO reviews (booking_id, client_id, photographer_id, rating, title, text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [booking_id, userId, booking.photographer_id, rating, title || null, text || null]
    );

    // Update photographer rating
    await query(
      `UPDATE photographer_profiles SET
        review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1),
        rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1)
       WHERE id = $1`,
      [booking.photographer_id]
    );

    return NextResponse.json({ success: true, id: review?.id });
  } catch (error) {
    console.error("[reviews] create error:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
