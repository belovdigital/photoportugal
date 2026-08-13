import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  if (!decoded?.email) return false;
  const row = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 AND role = 'admin'",
    [decoded.email]
  );
  return !!row;
}

const VALID_STATUSES = ["new", "queued", "contacted", "replied", "partner", "declined", "failed"];
const VALID_SEGMENTS = ["villa_aggregator", "property_manager", "concierge", "hotel", "other"];

// Columns a human may edit from the board. last_contacted_at and contact_count
// are deliberately absent: only the send script writes those, so the board can
// never claim a company was mailed when no mail left the server.
const EDITABLE = [
  "company_name",
  "website",
  "email",
  "contact_name",
  "segment",
  "region",
  "status",
  "notes",
  "their_link_url",
  "our_link_url",
  "language",
] as const;

// Paged deliberately: the list is thousands of rows once the harvester has
// run, and shipping all of them to the browser turned the tab into a
// four-second freeze on every status change.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const q = (sp.get("q") || "").trim();
  const limit = Math.min(parseInt(sp.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(sp.get("offset") || "0", 10) || 0, 0);

  const where: string[] = [];
  const params: unknown[] = [];
  if (status && VALID_STATUSES.includes(status)) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(company_name ILIKE $${params.length} OR email ILIKE $${params.length} OR region ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const partners = await query(
    `SELECT * FROM partner_outreach
     ${whereSql}
     ORDER BY (status = 'partner') DESC, (status = 'replied') DESC, created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM partner_outreach ${whereSql}`,
    params
  );
  // Counts are over the whole table, not the filtered page — they drive the
  // status chips, which have to keep saying how much work is left.
  const counts = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM partner_outreach GROUP BY status`
  );
  const mailable = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM partner_outreach WHERE status = 'new' AND email IS NOT NULL`
  );

  return NextResponse.json({
    partners,
    total: Number(totalRow?.count || 0),
    counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.count)])),
    mailable_new: Number(mailable?.count || 0),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  // Bulk queueing: hand the cron its next N. Oldest first, only rows that can
  // actually be mailed, so a row with no address never eats a daily slot.
  if (body.action === "queue") {
    const n = Math.min(Math.max(parseInt(body.count, 10) || 0, 1), 1000);
    const queued = await query<{ id: string }>(
      `UPDATE partner_outreach SET status = 'queued', updated_at = NOW()
        WHERE id IN (
          SELECT id FROM partner_outreach
           WHERE status = 'new' AND email IS NOT NULL
           ORDER BY created_at
           LIMIT $1
        )
        RETURNING id`,
      [n]
    );
    return NextResponse.json({ queued: queued.length });
  }

  const companyName = (body.company_name || "").trim();
  if (!companyName) {
    return NextResponse.json({ error: "company_name required" }, { status: 400 });
  }
  if (body.segment && !VALID_SEGMENTS.includes(body.segment)) {
    return NextResponse.json({ error: "invalid segment" }, { status: 400 });
  }
  const email = (body.email || "").trim() || null;
  try {
    const partner = await queryOne(
      `INSERT INTO partner_outreach (company_name, website, email, contact_name, segment, region, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        companyName,
        (body.website || "").trim() || null,
        email,
        (body.contact_name || "").trim() || null,
        body.segment || "other",
        (body.region || "").trim() || null,
        (body.notes || "").trim() || null,
      ]
    );
    return NextResponse.json({ partner });
  } catch (e) {
    // The unique index on lower(email) is the only thing standing between us
    // and mailing the same company twice — say so instead of a bare 500.
    const msg = e instanceof Error ? e.message : "insert failed";
    if (msg.includes("idx_partner_outreach_email")) {
      return NextResponse.json({ error: `${email} is already on the list` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.segment !== undefined && !VALID_SEGMENTS.includes(body.segment)) {
    return NextResponse.json({ error: "invalid segment" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const col of EDITABLE) {
    if (body[col] === undefined) continue;
    const raw = typeof body[col] === "string" ? body[col].trim() : body[col];
    values.push(raw === "" ? null : raw);
    sets.push(`${col} = $${values.length}`);
  }
  if (!sets.length) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const updated = await queryOne(
      `UPDATE partner_outreach SET ${sets.join(", ")}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ partner: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update failed";
    if (msg.includes("idx_partner_outreach_email")) {
      return NextResponse.json({ error: "another row already has that email" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const deleted = await queryOne<{ id: string }>(
    "DELETE FROM partner_outreach WHERE id = $1 RETURNING id",
    [id]
  );
  if (!deleted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
