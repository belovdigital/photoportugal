import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const REDIRECT_URI = "https://photoportugal.com/api/calendar/google/callback";

/**
 * Mobile-friendly variant of /api/calendar/google/connect.
 *
 * The web version returns a 302 redirect to Google's OAuth — perfect for a
 * browser, useless for an in-app WebBrowser session because the mobile
 * client needs to know the URL upfront to call expo-web-browser.openAuthSessionAsync.
 *
 * This endpoint does the same auth + state-JWT signing but returns the
 * resulting Google OAuth URL as JSON. Mobile opens it in WebBrowser, the
 * user grants access, Google redirects to /api/calendar/google/callback
 * (which doesn't require any session — the state JWT carries the
 * photographer_id), the connection is stored, and the success page redirects
 * to a deep link the app intercepts.
 */
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [user.id]
  );
  if (!profile) {
    return NextResponse.json({ error: "Photographer profile not found" }, { status: 404 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });

  const state = jwt.sign(
    { photographer_id: profile.id, action: "connect_google_cal", source: "mobile" },
    secret,
    { expiresIn: "10m" }
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  return NextResponse.json({
    url: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`,
  });
}
