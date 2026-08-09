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
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/push-token", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
  }
}

// The app calls this when the user switches markets: THIS market must stop
// pushing to the device, or its notifications keep arriving and a tap routes
// this database's bookingId into the other market's screens. Until this
// handler existed the app's DELETE got a 405 and the deregistration silently
// never happened.
export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await queryOne(
      "UPDATE users SET push_token = NULL, push_platform = NULL WHERE id = $1",
      [user.id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[push-token] delete error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/auth/push-token", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to remove token" }, { status: 500 });
  }
}
