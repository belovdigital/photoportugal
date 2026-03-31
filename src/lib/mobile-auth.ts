import { auth } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

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
      try {
        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.verify(token, getJwtSecret()) as MobileUser;
        if (decoded.id) return decoded;
      } catch {}
    }
  }

  return null;
}
