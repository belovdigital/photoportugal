import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { name } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    await queryOne("UPDATE users SET name = $1 WHERE id = $2 RETURNING id", [name.trim(), userId]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { confirmation } = await req.json();
    if (confirmation !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // Get all booking IDs where user is the client
    const clientBookings = await query<{ id: string }>(
      "SELECT id FROM bookings WHERE client_id = $1",
      [userId]
    );
    const clientBookingIds = clientBookings.map((b) => b.id);

    // 1. Delete delivery_photos for user's bookings
    if (clientBookingIds.length > 0) {
      await query(
        `DELETE FROM delivery_photos WHERE booking_id = ANY($1)`,
        [clientBookingIds]
      );
    }

    // 2. Delete messages for user's bookings (as client) + messages sent by user
    if (clientBookingIds.length > 0) {
      await query(
        `DELETE FROM messages WHERE booking_id = ANY($1)`,
        [clientBookingIds]
      );
    }
    await query("DELETE FROM messages WHERE sender_id = $1", [userId]);

    // 3. Delete review_photos for user's reviews, then reviews
    const userReviews = await query<{ id: string }>(
      "SELECT id FROM reviews WHERE client_id = $1",
      [userId]
    );
    const reviewIds = userReviews.map((r) => r.id);
    if (reviewIds.length > 0) {
      await query(
        `DELETE FROM review_photos WHERE review_id = ANY($1)`,
        [reviewIds]
      );
    }
    await query("DELETE FROM reviews WHERE client_id = $1", [userId]);

    // 4. Delete disputes by user
    await query("DELETE FROM disputes WHERE client_id = $1", [userId]);

    // 5. Delete bookings where client_id = userId
    if (clientBookingIds.length > 0) {
      await query(
        `DELETE FROM bookings WHERE id = ANY($1)`,
        [clientBookingIds]
      );
    }

    // 6. If user is photographer: delete photographer-related data
    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );
    if (profile) {
      // Get bookings where this photographer is involved
      const photoBookings = await query<{ id: string }>(
        "SELECT id FROM bookings WHERE photographer_id = $1",
        [profile.id]
      );
      const photoBookingIds = photoBookings.map((b) => b.id);

      if (photoBookingIds.length > 0) {
        await query(`DELETE FROM delivery_photos WHERE booking_id = ANY($1)`, [photoBookingIds]);
        await query(`DELETE FROM messages WHERE booking_id = ANY($1)`, [photoBookingIds]);
        // Delete reviews + review_photos for photographer bookings
        const photoReviews = await query<{ id: string }>(
          `SELECT id FROM reviews WHERE booking_id = ANY($1)`,
          [photoBookingIds]
        );
        const photoReviewIds = photoReviews.map((r) => r.id);
        if (photoReviewIds.length > 0) {
          await query(`DELETE FROM review_photos WHERE review_id = ANY($1)`, [photoReviewIds]);
          await query(`DELETE FROM reviews WHERE id = ANY($1)`, [photoReviewIds]);
        }
        await query(`DELETE FROM disputes WHERE booking_id = ANY($1)`, [photoBookingIds]);
        await query(`DELETE FROM bookings WHERE id = ANY($1)`, [photoBookingIds]);
      }

      // Delete photographer-specific tables (cascade handles portfolio_items, packages, photographer_locations)
      await query("DELETE FROM portfolio_items WHERE photographer_id = $1", [profile.id]);
      await query("DELETE FROM packages WHERE photographer_id = $1", [profile.id]);
      await query("DELETE FROM photographer_locations WHERE photographer_id = $1", [profile.id]);
      await query("DELETE FROM photographer_profiles WHERE id = $1", [profile.id]);
    }

    // 7. Delete the user record (notification_preferences cascades automatically)
    await query("DELETE FROM users WHERE id = $1", [userId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
