import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "no-show",
  "late-delivery",
  "unresponsive",
  "quality",
  "billing",
  "conduct",
  "policy",
  "safety",
  "misrepresentation",
  "availability-conflict",
  "other",
] as const;
type Category = typeof CATEGORIES[number];

const SEVERITIES = ["info", "minor", "major", "critical"] as const;
type Severity = typeof SEVERITIES[number];

interface AdminIdentity {
  email: string;
  name: string | null;
}

async function getAdmin(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.email) return null;
  // verifyToken returns just { email, timestamp }; look up the
  // display name from the users row so the snapshot is friendly.
  const row = await queryOne<{ name: string | null }>(
    "SELECT name FROM users WHERE email = $1 AND role = 'admin'",
    [decoded.email]
  );
  return { email: decoded.email, name: row?.name || null };
}

// GET /api/admin/warnings?status=active&severity=critical&category=no-show&photographer_id=...&q=...&limit=200
// Returns: { warnings: [...], counts: { open, critical_open, last_7d, resolved_this_month } }
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const severity = sp.get("severity") || "";
  const category = sp.get("category") || "";
  const photographerId = sp.get("photographer_id") || "";
  const q = (sp.get("q") || "").trim();
  const limit = Math.max(1, Math.min(500, parseInt(sp.get("limit") || "200", 10)));

  const where: string[] = [];
  const params: unknown[] = [];
  if (status && ["active", "resolved", "overturned"].includes(status)) {
    params.push(status);
    where.push(`w.status = $${params.length}`);
  }
  if (severity && (SEVERITIES as readonly string[]).includes(severity)) {
    params.push(severity);
    where.push(`w.severity = $${params.length}`);
  }
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    params.push(category);
    where.push(`w.category = $${params.length}`);
  }
  if (photographerId) {
    params.push(photographerId);
    where.push(`w.photographer_id = $${params.length}::uuid`);
  }
  if (q) {
    params.push(`%${q.replace(/[%_]/g, "\\$&")}%`);
    where.push(
      `(w.title ILIKE $${params.length} OR w.comment ILIKE $${params.length} OR pu.name ILIKE $${params.length} OR pp.slug ILIKE $${params.length})`
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit);

  const warnings = await query<{
    id: string;
    photographer_id: string;
    photographer_name: string;
    photographer_slug: string;
    category: Category;
    severity: Severity;
    title: string;
    comment: string;
    incident_date: string;
    issued_at: string;
    issued_by_email: string;
    issued_by_name: string | null;
    related_booking_id: string | null;
    reporter_email: string | null;
    status: string;
    resolution_note: string | null;
    resolved_at: string | null;
    resolved_by_email: string | null;
  }>(
    `SELECT w.id,
            w.photographer_id,
            pu.name AS photographer_name,
            pp.slug AS photographer_slug,
            w.category, w.severity, w.title, w.comment,
            w.incident_date::text, w.issued_at::text,
            w.issued_by_email, w.issued_by_name,
            w.related_booking_id, w.reporter_email,
            w.status, w.resolution_note,
            w.resolved_at::text, w.resolved_by_email
       FROM photographer_warnings w
       JOIN photographer_profiles pp ON pp.id = w.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       ${whereSql}
      ORDER BY w.issued_at DESC
      LIMIT $${params.length}`,
    params
  );

  const counts = await queryOne<{
    open: string;
    critical_open: string;
    last_7d: string;
    resolved_this_month: string;
  }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'active')::text AS open,
            COUNT(*) FILTER (WHERE status = 'active' AND severity = 'critical')::text AS critical_open,
            COUNT(*) FILTER (WHERE issued_at >= NOW() - INTERVAL '7 days')::text AS last_7d,
            COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= date_trunc('month', NOW()))::text AS resolved_this_month
       FROM photographer_warnings`
  );

  return NextResponse.json({
    warnings,
    counts: {
      open: parseInt(counts?.open || "0", 10),
      critical_open: parseInt(counts?.critical_open || "0", 10),
      last_7d: parseInt(counts?.last_7d || "0", 10),
      resolved_this_month: parseInt(counts?.resolved_this_month || "0", 10),
    },
  });
}

// POST /api/admin/warnings — issue a new warning.
export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const photographerId = String(body.photographer_id || "").trim();
  const category = String(body.category || "").trim();
  const severity = String(body.severity || "minor").trim();
  const title = String(body.title || "").trim().slice(0, 200);
  const comment = String(body.comment || "").trim().slice(0, 4000);
  const incidentDate = String(body.incident_date || "").trim();
  const relatedBookingId = body.related_booking_id ? String(body.related_booking_id).trim() : null;
  const reporterEmail = body.reporter_email ? String(body.reporter_email).trim().toLowerCase() : null;

  if (!photographerId) {
    return NextResponse.json({ error: "photographer_id required" }, { status: 400 });
  }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!(SEVERITIES as readonly string[]).includes(severity)) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  }
  if (title.length < 3) {
    return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
  }
  if (comment.length < 5) {
    return NextResponse.json({ error: "Comment must be at least 5 characters" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incidentDate)) {
    return NextResponse.json({ error: "incident_date must be YYYY-MM-DD" }, { status: 400 });
  }
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (new Date(incidentDate + "T00:00:00Z") > today) {
    return NextResponse.json({ error: "incident_date cannot be in the future" }, { status: 400 });
  }

  // Verify photographer exists.
  const photographer = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE id = $1",
    [photographerId]
  );
  if (!photographer) {
    return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
  }

  // If a booking is linked, verify it belongs to this photographer.
  if (relatedBookingId) {
    const bookingRow = await queryOne<{ photographer_id: string | null }>(
      "SELECT photographer_id FROM bookings WHERE id = $1",
      [relatedBookingId]
    );
    if (!bookingRow) {
      return NextResponse.json({ error: "Linked booking not found" }, { status: 404 });
    }
    if (bookingRow.photographer_id && bookingRow.photographer_id !== photographerId) {
      return NextResponse.json(
        { error: "Linked booking belongs to a different photographer" },
        { status: 400 }
      );
    }
  }

  try {
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO photographer_warnings (
         photographer_id, category, severity, title, comment,
         incident_date, issued_by_email, issued_by_name,
         related_booking_id, reporter_email
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        photographerId,
        category,
        severity,
        title,
        comment,
        incidentDate,
        admin.email,
        admin.name,
        relatedBookingId,
        reporterEmail,
      ]
    );
    revalidatePath("/admin");
    return NextResponse.json({ id: inserted?.id });
  } catch (err) {
    console.error("[admin/warnings] insert error:", err);
    return NextResponse.json({ error: "Failed to create warning" }, { status: 500 });
  }
}
