import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? !!verifyToken(token) : false;
}

// PATCH /api/admin/concierge/[id] — body: { archived: boolean }
// Used by the admin Concierge tab × button to archive (or restore) a chat.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { archived } = await req.json().catch(() => ({}));
  if (typeof archived !== "boolean") {
    return NextResponse.json({ error: "archived must be boolean" }, { status: 400 });
  }
  await query(
    `UPDATE concierge_chats SET archived = $1, updated_at = NOW() WHERE id = $2`,
    [archived, id]
  );
  return NextResponse.json({ ok: true });
}
