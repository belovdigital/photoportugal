import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendEmail, emailLayout, emailButton, getAdminEmail } from "@/lib/email";

// GET — fetch current revision for authenticated photographer
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [user.id]
  );
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const revision = await queryOne<{
    id: string; status: string; items: string; round: number;
    admin_note: string | null; created_at: string;
  }>(
    `SELECT id, status, items::text, round, admin_note, created_at::text
     FROM profile_revisions
     WHERE photographer_id = $1 AND status IN ('pending', 'submitted')
     ORDER BY created_at DESC LIMIT 1`,
    [profile.id]
  );

  if (!revision) return NextResponse.json(null);
  return NextResponse.json({ ...revision, items: JSON.parse(revision.items) });
}

// PATCH — resolve an item
export async function PATCH(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { revision_id, item_id, resolved, photographer_media_url } = await req.json();
    if (!revision_id || !item_id) {
      return NextResponse.json({ error: "revision_id and item_id required" }, { status: 400 });
    }

    // Verify ownership
    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    const revision = await queryOne<{ id: string; items: string; photographer_id: string }>(
      "SELECT id, items::text, photographer_id FROM profile_revisions WHERE id = $1 AND photographer_id = $2 AND status = 'pending'",
      [revision_id, profile.id]
    );
    if (!revision) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    // Update the specific item
    const items = JSON.parse(revision.items) as Array<{
      id: string; text: string; resolved: boolean;
      photographer_media_url: string | null; resolved_at: string | null;
    }>;

    const item = items.find(i => i.id === item_id);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    item.resolved = resolved !== false;
    if (photographer_media_url) item.photographer_media_url = photographer_media_url;
    if (item.resolved) item.resolved_at = new Date().toISOString();

    const allResolved = items.every(i => i.resolved);
    const newStatus = allResolved ? "submitted" : "pending";

    await queryOne(
      "UPDATE profile_revisions SET items = $1::jsonb, status = $2, updated_at = NOW() WHERE id = $3",
      [JSON.stringify(items), newStatus, revision_id]
    );

    if (allResolved) {
      await queryOne(
        "UPDATE photographer_profiles SET revision_status = 'submitted' WHERE id = $1",
        [profile.id]
      );

      // Notify admin
      const photographerInfo = await queryOne<{ name: string; email: string }>(
        "SELECT u.name, u.email FROM users u WHERE u.id = $1",
        [user.id]
      );

      if (photographerInfo) {
        const adminEmail = await getAdminEmail();
        sendEmail(
          adminEmail,
          `Revisions resolved: ${photographerInfo.name}`,
          emailLayout(`
            <h2 style="margin:0 0 16px;font-size:20px;color:#1F1F1F;">Revisions Resolved</h2>
            <p style="color:#6B7280;margin:0 0 16px;"><strong>${photographerInfo.name}</strong> (${photographerInfo.email}) has resolved all revision items and is ready for re-review.</p>
            ${emailButton("https://photoportugal.com/admin", "Review in Admin")}
          `)
        ).catch(e => console.error("[dashboard/revisions] admin email error:", e));

        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`📸 <b>Revisions Resolved!</b>\n\n<b>Name:</b> ${photographerInfo.name}\n<b>Email:</b> ${photographerInfo.email}\n\nAll items fixed. Ready for re-review.\n\n<a href="https://photoportugal.com/admin">Review in Admin →</a>`, "photographers");
        }).catch(e => console.error("[dashboard/revisions] telegram error:", e));
      }
    } else {
      await queryOne(
        "UPDATE photographer_profiles SET revision_status = 'pending' WHERE id = $1",
        [profile.id]
      );
    }

    return NextResponse.json({ success: true, allResolved, items });
  } catch (error) {
    console.error("[dashboard/revisions] PATCH error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/revisions", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
