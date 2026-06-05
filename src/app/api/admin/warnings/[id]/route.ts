import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function getAdmin(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.email ? { email: decoded.email } : null;
}

// PATCH /api/admin/warnings/[id]
// Body (one of):
//   { action: "edit", title?: string, comment?: string }
//   { action: "resolve", status: "resolved" | "overturned", resolution_note: string }
//   { action: "reopen" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }
  const action = String(body.action || "").trim();

  if (action === "edit") {
    const title = body.title !== undefined ? String(body.title).trim().slice(0, 200) : null;
    const comment = body.comment !== undefined ? String(body.comment).trim().slice(0, 4000) : null;
    if (title !== null && title.length < 3) {
      return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
    }
    if (comment !== null && comment.length < 5) {
      return NextResponse.json({ error: "Comment must be at least 5 characters" }, { status: 400 });
    }
    if (title === null && comment === null) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const updated = await queryOne<{ id: string }>(
      `UPDATE photographer_warnings
          SET title   = COALESCE($1, title),
              comment = COALESCE($2, comment)
        WHERE id = $3
        RETURNING id`,
      [title, comment, id]
    );
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  }

  if (action === "resolve") {
    const status = String(body.status || "").trim();
    if (status !== "resolved" && status !== "overturned") {
      return NextResponse.json({ error: "status must be 'resolved' or 'overturned'" }, { status: 400 });
    }
    const note = String(body.resolution_note || "").trim().slice(0, 2000);
    if (note.length < 3) {
      return NextResponse.json({ error: "Resolution note required" }, { status: 400 });
    }
    const updated = await queryOne<{ id: string }>(
      `UPDATE photographer_warnings
          SET status            = $1,
              resolution_note   = $2,
              resolved_at       = NOW(),
              resolved_by_email = $3
        WHERE id = $4
          AND status = 'active'
        RETURNING id`,
      [status, note, admin.email, id]
    );
    if (!updated) {
      return NextResponse.json({ error: "Warning is not active (already resolved or not found)" }, { status: 409 });
    }
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen") {
    const updated = await queryOne<{ id: string }>(
      `UPDATE photographer_warnings
          SET status            = 'active',
              resolution_note   = NULL,
              resolved_at       = NULL,
              resolved_by_email = NULL
        WHERE id = $1
          AND status IN ('resolved', 'overturned')
        RETURNING id`,
      [id]
    );
    if (!updated) {
      return NextResponse.json({ error: "Warning is already active (or not found)" }, { status: 409 });
    }
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE /api/admin/warnings/[id] — hard delete. Available to any
// authenticated admin; rare path, used to retract a warning issued
// in obvious error before the photographer sees it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await queryOne<{ id: string }>(
    "DELETE FROM photographer_warnings WHERE id = $1 RETURNING id",
    [id]
  );
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath("/admin");
  return NextResponse.json({ ok: true });
}
