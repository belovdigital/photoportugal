import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";
import { getPricingForDuration, DURATION_OPTIONS } from "@/lib/package-pricing";

async function getProfile(userId: string) {
  return queryOne<{ id: string; plan: string; is_approved: boolean }>(
    "SELECT id, plan, is_approved FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );
}

export async function GET(req: NextRequest) {
  // /api/dashboard/packages?pricing=1 — return pricing config (no auth needed for form hints)
  const { searchParams } = new URL(req.url);
  if (searchParams.get("pricing") === "1") {
    return NextResponse.json(DURATION_OPTIONS);
  }

  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const profile = await getProfile(userId!);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const packages = await query(
      "SELECT * FROM packages WHERE photographer_id = $1 ORDER BY sort_order, price",
      [profile.id]
    );
    return NextResponse.json(packages);
  } catch (error) {
    console.error("Package list error:", error);
    return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const profile = await getProfile(userId!);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const { name, description, duration_minutes, num_photos, price, is_popular, delivery_days, is_public, features } = await req.json();

    if (!name || !duration_minutes || !num_photos || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDuration = DURATION_OPTIONS.some((o) => o.minutes === duration_minutes);
    if (!validDuration) {
      return NextResponse.json({ error: "Invalid duration. Please select from the available options." }, { status: 400 });
    }

    const pricing = getPricingForDuration(duration_minutes);
    if (pricing && Math.round(price) < pricing.minPrice) {
      return NextResponse.json({ error: `Minimum price for this duration is €${pricing.minPrice}` }, { status: 400 });
    }

    const cleanFeatures = Array.isArray(features) ? features.filter((f: string) => f.trim()) : [];

    // Only one package can be "most popular" — clear others first
    if (is_popular) {
      await queryOne(
        "UPDATE packages SET is_popular = FALSE WHERE photographer_id = $1 AND is_popular = TRUE",
        [profile.id]
      );
    }

    const pkg = await queryOne<{ id: string }>(
      `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, is_popular, delivery_days, is_public, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [profile.id, name, description || null, duration_minutes, num_photos, Math.round(price), is_popular || false, delivery_days || 7, is_public !== false, cleanFeatures]
    );

    checkAndNotifyChecklistComplete(profile.id).catch(() => {});
    // Only translate for approved profiles — admin approval triggers backfill for unapproved.
    if (pkg && name && profile.is_approved) {
      import("@/lib/translate-content").then(({ translatePackage }) =>
        translatePackage(pkg.id, name, description || null),
      ).catch((e) => console.error("[packages] translate error:", e));
    }
    return NextResponse.json({ success: true, id: pkg!.id });
  } catch (error) {
    console.error("Package create error:", error);
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const profile = await getProfile(userId!);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const { id, name, description, duration_minutes, num_photos, price, is_popular, delivery_days, is_public, features } = await req.json();

    const validDuration = DURATION_OPTIONS.some((o) => o.minutes === duration_minutes);
    if (!validDuration) {
      return NextResponse.json({ error: "Invalid duration. Please select from the available options." }, { status: 400 });
    }

    const pricing = getPricingForDuration(duration_minutes);
    if (pricing && Math.round(price) < pricing.minPrice) {
      return NextResponse.json({ error: `Minimum price for this duration is €${pricing.minPrice}` }, { status: 400 });
    }

    const cleanFeatures = Array.isArray(features) ? features.filter((f: string) => f.trim()) : [];

    // Only one package can be "most popular" — clear others first
    if (is_popular) {
      await queryOne(
        "UPDATE packages SET is_popular = FALSE WHERE photographer_id = $1 AND is_popular = TRUE AND id != $2",
        [profile.id, id]
      );
    }

    // Read previous name/description so we only retranslate when text actually changed
    const prev = await queryOne<{ name: string; description: string | null }>(
      "SELECT name, description FROM packages WHERE id = $1 AND photographer_id = $2",
      [id, profile.id]
    );

    const pkg = await queryOne<{ id: string }>(
      `UPDATE packages SET name = $1, description = $2, duration_minutes = $3, num_photos = $4, price = $5, is_popular = $6, delivery_days = $7, is_public = $8, features = $9,
              translations_dirty = CASE WHEN name IS DISTINCT FROM $1 OR description IS DISTINCT FROM $2 THEN TRUE ELSE translations_dirty END
       WHERE id = $10 AND photographer_id = $11
       RETURNING id`,
      [name, description || null, duration_minutes, num_photos, Math.round(price), is_popular || false, delivery_days || 7, is_public !== false, cleanFeatures, id, profile.id]
    );

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    checkAndNotifyChecklistComplete(profile.id).catch(() => {});
    const nameChanged = (prev?.name || "") !== (name || "");
    const descChanged = (prev?.description || null) !== (description || null);
    if ((nameChanged || descChanged) && profile.is_approved) {
      import("@/lib/translate-content").then(({ translatePackage }) =>
        translatePackage(pkg.id, name, description || null),
      ).catch((e) => console.error("[packages] translate error:", e));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Package update error:", error);
    return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;
  const profile = await getProfile(userId!);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { items } = await req.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  for (const item of items) {
    await queryOne(
      'UPDATE packages SET sort_order = $1 WHERE id = $2 AND photographer_id = $3',
      [item.order, item.id, profile.id]
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
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
    // Unlink completed/cancelled bookings so the package can be deleted
    await queryOne(
      "UPDATE bookings SET package_id = NULL WHERE package_id = $1 AND status IN ('completed', 'delivered', 'cancelled', 'refunded')",
      [packageId]
    );

    // Check for truly active bookings
    const activeBooking = await queryOne(
      "SELECT id FROM bookings WHERE package_id = $1 AND status IN ('pending', 'confirmed') LIMIT 1",
      [packageId]
    );
    if (activeBooking) {
      return NextResponse.json({ error: "Cannot delete this package — it has active bookings. You can edit it instead." }, { status: 409 });
    }

    const pkg = await queryOne(
      "DELETE FROM packages WHERE id = $1 AND photographer_id = $2 RETURNING id",
      [packageId, profile.id]
    );

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
  }
}
