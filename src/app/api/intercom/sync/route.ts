import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const INTERCOM_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false });

  const user = session.user as { id?: string; email?: string; name?: string; role?: string };
  if (!user.id || !user.email) return NextResponse.json({ ok: false });

  try {
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
      // Update existing contact
      await fetch(`https://api.intercom.io/contacts/${contact.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${INTERCOM_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          custom_attributes: { user_role: user.role || "client" },
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[intercom/sync] error:", err);
    return NextResponse.json({ ok: false });
  }
}
