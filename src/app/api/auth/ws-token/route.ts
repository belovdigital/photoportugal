import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as { id?: string; name?: string; email?: string };
  if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = jwt.sign(
    { id: user.id, name: user.name || "", email: user.email || "" },
    getJwtSecret(),
    { expiresIn: "24h" }
  );

  return NextResponse.json({ token });
}
