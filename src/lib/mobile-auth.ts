import { auth } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";

function getJwtSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return s;
}

interface MobileUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Unified auth: checks NextAuth session (web) first, then Bearer token (mobile).
 * Use this instead of `auth()` in API routes that need to support both web and mobile.
 */
export async function authFromRequest(req?: NextRequest): Promise<MobileUser | null> {
  // Try NextAuth session first (web cookies)
  try {
    const session = await auth();
    if (session?.user) {
      const user = session.user as { id?: string; email?: string; role?: string };
      if (user.id && user.email) {
        return { id: user.id, email: user.email, role: user.role || "client" };
      }
    }
  } catch {}

  // Try Bearer token (mobile)
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      let decoded: (MobileUser & { typ?: string }) | null = null;
      try {
        const token = authHeader.replace("Bearer ", "");
        decoded = jwt.verify(token, getJwtSecret()) as MobileUser & { typ?: string };
      } catch {
        // Bad signature / expired — genuinely unauthorized.
        return null;
      }
      // A ws-token carries typ:"ws". It is signed with the same secret but
      // is minted to be handed to the websocket/meet server — a box shared
      // with a third party. Refusing it here stops anyone who observes it
      // there from replaying it as a general-purpose API session.
      if (decoded.typ === "ws") return null;
      if (decoded.id) {
        // Re-check ban status from DB — JWT lives 30 days, ban must be instant.
        // Deliberately NOT wrapped in try/catch: if the DB is unavailable this
        // must surface as a 500, never a 401. The mobile app treats 401 as
        // "session revoked" and wipes its stored token, so swallowing a DB
        // error here turns any transient outage into a mass sign-out — which
        // is exactly what happened on 2026-08-09 when the pool leak ate every
        // PG slot and valid tokens started bouncing as Unauthorized.
        const user = await queryOne<{ is_banned: boolean; role: string }>(
          "SELECT is_banned, role FROM users WHERE id = $1",
          [decoded.id]
        );
        if (!user || user.is_banned) return null;
        return { id: decoded.id, email: decoded.email, role: user.role };
      }
    }
  }

  return null;
}
