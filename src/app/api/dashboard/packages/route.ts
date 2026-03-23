import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

async function getProfile(userId: string) {
  return queryOne<{ id: string; plan: string }>(
    "SELECT id, plan FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const profile = await getProfile(userId!);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const { name, description, duration_minutes, num_photos, price, is_popular, delivery_days } = await req.json();

    if (!name || !duration_minutes || !num_photos || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const pkg = await queryOne(
      `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, is_popular, delivery_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [profile.id, name, description || null, duration_minutes, num_photos, Math.round(price), is_popular || false, delivery_days || 7]
    );

    return NextResponse.json({ success: true, id: (pkg as { id: string }).id });
  } catch (error) {
    console.error("Package create error:", error);
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const profile = await getProfile(userId!);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const { id, name, description, duration_minutes, num_photos, price, is_popular, delivery_days } = await req.json();

    const pkg = await queryOne(
      `UPDATE packages SET name = $1, description = $2, duration_minutes = $3, num_photos = $4, price = $5, is_popular = $6, delivery_days = $7
       WHERE id = $8 AND photographer_id = $9
       RETURNING id`,
      [name, description || null, duration_minutes, num_photos, Math.round(price), is_popular || false, delivery_days || 7, id, profile.id]
    );

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Package update error:", error);
    return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const profile = await getProfile(userId!);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { items } = await req.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  for (const item of items) {
    await queryOne(
      'UPDATE packages SET "order" = $1 WHERE id = $2 AND photographer_id = $3',
      [item.order, item.id, profile.id]
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const profile = await getProfile(userId!);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const packageId = searchParams.get("id");

  if (!packageId) {
    return NextResponse.json({ error: "Package ID required" }, { status: 400 });
  }

  try {
    const pkg = await queryOne(
      "DELETE FROM packages WHERE id = $1 AND photographer_id = $2 RETURNING id",
      [packageId, profile.id]
    );

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Cannot delete this package — it has active bookings. You can edit it instead." }, { status: 409 });
  }
}
