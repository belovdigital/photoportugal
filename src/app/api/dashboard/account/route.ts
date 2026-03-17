import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { name } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    await queryOne("UPDATE users SET name = $1 WHERE id = $2 RETURNING id", [name.trim(), userId]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
