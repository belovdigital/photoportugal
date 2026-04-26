import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";

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

    // Send approval email only when photographer is newly approved (was not approved before)
    if (updates.is_approved === true && !wasAlreadyApproved) {
      try {
        const photographer = await queryOne<{ email: string; name: string; slug: string }>(
          `SELECT u.email, u.name, pp.slug
           FROM photographer_profiles pp
           JOIN users u ON u.id = pp.user_id
           WHERE pp.id = $1`,
          [id]
        );
        if (photographer?.email) {
          const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
          const profileUrl = `${BASE_URL}/photographers/${photographer.slug}`;
          sendEmail(
            photographer.email,
            "Your profile is now live on Photo Portugal!",
            `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
              <h2 style="color: #C94536;">Congratulations, ${photographer.name}!</h2>
              <p>Great news — your photographer profile has been reviewed and approved. You're now live on Photo Portugal and visible to thousands of tourists planning their trips to Portugal.</p>

              <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                <p style="margin: 0 0 8px; font-weight: bold; color: #166534;">Your profile is live:</p>
                <p style="margin: 0;"><a href="${profileUrl}" style="color: #C94536; font-weight: bold;">${profileUrl}</a></p>
              </div>

              <p style="font-weight: bold; color: #333;">Tips to get your first booking:</p>
              <ul style="line-height: 1.8; color: #555;">
                <li><strong>Complete your portfolio</strong> — Profiles with 10+ photos get 3x more enquiries</li>
                <li><strong>Set competitive prices</strong> — Start with an attractive intro rate to build reviews</li>
                <li><strong>Add multiple locations</strong> — The more places you cover, the more clients find you</li>
                <li><strong>Write a compelling bio</strong> — Tell clients what makes your style unique</li>
                <li><strong>Connect Stripe</strong> — Required to accept paid bookings and receive payouts</li>
              </ul>

              <p><a href="${BASE_URL}/dashboard/profile" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Your Dashboard</a></p>

              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>
            `
          ).catch((err) => console.error("[admin] Failed to send approval email:", err));

          // WhatsApp/SMS to photographer about approval
          try {
            const photographerPhone = await queryOne<{ phone: string | null; user_id: string }>(
              `SELECT u.phone, u.id as user_id FROM users u
               JOIN photographer_profiles pp ON pp.user_id = u.id
               WHERE pp.id = $1`,
              [id]
            );
            if (photographerPhone?.phone) {
              const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
                "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                [photographerPhone.user_id]
              );
              if (smsPrefs?.sms_bookings !== false) {
                sendSMS(
                  photographerPhone.phone,
                  `Photo Portugal: Congratulations! Your profile is now live. Clients can find and book you at photoportugal.com`
                ).catch(err => console.error("[sms] error:", err));
              }
            }
            // Telegram notification to admins with phone for WhatsApp group addition
            import("@/lib/telegram").then(({ sendTelegram }) => {
              sendTelegram(`✅ <b>Photographer Approved!</b>\n\n<b>Name:</b> ${photographer.name}\n<b>Phone:</b> ${photographerPhone?.phone || "not set"}\n\n👉 Add to WhatsApp group`, "photographers");
            }).catch((err) => console.error("[admin] telegram approval error:", err));
          } catch (smsErr) {
            console.error("[admin] approval whatsapp/sms error:", smsErr);
          }
        }
      } catch (emailErr) {
        console.error("[admin] Error sending approval email:", emailErr);
      }
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
          if (token) {
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
