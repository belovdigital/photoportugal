import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

const INTERCOM_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false });

  const user = session.user as { id?: string; email?: string; name?: string; role?: string };
  if (!user.id || !user.email) return NextResponse.json({ ok: false });

  try {
    // Get photographer status if applicable
    const attrs: Record<string, string | boolean> = { user_role: user.role || "client" };
    if (user.role === "photographer") {
      const profile = await queryOne<{ is_approved: boolean }>(
        "SELECT COALESCE(is_approved, FALSE) as is_approved FROM photographer_profiles WHERE user_id = $1",
        [user.id]
      );
      attrs.is_approved = profile?.is_approved ?? false;
    }

    // Search for contact by email
    const searchRes = await fetch("https://api.intercom.io/contacts/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INTERCOM_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        query: { field: "email", operator: "=", value: user.email },
      }),
    });
    const searchData = await searchRes.json();
    const contact = searchData.data?.[0];

    if (contact) {
      await fetch(`https://api.intercom.io/contacts/${contact.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${INTERCOM_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ custom_attributes: attrs }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[intercom/sync] error:", err);
    return NextResponse.json({ ok: false });
  }
}
