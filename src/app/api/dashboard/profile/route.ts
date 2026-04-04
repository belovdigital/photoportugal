import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";
import { revalidatePath } from "next/cache";
import { detectContactInfo } from "@/lib/content-filter";

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await queryOne<Record<string, unknown>>(
      `SELECT pp.id, pp.slug, u.name, pp.tagline, pp.bio,
              u.avatar_url, pp.cover_url, pp.languages, pp.shoot_types,
              pp.experience_years,
              pp.is_verified, pp.is_approved, pp.rating, pp.review_count,
              pp.session_count, pp.plan, u.phone,
              (pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE) as stripe_ready,
              (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id)::int as portfolio_count,
              (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id)::int as package_count,
              (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id)::int as location_count,
              COALESCE((SELECT array_agg(location_slug) FROM photographer_locations WHERE photographer_id = pp.id), ARRAY[]::text[]) as locations
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.user_id = $1`,
      [user.id]
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[dashboard/profile] GET error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const body = await req.json();
    const {
      first_name,
      last_name,
      phone: rawPhone,
      tagline,
      bio,
      languages,
      shoot_types,
      experience_years,
      locations: locationSlugs,
      custom_slug,
    } = body;

    if (!Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json({ error: "At least one language is required" }, { status: 400 });
    }

    // Validate and normalize phone number (E.164 format)
    let phone: string | null = null;
    if (rawPhone) {
      const cleaned = rawPhone.replace(/[\s\-]/g, "");
      if (!cleaned.startsWith("+")) {
        return NextResponse.json({ error: "Phone number must start with + (country code)" }, { status: 400 });
      }
      const digits = cleaned.slice(1);
      if (!/^\d{7,15}$/.test(digits)) {
        return NextResponse.json({ error: "Phone number must be 7-15 digits after the country code" }, { status: 400 });
      }
      phone = cleaned;
    }

    // Block contact info in bio and tagline
    const contactBlockMessage =
      "Bio/tagline cannot contain links, email addresses, phone numbers, or social media handles. Please use your profile fields for contact information.";
    if (bio?.trim()) {
      const detected = detectContactInfo(bio);
      if (detected) {
        return NextResponse.json({ error: contactBlockMessage }, { status: 400 });
      }
      // Additional checks: instagram/facebook mentions
      if (/\b(instagram|facebook|whatsapp|tiktok|snapchat|twitter|linkedin)\b/i.test(bio)) {
        return NextResponse.json({ error: contactBlockMessage }, { status: 400 });
      }
    }
    if (tagline?.trim()) {
      const detected = detectContactInfo(tagline);
      if (detected) {
        return NextResponse.json({ error: contactBlockMessage }, { status: 400 });
      }
      if (/\b(instagram|facebook|whatsapp|tiktok|snapchat|twitter|linkedin)\b/i.test(tagline)) {
        return NextResponse.json({ error: contactBlockMessage }, { status: 400 });
      }
    }

    // Update user's first/last name if provided
    if (first_name) {
      const fullName = last_name ? `${first_name} ${last_name}` : first_name;
      await queryOne(
        "UPDATE users SET name = $1, first_name = $2, last_name = $3, phone = $4 WHERE id = $5",
        [fullName, first_name.trim(), (last_name || "").trim(), phone || null, userId]
      );
    } else if (phone !== undefined) {
      await queryOne("UPDATE users SET phone = $1 WHERE id = $2", [phone || null, userId]);
    }

    const profile = await queryOne<{ id: string; plan: string; slug: string }>(
      `UPDATE photographer_profiles
       SET tagline = $1, bio = $2, languages = $3,
           shoot_types = $4, experience_years = $5, updated_at = NOW()
       WHERE user_id = $6
       RETURNING id, plan, slug`,
      [
        tagline || null,
        bio || null,
        languages || [],
        shoot_types || [],
        experience_years || 0,
        userId,
      ]
    );

    // Custom slug for Premium photographers
    if (profile && custom_slug && profile.plan === "premium") {
      const cleanSlug = custom_slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      if (cleanSlug && cleanSlug.length >= 3 && cleanSlug !== profile.slug) {
        // Check uniqueness
        const taken = await queryOne("SELECT id FROM photographer_profiles WHERE slug = $1 AND id != $2", [cleanSlug, profile.id]);
        if (taken) {
          return NextResponse.json({ error: "This URL is already taken. Try another." }, { status: 400 });
        }
        // Reserved slugs
        const reserved = ["admin", "dashboard", "api", "auth", "join", "pricing", "blog", "faq", "about", "contact"];
        if (reserved.includes(cleanSlug)) {
          return NextResponse.json({ error: "This URL is reserved. Try another." }, { status: 400 });
        }
        // Save old slug as redirect before changing
        await query(
          "INSERT INTO slug_redirects (old_slug, photographer_id) VALUES ($1, $2) ON CONFLICT (old_slug) DO NOTHING",
          [profile.slug, profile.id]
        );
        await query("UPDATE photographer_profiles SET slug = $1 WHERE id = $2", [cleanSlug, profile.id]);
        // Remove redirect if new slug matches an old redirect
        await query("DELETE FROM slug_redirects WHERE old_slug = $1", [cleanSlug]);
        // Revalidate old and new URLs
        revalidatePath(`/photographers/${profile.slug}`);
        revalidatePath(`/photographers/${cleanSlug}`);
      }
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Update locations (many-to-many) with plan-based limits
    if (Array.isArray(locationSlugs)) {
      const maxLocations = profile.plan === "premium" ? Infinity : profile.plan === "pro" ? 5 : 1;
      const limitedSlugs = locationSlugs.slice(0, maxLocations === Infinity ? locationSlugs.length : maxLocations);

      await query("DELETE FROM photographer_locations WHERE photographer_id = $1", [profile.id]);
      for (const slug of limitedSlugs) {
        await query(
          "INSERT INTO photographer_locations (photographer_id, location_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [profile.id, slug]
        );
      }
    }

    // Revalidate photographer's public profile page
    const slugRow = await queryOne<{ slug: string }>(
      "SELECT slug FROM photographer_profiles WHERE user_id = $1", [userId]
    );
    if (slugRow) revalidatePath(`/photographers/${slugRow.slug}`);
    revalidatePath("/photographers");

    checkAndNotifyChecklistComplete(profile.id).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
