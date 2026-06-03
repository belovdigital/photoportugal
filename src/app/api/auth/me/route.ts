import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(null);
  }
  const user = session.user as { id?: string; email?: string; name?: string; role?: string };
  const row = user.id
    ? await queryOne<{ phone: string | null }>("SELECT phone FROM users WHERE id = $1", [user.id])
    : null;
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: row?.phone ?? null,
  });
}
