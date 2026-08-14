import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { country } from "@/lib/country";

async function verifyAdmin(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const data = verifyToken(token);
  if (!data) return null;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin" ? data : null;
}

// GET — fetch revisions for a photographer
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const photographerId = req.nextUrl.searchParams.get("photographer_id");
  if (!photographerId) return NextResponse.json({ error: "photographer_id required" }, { status: 400 });

  const revisions = await query<{
    id: string; status: string; items: string; round: number;
    admin_note: string | null; created_at: string; updated_at: string;
  }>(
    `SELECT id, status, items::text, round, admin_note, created_at::text, updated_at::text
     FROM profile_revisions WHERE photographer_id = $1 ORDER BY round DESC`,
    [photographerId]
  );

  return NextResponse.json(revisions.map(r => ({ ...r, items: JSON.parse(r.items) })));
}

// POST — create new revision
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { photographer_id, items, admin_note } = await req.json();
    if (!photographer_id || !items?.length) {
      return NextResponse.json({ error: "photographer_id and items required" }, { status: 400 });
    }

    // Get current max round
    const maxRound = await queryOne<{ max: number }>(
      "SELECT COALESCE(MAX(round), 0) as max FROM profile_revisions WHERE photographer_id = $1",
      [photographer_id]
    );

    const round = (maxRound?.max || 0) + 1;

    // Create revision
    const revision = await queryOne<{ id: string }>(
      `INSERT INTO profile_revisions (photographer_id, items, round, admin_note)
       VALUES ($1, $2::jsonb, $3, $4) RETURNING id`,
      [photographer_id, JSON.stringify(items), round, admin_note || null]
    );

    // Update photographer status
    await queryOne(
      "UPDATE photographer_profiles SET revision_status = 'pending', is_approved = FALSE WHERE id = $1",
      [photographer_id]
    );

    // Send email to photographer
    const profile = await queryOne<{ name: string; email: string }>(
      `SELECT u.name, u.email FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
      [photographer_id]
    );

    if (profile) {
      const itemsList = items.map((item: { text: string }) =>
        `<li style="margin-bottom:8px;color:#374151;">${item.text}</li>`
      ).join("");

      sendEmail(
        profile.email,
        "Action needed: Profile revisions",
        emailLayout(`
          <h2 style="margin:0 0 16px;font-size:20px;color:#1F1F1F;">Profile Revisions Required</h2>
          <p style="color:#6B7280;margin:0 0 16px;">Hi ${profile.name}, our team reviewed your profile and found a few things that need attention:</p>
          ${admin_note ? `<p style="color:#6B7280;margin:0 0 12px;font-style:italic;">"${admin_note}"</p>` : ""}
          <ul style="padding-left:20px;margin:0 0 20px;">${itemsList}</ul>
          <p style="color:#6B7280;margin:0 0 8px;">Please log in and resolve each item. Once done, submit for re-review.</p>
          ${emailButton(`${country.baseUrl}/dashboard`, "View Revisions")}
        `)
      ).catch(e => console.error("[admin/revisions] email error:", e));

      // Telegram to photographer
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`📝 <b>Revision Request Sent</b>\n\n<b>Photographer:</b> ${profile.name}\n<b>Items:</b> ${items.length}\n<b>Round:</b> ${round}\n\n<a href="${country.baseUrl}/admin">View in Admin →</a>`, "photographers");
      }).catch(e => console.error("[admin/revisions] telegram error:", e));
    }

    revalidatePath("/dashboard");

    return NextResponse.json({ success: true, id: revision?.id, round });
  } catch (error) {
    console.error("[admin/revisions] POST error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/revisions", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to create revision" }, { status: 500 });
  }
}

// PATCH — approve or add more
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { revision_id, action } = await req.json();
    if (!revision_id || action !== "approve") {
      return NextResponse.json({ error: "revision_id and action:'approve' required" }, { status: 400 });
    }

    const revision = await queryOne<{ photographer_id: string }>(
      "UPDATE profile_revisions SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING photographer_id",
      [revision_id]
    );

    if (!revision) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    // Clear revision status and approve photographer. RETURNING the previous
    // value is what makes the notifications below fire once: approving a
    // second revision for someone already live is a normal thing for an admin
    // to do, and it used to re-send the whole welcome sequence.
    const approved = await queryOne<{ was_approved: boolean }>(
      `UPDATE photographer_profiles pp
          SET revision_status = NULL, is_approved = TRUE
         FROM (SELECT id, COALESCE(is_approved, FALSE) AS was_approved
                 FROM photographer_profiles WHERE id = $1) prev
        WHERE pp.id = prev.id
        RETURNING prev.was_approved`,
      [revision.photographer_id]
    );
    const firstApproval = approved ? !approved.was_approved : false;

    // Auto-create Express + Full gift-card tier packages so the new
    // photographer is immediately available in the gift-mode catalog.
    // Defaults match the platform-wide tier spec; price is locked
    // (photographer can't edit), opt-out lives on /dashboard/subscriptions.
    await queryOne(
      `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, delivery_days, tier, is_popular, is_public)
       VALUES ($1, $2, $3, 60, 30, 349, 7, 'express'::gift_card_tier, FALSE, FALSE)
       ON CONFLICT DO NOTHING RETURNING id`,
      [revision.photographer_id, "Express Gift Session", "A 1-hour photo session — perfect for solo portraits, branding, or a casual couple shoot. Includes 30 edited photos delivered within 7 days."]
    ).catch((e) => console.error("[admin/revisions] tier express insert error:", e));
    await queryOne(
      `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price, delivery_days, tier, is_popular, is_public)
       VALUES ($1, $2, $3, 120, 60, 520, 7, 'full'::gift_card_tier, FALSE, FALSE)
       ON CONFLICT DO NOTHING RETURNING id`,
      [revision.photographer_id, "Full Gift Session", "A 2-hour photo session across up to 2 locations, with one outfit change. Includes 60 edited photos delivered within 7 days — ideal for engagements, anniversaries, or family shoots."]
    ).catch((e) => console.error("[admin/revisions] tier full insert error:", e));

    // Approving the revision is an approval like any other, so it runs the
    // same side effects as the roster toggle — including the Stripe deadline,
    // which this screen never stamped. A photographer approved here therefore
    // skipped the whole grace week: no nudges, no hiding, and no "Stripe
    // подключён" close-out, since all three key off that column.
    if (firstApproval) {
      const { runApprovalSideEffects } = await import("@/lib/photographer-approval");
      await runApprovalSideEffects(revision.photographer_id);
    }

    revalidatePath("/dashboard");
    revalidatePath("/photographers");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/revisions] PATCH error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/revisions", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update revision" }, { status: 500 });
  }
}
