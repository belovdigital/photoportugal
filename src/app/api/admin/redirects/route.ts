import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { invalidateRedirectCache } from "@/lib/redirects-cache";

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

// Normalize a hostname: lowercase, strip scheme and trailing slash.
function normalizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .split("/")[0]
    .split(":")[0];
}

// Normalize a source path: ensure leading slash, strip trailing slash unless "/".
function normalizeSourcePath(input: string): string {
  let p = input.trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  return p;
}

function validateBody(body: unknown): { ok: true; v: { source_host: string; source_path: string; target_url: string; status_code: number; notes: string | null } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const sh = typeof b.source_host === "string" ? normalizeHost(b.source_host) : "";
  const sp = typeof b.source_path === "string" ? normalizeSourcePath(b.source_path) : "";
  const tu = typeof b.target_url === "string" ? b.target_url.trim() : "";
  const sc = typeof b.status_code === "number" ? b.status_code : Number(b.status_code) || 301;
  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  if (!sh || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(sh)) return { ok: false, error: "Invalid source host" };
  if (!sp.startsWith("/")) return { ok: false, error: "Source path must start with /" };
  if (sp.length > 500) return { ok: false, error: "Source path too long" };
  if (!tu) return { ok: false, error: "Target URL required" };
  if (tu.length > 1000) return { ok: false, error: "Target URL too long" };
  if (!/^(https?:\/\/|\/)/.test(tu)) return { ok: false, error: "Target URL must be an absolute URL or absolute path" };
  if (![301, 302, 307, 308].includes(sc)) return { ok: false, error: "Status code must be 301, 302, 307, or 308" };
  return { ok: true, v: { source_host: sh, source_path: sp, target_url: tu, status_code: sc, notes } };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query(
    "SELECT id, source_host, source_path, target_url, status_code, notes, created_at, updated_at FROM redirects ORDER BY source_host, source_path"
  );
  return NextResponse.json({ redirects: rows });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const v = validateBody(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const row = await queryOne(
      `INSERT INTO redirects (source_host, source_path, target_url, status_code, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, source_host, source_path, target_url, status_code, notes, created_at, updated_at`,
      [v.v.source_host, v.v.source_path, v.v.target_url, v.v.status_code, v.v.notes]
    );
    invalidateRedirectCache();
    return NextResponse.json({ redirect: row });
  } catch (err: unknown) {
    const e = err as { code?: string; constraint?: string };
    if (e?.code === "23505") {
      return NextResponse.json({ error: "A redirect with this source host + path already exists" }, { status: 409 });
    }
    throw err;
  }
}
