import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await query<{
    id: string;
    email: string;
    photographer_name: string;
    photographer_slug: string;
    locale: string;
    created_at: string;
    email_sent: boolean;
    converted_user_id: string | null;
  }>(
    `SELECT sp.id, sp.email, pu.name as photographer_name, pp.slug as photographer_slug,
            sp.locale, sp.created_at, sp.email_sent, sp.converted_user_id
     FROM saved_photographers sp
     LEFT JOIN photographer_profiles pp ON pp.id = sp.photographer_id
     LEFT JOIN users pu ON pu.id = pp.user_id
     ORDER BY sp.created_at DESC
     LIMIT 200`
  );

  return NextResponse.json({ items: rows });
}
