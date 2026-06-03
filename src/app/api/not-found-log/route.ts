import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { locations as curatedLocations } from "@/lib/locations-data";

// Aggregate 404 hits + return a "Did you mean?" suggestion in one
// round trip. Called fire-and-forget from the 404 page client.
//
// Bot resilience: cap path length, drop obvious scanner paths (.env,
// .git, /wp-, etc.), and skip recording anything with NUL bytes.
// Legitimate 404s still get aggregated; the table stays small.

const MAX_PATH = 256;
const MAX_REFERRER = 512;
const MAX_UA = 512;

// Substring matches; if any appears in the path, drop silently.
const SCANNER_PATTERNS = [
  ".env",
  ".git",
  "wp-admin",
  "wp-login",
  "wp-content",
  "phpmyadmin",
  "phpunit",
  "xmlrpc",
  ".php",
  ".aspx",
  ".asp",
  ".cgi",
  "/.well-known/security",
  "/cgi-bin/",
];

function shouldSkip(path: string): boolean {
  if (!path || path.length === 0) return true;
  if (path.length > MAX_PATH) return true;
  if (path.includes("\0")) return true;
  const lower = path.toLowerCase();
  return SCANNER_PATTERNS.some((p) => lower.includes(p));
}

// Strip locale prefix + trailing slash so we can compare a suggested
// URL against the user's actual path without false negatives from
// locale or slash differences.
function canonicalisePath(p: string): string {
  return p.replace(/^\/(pt|de|es|fr)(\/|$)/, "/").replace(/\/+$/, "") || "/";
}

// Suggest the closest existing URL by matching the last URL segment
// against photographer/location/blog slugs via pg_trgm similarity.
// Threshold 0.5 = roughly "half the characters overlap." Returns null
// when nothing is similar enough, or when the best match happens to be
// the same URL the user just hit (e.g. /locations/<slug> for a slug
// that exists as a photographer coverage area but has no public page).
async function suggestRedirect(path: string): Promise<string | null> {
  // If we already have a pinned suggestion in the table, prefer it.
  const pinned = await query<{ suggested_target: string | null }>(
    "SELECT suggested_target FROM not_found_paths WHERE path = $1",
    [path]
  ).catch(() => []);
  if (pinned[0]?.suggested_target) return pinned[0].suggested_target;

  const inputCanon = canonicalisePath(path);
  const segments = inputCanon.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const lastSeg = segments[segments.length - 1].toLowerCase();
  if (lastSeg.length < 3) return null;

  // Curated public location slugs ONLY. photographer_locations contains
  // coverage-area slugs that don't render a public /locations/<slug>
  // page — suggesting one of those would just bounce the visitor to
  // another 404 (this exact bug was reported for /locations/geres).
  const publicLocationSlugs = curatedLocations.map((l) => l.slug);

  try {
    const rows = await query<{ url: string; similarity: number }>(
      `
      SELECT * FROM (
        SELECT '/photographers/' || slug AS url,
               similarity(slug, $1) AS similarity
          FROM photographer_profiles
         WHERE COALESCE(is_approved, FALSE) = TRUE
        UNION ALL
        SELECT '/locations/' || s AS url,
               similarity(s, $1) AS similarity
          FROM unnest($2::text[]) AS s
        UNION ALL
        SELECT '/blog/' || slug AS url,
               similarity(slug, $1) AS similarity
          FROM blog_posts
         WHERE COALESCE(is_published, FALSE) = TRUE
      ) candidates
      WHERE similarity > 0.5
        AND url <> $3
      ORDER BY similarity DESC
      LIMIT 1`,
      [lastSeg, publicLocationSlugs, inputCanon]
    ).catch(() => []);
    return rows[0]?.url ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let path = typeof body?.path === "string" ? body.path : "";
    if (!path.startsWith("/")) path = "/" + path;
    // Drop query string and hash so the same broken route doesn't get
    // counted N times for each campaign param variant.
    path = path.split("?")[0].split("#")[0];

    if (shouldSkip(path)) return NextResponse.json({ ok: true, skipped: true });

    const referrer = (req.headers.get("referer") || "").slice(0, MAX_REFERRER) || null;
    const ua = (req.headers.get("user-agent") || "").slice(0, MAX_UA) || null;

    await query(
      `INSERT INTO not_found_paths (path, hits, last_referrer, last_user_agent)
       VALUES ($1, 1, $2, $3)
       ON CONFLICT (path) DO UPDATE
         SET hits = not_found_paths.hits + 1,
             last_seen_at = NOW(),
             last_referrer = COALESCE(EXCLUDED.last_referrer, not_found_paths.last_referrer),
             last_user_agent = COALESCE(EXCLUDED.last_user_agent, not_found_paths.last_user_agent)`,
      [path, referrer, ua]
    );

    const suggestion = await suggestRedirect(path);
    return NextResponse.json({ ok: true, suggestion });
  } catch (error) {
    console.error("[not-found-log] error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
