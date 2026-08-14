import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
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

async function logAudit(adminEmail: string, action: string, entityType: string, entityId?: string, entityName?: string, details?: string) {
  try {
    await queryOne(
      `INSERT INTO admin_audit_log (action, entity_type, entity_id, entity_name, details, admin_email) VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, entityType, entityId || null, entityName || null, details || null, adminEmail]
    );
  } catch (e) { console.error("[audit] log error:", e); }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Photographer ID required" }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if ("is_approved" in updates) {
      fields.push(`is_approved = $${paramIndex++}`);
      values.push(updates.is_approved);
    }
    if ("is_verified" in updates) {
      fields.push(`is_verified = $${paramIndex++}`);
      values.push(updates.is_verified);
    }
    if ("is_featured" in updates) {
      fields.push(`is_featured = $${paramIndex++}`);
      values.push(updates.is_featured);
    }
    if ("plan" in updates && ["free", "pro", "premium"].includes(updates.plan)) {
      fields.push(`plan = $${paramIndex++}`);
      values.push(updates.plan);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    // Check previous approval status BEFORE the update so we can detect first-time approval
    let wasAlreadyApproved = false;
    if (updates.is_approved === true) {
      const prev = await queryOne<{ is_approved: boolean }>(
        "SELECT is_approved FROM photographer_profiles WHERE id = $1",
        [id]
      );
      wasAlreadyApproved = !!prev?.is_approved;
    }

    values.push(id);
    await queryOne(
      `UPDATE photographer_profiles SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING id`,
      values
    );

    // First-time approval: backfill translations for any dirty content (bio, tagline, packages)
    if (updates.is_approved === true && !wasAlreadyApproved) {
      try {
        const profileRow = await queryOne<{ id: string; tagline: string | null; bio: string | null }>(
          "SELECT id, tagline, bio FROM photographer_profiles WHERE id = $1 AND COALESCE(translations_dirty, TRUE) = TRUE",
          [id]
        );
        if (profileRow && (profileRow.tagline || profileRow.bio)) {
          import("@/lib/translate-content").then(({ translatePhotographerProfile }) =>
            translatePhotographerProfile(profileRow.id, profileRow.tagline, profileRow.bio),
          ).catch((e) => console.error("[admin] approval translate profile error:", e));
        }
        // Also translate any dirty packages for this photographer
        const dirtyPkgs = await query<{ id: string; name: string; description: string | null }>(
          "SELECT id, name, description FROM packages WHERE photographer_id = $1 AND COALESCE(translations_dirty, TRUE) = TRUE",
          [id]
        );
        for (const pkg of dirtyPkgs) {
          import("@/lib/translate-content").then(({ translatePackage }) =>
            translatePackage(pkg.id, pkg.name, pkg.description),
          ).catch((e) => console.error("[admin] approval translate package error:", e));
        }
      } catch (translateErr) {
        console.error("[admin] approval backfill translate error:", translateErr);
      }
    }

    // Approval opens stage two: the profile is live, and the photographer now
    // has a week to connect a payout account. Shared with the revision-approve
    // screen so both buttons stamp the deadline and send the same messages.
    if (updates.is_approved === true && !wasAlreadyApproved) {
      const { runApprovalSideEffects } = await import("@/lib/photographer-approval");
      await runApprovalSideEffects(id);
    }


    // If deactivating, also ban the user so their session is invalidated
    if ("is_deactivated" in updates) {
      const profile = await queryOne<{ user_id: string }>(
        "SELECT user_id FROM photographer_profiles WHERE id = $1", [id]
      );
      if (profile) {
        await query(
          "UPDATE users SET is_banned = $1 WHERE id = $2",
          [updates.is_deactivated, profile.user_id]
        );
      }
    }

    // Bust ISR cache on homepage, photographers list, profile page, and dashboard
    revalidatePath("/");
    revalidatePath("/photographers");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/photographer");

    // Also revalidate the specific photographer's public profile
    const slugRow = await queryOne<{ slug: string }>(
      "SELECT slug FROM photographer_profiles WHERE id = $1", [id]
    );
    if (slugRow) revalidatePath(`/photographers/${slugRow.slug}`);

    // Audit log — use real name instead of slug
    const nameRow = await queryOne<{ name: string }>(
      "SELECT u.name FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = $1", [id]
    );
    const changedFields = Object.entries(updates).filter(([k]) => k !== "is_deactivated").map(([k, v]) => `${k}=${v}`).join(", ");
    await logAudit(admin.email, "update", "photographer", id, nameRow?.name || slugRow?.slug || id, changedFields);

    // Sync to Intercom (approval/deactivation status)
    if ("is_approved" in updates || "is_deactivated" in updates) {
      const profile = await queryOne<{ user_id: string; is_approved: boolean }>(
        "SELECT user_id, COALESCE(is_approved, FALSE) as is_approved FROM photographer_profiles WHERE id = $1", [id]
      );
      if (profile) {
        const userInfo = await queryOne<{ email: string; is_banned: boolean }>(
          "SELECT email, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE id = $1", [profile.user_id]
        );
        if (userInfo) {
          const token = process.env.INTERCOM_ACCESS_TOKEN;
          if (country.intercomAppId && token) {
            fetch("https://api.intercom.io/contacts/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ query: { field: "email", operator: "=", value: userInfo.email } }),
            }).then(r => r.json()).then(data => {
              const contact = data.data?.[0];
              if (contact) {
                fetch(`https://api.intercom.io/contacts/${contact.id}`, {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
                  body: JSON.stringify({ custom_attributes: { is_approved: profile.is_approved && !userInfo.is_banned } }),
                });
              }
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] update error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/photographer", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// Delete photographer (and their user account)
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Get user_id before deleting profile
    const profile = await queryOne<{ user_id: string }>(
      "SELECT user_id FROM photographer_profiles WHERE id = $1", [id]
    );
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // CASCADE will handle photographer_profiles, packages, portfolio_items, etc.
    await query("DELETE FROM users WHERE id = $1", [profile.user_id]);

    revalidatePath("/");
    revalidatePath("/photographers");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] delete error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/photographer", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
