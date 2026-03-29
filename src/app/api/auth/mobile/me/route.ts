import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };

    const user = await queryOne<{
      id: string; email: string; name: string; role: string; avatar_url: string | null;
      is_banned: boolean;
    }>(
      `SELECT id, email, name, role, avatar_url, COALESCE(is_banned, FALSE) as is_banned
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
    });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
