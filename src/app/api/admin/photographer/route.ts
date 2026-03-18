import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin())) {
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

    values.push(id);
    await queryOne(
      `UPDATE photographer_profiles SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING id`,
      values
    );

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// Delete photographer (and their user account)
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin())) {
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
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
