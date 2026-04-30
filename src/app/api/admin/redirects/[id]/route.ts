import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
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

function normalizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .split("/")[0]
    .split(":")[0];
}

function normalizeSourcePath(input: string): string {
  let p = input.trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  return p;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const b = body as Record<string, unknown>;

  const sh = typeof b.source_host === "string" ? normalizeHost(b.source_host) : "";
  const sp = typeof b.source_path === "string" ? normalizeSourcePath(b.source_path) : "";
  const tu = typeof b.target_url === "string" ? b.target_url.trim() : "";
  const sc = typeof b.status_code === "number" ? b.status_code : Number(b.status_code) || 301;
  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  if (!sh || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(sh)) return NextResponse.json({ error: "Invalid source host" }, { status: 400 });
  if (!sp.startsWith("/")) return NextResponse.json({ error: "Source path must start with /" }, { status: 400 });
  if (!tu) return NextResponse.json({ error: "Target URL required" }, { status: 400 });
  if (!/^(https?:\/\/|\/)/.test(tu)) return NextResponse.json({ error: "Target URL must be an absolute URL or absolute path" }, { status: 400 });
  if (![301, 302, 307, 308].includes(sc)) return NextResponse.json({ error: "Invalid status code" }, { status: 400 });

  try {
    const row = await queryOne(
      `UPDATE redirects
         SET source_host = $1, source_path = $2, target_url = $3, status_code = $4, notes = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING id, source_host, source_path, target_url, status_code, notes, created_at, updated_at`,
      [sh, sp, tu, sc, notes, id]
    );
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    invalidateRedirectCache();
    return NextResponse.json({ redirect: row });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "23505") {
      return NextResponse.json({ error: "Another redirect with this source host + path already exists" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const row = await queryOne(
    "DELETE FROM redirects WHERE id = $1 RETURNING id",
    [id]
  );
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  invalidateRedirectCache();
  return NextResponse.json({ success: true });
}
