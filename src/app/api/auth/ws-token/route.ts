import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authFromRequest } from "@/lib/mobile-auth";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

export async function GET(req: NextRequest) {
  // Try mobile auth first (Bearer token), then web auth (cookie session)
  let userId: string | undefined;
  let userName = "";
  let userEmail = "";

  const mobileUser = await authFromRequest(req);
  if (mobileUser) {
    userId = mobileUser.id;
    userEmail = mobileUser.email || "";
  } else {
    const session = await auth();
    const user = session?.user as { id?: string; name?: string; email?: string } | undefined;
    if (user?.id) {
      userId = user.id;
      userName = user.name || "";
      userEmail = user.email || "";
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // typ:"ws" scopes this token to the websocket handshake. authFromRequest
  // rejects it, so even though it is signed with the same secret it cannot be
  // replayed as an API session — which matters because it is sent to a
  // websocket server on a box shared with a third party.
  const token = jwt.sign(
    { id: userId, name: userName, email: userEmail, typ: "ws" },
    getJwtSecret(),
    { expiresIn: "24h" }
  );

  return NextResponse.json({ token });
}
