import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, getJwtSecret()) as { id: string; email: string; role: string };

    const user = await queryOne<{
      id: string; email: string; name: string; role: string; avatar_url: string | null;
      is_banned: boolean;
      has_google: boolean; has_apple: boolean;
    }>(
      // The provider flags, not the ids: the app needs to know HOW this person
      // signs in (so adding a second country can replay the same method) and
      // never needs the subs themselves.
      `SELECT id, email, name, role, avatar_url, COALESCE(is_banned, FALSE) as is_banned,
              (google_id IS NOT NULL) AS has_google, (apple_id IS NOT NULL) AS has_apple
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (!user || user.is_banned) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
      has_google: user.has_google,
      has_apple: user.has_apple,
    });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
