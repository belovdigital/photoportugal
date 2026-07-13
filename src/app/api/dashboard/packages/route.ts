import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";
import { DURATION_OPTIONS } from "@/lib/package-pricing";

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
    // Tier (gift-card) packages are hidden from the dashboard package
    // manager — they're platform-owned, opt-in/out lives in
    // /dashboard/subscriptions instead. Showing them here only invites
    // accidental delete attempts.
    // Custom proposals (custom_for_user_id set) are excluded too — they
    // are born and withdrawn in the chat, and once paid they're a spent
    // one-off. Listing them here confused photographers ("Private" +
    // odd names cluttering the catalog manager).
    const packages = await query(
      "SELECT * FROM packages WHERE photographer_id = $1 AND tier IS NULL AND custom_for_user_id IS NULL ORDER BY sort_order, price",
      [profile.id]
    );
    return NextResponse.json(packages);
  } catch (error) {
    console.error("Package list error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/packages", method: req.method, statusCode: 500 }); } catch {}
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
    const { name, description, duration_minutes, num_photos, price, is_popular, delivery_days, is_public, is_group_package, features } = await req.json();

    if (!name || !duration_minutes || !num_photos || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDuration = DURATION_OPTIONS.some((o) => o.minutes === duration_minutes);
    if (!validDuration) {
      return NextResponse.json({ error: "Invalid duration. Please select from the available options." }, { status: 400 });
    }

    // Minimum-price enforcement removed 2026-07-13 (Alex's call) —
    // recommended prices remain a hint, not a gate.

    const cleanFeatures = Array.isArray(features) ? features.filter((f: string) => f.trim()) : [];

    // Only one package can be "most popular" — clear others first
    if (is_popular) {
      await queryOne(
        "UPDATE packages SET is_popular = FALSE WHERE photographer_id = $1 AND is_popular = TRUE",
        [profile.id]
      );
    }

    // Slugify + ensure uniqueness within this photographer's packages
    // (suffixes -2/-3/... if the name collides with an existing one).
    const { slugifyPackage } = await import("@/lib/package-slug");
    const baseSlug = slugifyPackage(name);
    let slug = baseSlug;
    {
      let suffix = 2;
      while (await queryOne("SELECT id FROM packages WHERE photographer_id = $1 AND slug = $2 LIMIT 1", [profile.id, slug])) {
        slug = `${baseSlug}-${suffix++}`;
      }
    }

    const pkg = await queryOne<{ id: string; slug: string }>(
      `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, is_popular, delivery_days, is_public, is_group_package, features, slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, slug`,
      [profile.id, name, description || null, duration_minutes, num_photos, Math.round(price), is_popular || false, delivery_days || 7, is_public !== false, !!is_group_package, cleanFeatures, slug]
    );

    checkAndNotifyChecklistComplete(profile.id).catch(() => {});

    // Ping IndexNow + revalidate the photographer page so the new
    // package is crawled / surfaced quickly.
    if (pkg) {
      const pphSlug = await queryOne<{ slug: string }>("SELECT slug FROM photographer_profiles WHERE id = $1", [profile.id]);
      if (pphSlug) {
        import("@/lib/indexnow").then(({ pingIndexNow }) =>
          pingIndexNow([
            `https://photoportugal.com/photographers/${pphSlug.slug}/${pkg.slug}`,
            `https://photoportugal.com/photographers/${pphSlug.slug}`,
          ])
        ).catch(() => {});
      }
    }
    // Only translate for approved profiles — admin approval triggers backfill for unapproved.
    if (pkg && name && profile.is_approved) {
      import("@/lib/translate-content").then(({ translatePackage }) =>
        translatePackage(pkg.id, name, description || null),
      ).catch((e) => console.error("[packages] translate error:", e));
    }
    return NextResponse.json({ success: true, id: pkg!.id });
  } catch (error) {
    console.error("Package create error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/packages", method: req.method, statusCode: 500 }); } catch {}
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
    const { id, name, description, duration_minutes, num_photos, price, is_popular, delivery_days, is_public, is_group_package, features } = await req.json();

    const validDuration = DURATION_OPTIONS.some((o) => o.minutes === duration_minutes);
    if (!validDuration) {
      return NextResponse.json({ error: "Invalid duration. Please select from the available options." }, { status: 400 });
    }

    // Minimum-price enforcement removed 2026-07-13 (Alex's call) —
    // recommended prices remain a hint, not a gate.

    const cleanFeatures = Array.isArray(features) ? features.filter((f: string) => f.trim()) : [];

    // Only one package can be "most popular" — clear others first
    if (is_popular) {
      await queryOne(
        "UPDATE packages SET is_popular = FALSE WHERE photographer_id = $1 AND is_popular = TRUE AND id != $2",
        [profile.id, id]
      );
    }

    // Tier packages (Express/Full gift card packages) are managed by the
    // platform — photographer cannot edit name/price/duration. They can
    // opt out via the Gift Card toggle on /dashboard/subscriptions.
    const tierGuard = await queryOne<{ tier: string | null }>(
      "SELECT tier::text as tier FROM packages WHERE id = $1 AND photographer_id = $2",
      [id, profile.id]
    );
    if (tierGuard?.tier) {
      return NextResponse.json({
        error: "This is a Photo Portugal gift card package — you can't edit it. To stop accepting gift cards, use the toggle in Subscriptions.",
        code: "tier_package_protected",
      }, { status: 403 });
    }

    // Read previous name/description so we only retranslate when text actually changed
    const prev = await queryOne<{ name: string; description: string | null }>(
      "SELECT name, description FROM packages WHERE id = $1 AND photographer_id = $2",
      [id, profile.id]
    );

    // Compute translations_dirty in JS so the SQL doesn't need to compare the
    // same potentially-null parameter against a column twice (postgres 42P08:
    // 'inconsistent types deduced for parameter $1' when both sides are null).
    const newName = name || "";
    const newDesc = description || null;
    const translationsDirty =
      (prev?.name ?? "") !== newName ||
      (prev?.description ?? null) !== newDesc;

    const pkg = await queryOne<{ id: string }>(
      `UPDATE packages SET name = $1, description = $2, duration_minutes = $3, num_photos = $4, price = $5, is_popular = $6, delivery_days = $7, is_public = $8, features = $9, is_group_package = $10,
              translations_dirty = translations_dirty OR $11
       WHERE id = $12 AND photographer_id = $13
       RETURNING id`,
      [newName, newDesc, duration_minutes, num_photos, Math.round(price), is_popular || false, delivery_days || 7, is_public !== false, cleanFeatures, !!is_group_package, translationsDirty, id, profile.id]
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

    // Ping IndexNow on package update so the package landing page is
    // re-crawled with the new content. Slug stays stable to keep old
    // URLs working.
    const pphSlugUpd = await queryOne<{ slug: string }>("SELECT slug FROM photographer_profiles WHERE id = $1", [profile.id]);
    const pkgSlug = await queryOne<{ slug: string | null }>("SELECT slug FROM packages WHERE id = $1", [id]);
    if (pphSlugUpd && pkgSlug?.slug) {
      import("@/lib/indexnow").then(({ pingIndexNow }) =>
        pingIndexNow([
          `https://photoportugal.com/photographers/${pphSlugUpd.slug}/${pkgSlug.slug}`,
          `https://photoportugal.com/photographers/${pphSlugUpd.slug}`,
        ])
      ).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Package update error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/packages", method: req.method, statusCode: 500 }); } catch {}
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
    // Block deletion of tier (gift-card) packages — they're platform-owned.
    const tierGuard = await queryOne<{ tier: string | null }>(
      "SELECT tier::text as tier FROM packages WHERE id = $1 AND photographer_id = $2",
      [packageId, profile.id]
    );
    if (tierGuard?.tier) {
      return NextResponse.json({
        error: "This is a Photo Portugal gift card package and can't be deleted. To stop accepting gift cards, use the toggle in Subscriptions.",
        code: "tier_package_protected",
      }, { status: 403 });
    }

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
