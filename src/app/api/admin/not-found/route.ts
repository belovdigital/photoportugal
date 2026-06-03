import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

// Returns the top 404s the admin needs to look at. Filters out paths
// flagged ignored, ranks by hits desc within the chosen window, and
// joins a fuzzy-matched suggestion for each row so the admin can
// one-click create a redirect.
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const showIgnored = url.searchParams.get("show_ignored") === "true";
  const minHits = parseInt(url.searchParams.get("min_hits") || "2", 10);

  try {
    const rows = await query<{
      path: string;
      hits: number;
      first_seen_at: string;
      last_seen_at: string;
      last_referrer: string | null;
      last_user_agent: string | null;
      ignored: boolean;
      suggested_target: string | null;
      suggestion: string | null;
    }>(
      `
      WITH p AS (
        SELECT path, hits, first_seen_at, last_seen_at, last_referrer,
               last_user_agent, ignored, suggested_target
          FROM not_found_paths
         WHERE hits >= $1
           AND ($2::boolean OR NOT ignored)
         ORDER BY hits DESC, last_seen_at DESC
         LIMIT 200
      ),
      seg AS (
        SELECT path,
               lower(regexp_replace(regexp_replace(path, '^/(pt|de|es|fr)(/|$)', '/', 'i'), '^.*/([^/]+)/?$', '\\1')) AS last_seg
          FROM p
      ),
      candidates AS (
        SELECT s.path, '/photographers/' || pp.slug AS url,
               similarity(pp.slug, s.last_seg) AS sim
          FROM seg s
          JOIN photographer_profiles pp ON COALESCE(pp.is_approved, FALSE)
         WHERE length(s.last_seg) >= 3
        UNION ALL
        SELECT s.path, '/locations/' || loc.slug,
               similarity(loc.slug, s.last_seg)
          FROM seg s
          JOIN (SELECT DISTINCT location_slug AS slug FROM photographer_locations) loc ON true
         WHERE length(s.last_seg) >= 3
        UNION ALL
        SELECT s.path, '/blog/' || bp.slug,
               similarity(bp.slug, s.last_seg)
          FROM seg s
          JOIN blog_posts bp ON COALESCE(bp.is_published, FALSE)
         WHERE length(s.last_seg) >= 3
      ),
      best AS (
        SELECT DISTINCT ON (path) path, url
          FROM candidates
         WHERE sim > 0.5
         ORDER BY path, sim DESC
      )
      SELECT p.path, p.hits,
             p.first_seen_at::text,
             p.last_seen_at::text,
             p.last_referrer,
             p.last_user_agent,
             p.ignored,
             p.suggested_target,
             COALESCE(p.suggested_target, b.url) AS suggestion
        FROM p
        LEFT JOIN best b ON b.path = p.path
       ORDER BY p.hits DESC, p.last_seen_at DESC`,
      [minHits, showIgnored]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[admin/not-found] error:", error);
    return NextResponse.json({ error: "Failed to load 404s" }, { status: 500 });
  }
}

// Admin actions on a 404 row.
// - action=ignore: mark as ignored (keeps stats, hides from top list)
// - action=unignore: restore visibility
// - action=delete: remove the row entirely (use sparingly)
// - action=pin_suggestion: store admin-chosen target for the suggestion column
// - action=create_redirect: also writes a row to the `redirects` table
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const path = String(body?.path || "");
    const action = String(body?.action || "");
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    if (action === "ignore") {
      await query("UPDATE not_found_paths SET ignored = TRUE WHERE path = $1", [path]);
      return NextResponse.json({ ok: true });
    }
    if (action === "unignore") {
      await query("UPDATE not_found_paths SET ignored = FALSE WHERE path = $1", [path]);
      return NextResponse.json({ ok: true });
    }
    if (action === "delete") {
      await query("DELETE FROM not_found_paths WHERE path = $1", [path]);
      return NextResponse.json({ ok: true });
    }
    if (action === "pin_suggestion") {
      const target = String(body?.target || "");
      if (!target) return NextResponse.json({ error: "Missing target" }, { status: 400 });
      await query("UPDATE not_found_paths SET suggested_target = $2 WHERE path = $1", [path, target]);
      return NextResponse.json({ ok: true });
    }
    if (action === "create_redirect") {
      const target = String(body?.target || "");
      const statusCode = parseInt(body?.status_code || "301", 10);
      if (!target) return NextResponse.json({ error: "Missing target" }, { status: 400 });
      // Insert into the redirects table — the admin's redirect manager
      // already handles serving the 301 at request time.
      await query(
        `INSERT INTO redirects (source_host, source_path, target_url, status_code, notes)
         VALUES ('photoportugal.com', $1, $2, $3, 'Auto-created from 404 admin')
         ON CONFLICT (source_host, source_path) DO UPDATE SET target_url = EXCLUDED.target_url, status_code = EXCLUDED.status_code`,
        [path, target, statusCode]
      );
      // Mark the 404 row as resolved (delete it — the redirect handles it now).
      await query("DELETE FROM not_found_paths WHERE path = $1", [path]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[admin/not-found POST] error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
