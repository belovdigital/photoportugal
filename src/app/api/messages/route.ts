import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

// Get messages for a booking
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const bookingId = req.nextUrl.searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  }

  try {
    // Verify user is part of this booking
    const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
      `SELECT b.client_id, u.id as photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const messages = await query(
      `SELECT m.id, m.text, m.sender_id, m.created_at, m.read_at,
              u.name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );

    // Mark messages as read
    await query(
      "UPDATE messages SET read_at = NOW() WHERE booking_id = $1 AND sender_id != $2 AND read_at IS NULL",
      [bookingId, userId]
    );

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[messages] get error:", error);
    return NextResponse.json({ error: "Failed to get messages" }, { status: 500 });
  }
}

// Send a message
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    const { booking_id, text } = await req.json();

    if (!booking_id || !text?.trim()) {
      return NextResponse.json({ error: "booking_id and text required" }, { status: 400 });
    }

    // Verify user is part of this booking
    const booking = await queryOne<{ client_id: string; photographer_user_id: string }>(
      `SELECT b.client_id, u.id as photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE b.id = $1`,
      [booking_id]
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const message = await queryOne(
      `INSERT INTO messages (booking_id, sender_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [booking_id, userId, text.trim()]
    );

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("[messages] send error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
