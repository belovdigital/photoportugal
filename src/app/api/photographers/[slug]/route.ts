import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { locations as allLocations } from "@/lib/locations-data";
import { auth } from "@/lib/auth";

// CRITICAL: this route is per-user (custom-proposal packages are scoped
// to viewer.user_id). Without force-dynamic Next/CDN can cache the first
// authenticated response and serve it to anonymous users — leaking a
// client's custom package to anyone who hits the URL with the right
// ?package= id. Always re-evaluate on every request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOCALES = new Set(["en", "pt", "de", "es", "fr"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const rawLocale = (url.searchParams.get("locale") || "en").toLowerCase();
  const loc = LOCALES.has(rawLocale) ? rawLocale : "en";
  // Build column expression: for non-EN locales, COALESCE(p.bio_<loc>, p.bio).
  // For EN, use p.bio directly (no fallback needed).
  const tagCol = loc === "en" ? "p.tagline" : `COALESCE(p.tagline_${loc}, p.tagline)`;
  const bioCol = loc === "en" ? "p.bio" : `COALESCE(p.bio_${loc}, p.bio)`;
  const pkgNameCol = loc === "en" ? "name" : `COALESCE(name_${loc}, name)`;
  const pkgDescCol = loc === "en" ? "description" : `COALESCE(description_${loc}, description)`;
  const revTitleCol = loc === "en" ? "r.title" : `COALESCE(r.title_${loc}, r.title)`;
  const revTextCol = loc === "en" ? "r.text" : `COALESCE(r.text_${loc}, r.text)`;

  try {
    const profile = await queryOne<{
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      bio: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      cover_position_y: number;
      languages: string[];
      shoot_types: string[];
      experience_years: number;
      is_verified: boolean;
      is_featured: boolean;
      is_founding: boolean;
      rating: number;
      review_count: number;
      session_count: number;
      min_lead_time_hours: number;
      last_seen_at: string | null;
      avg_response_minutes: number | null;
      recent_bookings_30d: number;
    }>(
      `SELECT p.id, p.slug, u.name, ${tagCol} as tagline, ${bioCol} as bio,
              u.avatar_url, p.cover_url, p.cover_position_y,
              p.languages, p.shoot_types,
              COALESCE(CASE WHEN p.career_start_year IS NOT NULL THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT - p.career_start_year + 1 END, p.experience_years) as experience_years,
              p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
              p.rating, p.review_count, p.session_count,
              COALESCE(p.min_lead_time_hours, 0) as min_lead_time_hours,
              u.last_seen_at, p.avg_response_minutes,
              -- Social-proof signal on the booking page: how many paid
              -- bookings landed in the last 30 days. Paid only so the
              -- count reflects real demand, not abandoned requests.
              (SELECT COUNT(*)::int FROM bookings b
                WHERE b.photographer_id = p.id
                  AND b.payment_status = 'paid'
                  AND b.created_at >= NOW() - INTERVAL '30 days'
              ) as recent_bookings_30d
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = $1 AND p.is_approved = TRUE`,
      [slug]
    );

    if (!profile) {
      const slugRedirect = await queryOne<{ new_slug: string }>(
        `SELECT pp.slug as new_slug FROM slug_redirects sr
         JOIN photographer_profiles pp ON pp.id = sr.photographer_id
         WHERE sr.old_slug = $1`,
        [slug]
      );
      if (slugRedirect) {
        return NextResponse.json({ redirect: `/photographers/${slugRedirect.new_slug}` }, { status: 301 });
      }
      return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
    }

    // Locations
    const locations = await query<{ location_slug: string }>(
      "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
      [profile.id]
    );

    // Packages (locale-aware name + description with fallback to original).
    // Includes any custom one-off proposal targeted at the current viewer
    // (custom_for_user_id = viewer's user_id) on top of the public catalog,
    // so the viewer-only "Custom proposal" they got in chat can be selected
    // and booked from /book/[slug] like any other package. Other clients
    // never see it.
    const session = await auth().catch(() => null);
    const viewerUserId = (session?.user as { id?: string } | undefined)?.id || null;
    const packages = await query<{
      id: string; name: string; description: string | null;
      duration_minutes: number; num_photos: number; price: number;
      is_popular: boolean; delivery_days: number;
      is_custom: boolean;
      preview_url: string | null;
    }>(
      `SELECT id, ${pkgNameCol} as name, ${pkgDescCol} as description,
              duration_minutes, num_photos, price, is_popular,
              COALESCE(delivery_days, 7) as delivery_days,
              COALESCE(features, '{}') as features,
              (custom_for_user_id IS NOT NULL) as is_custom,
              -- Per-package thumbnail for the booking-page selector.
              -- A pseudo-random portfolio photo per package (hash-shuffled
              -- so two packages from the same photographer don't share
              -- the same first picture but order is stable per package).
              (SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = packages.photographer_id
                  AND pi.type = 'photo'
                ORDER BY hashtext(packages.id::text || pi.url),
                         pi.sort_order NULLS LAST, pi.created_at
                LIMIT 1) as preview_url
       FROM packages
       WHERE photographer_id = $1
         AND (is_public = TRUE OR custom_for_user_id = $2::uuid)
       ORDER BY (custom_for_user_id IS NOT NULL) DESC, sort_order, price`,
      [profile.id, viewerUserId]
    );

    // Portfolio
    const portfolio = await query<{
      id: string; image_url: string; thumbnail_url: string | null;
      caption: string | null; sort_order: number;
    }>(
      "SELECT id, url as image_url, thumbnail_url, caption, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order, created_at",
      [profile.id]
    );

    // Reviews — return both original and translated so UI can offer "show original" toggle
    const reviews = await query<{
      id: string; rating: number; title: string | null; text: string | null;
      title_original: string | null; text_original: string | null; source_locale: string | null;
      client_name: string | null; created_at: string;
    }>(
      `SELECT r.id, r.rating,
              ${revTitleCol} as title,
              ${revTextCol} as text,
              r.title as title_original, r.text as text_original, r.source_locale,
              COALESCE(r.client_name_override, u.name) as client_name,
              r.created_at
       FROM reviews r
       LEFT JOIN users u ON u.id = r.client_id
       WHERE r.photographer_id = $1 AND COALESCE(r.is_approved, TRUE) = TRUE
       ORDER BY r.created_at DESC LIMIT 20`,
      [profile.id]
    );

    // private + no-store so Cloudflare / any intermediary doesn't reuse
    // a per-user response (custom packages are viewer-scoped).
    return NextResponse.json({
      ...profile,
      locations: locations.map(l => {
        const loc = allLocations.find(x => x.slug === l.location_slug);
        return { slug: l.location_slug, name: loc?.name || l.location_slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) };
      }),
      packages,
      portfolio,
      reviews,
    }, {
      headers: { "Cache-Control": "private, no-store, must-revalidate" },
    });
  } catch (error) {
    console.error("[api/photographers] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/photographers/:slug", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
