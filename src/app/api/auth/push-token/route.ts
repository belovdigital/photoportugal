import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, platform } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    await queryOne(
      "UPDATE users SET push_token = $1, push_platform = $2 WHERE id = $3",
      [token, platform || "unknown", user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[push-token] error:", error);
    return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
  }
}
