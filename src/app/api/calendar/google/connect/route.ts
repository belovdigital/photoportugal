import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const REDIRECT_URI = "https://photoportugal.com/api/calendar/google/callback";

/**
 * Kicks off the Google OAuth flow for connecting a calendar. Photographer
 * must already be authenticated on Photo Portugal — we encode the
 * photographer profile id into a short-lived signed `state` so the
 * callback can match this OAuth round-trip back to the right account
 * (and reject a callback that wasn't initiated by us).
 */
export async function GET(req: NextRequest) {
  // Use canonical public host for relative redirects — `req.url` is
  // localhost:3000 behind nginx, which would send the user there.
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

  const user = await authFromRequest(req);
  if (!user) return NextResponse.redirect(new URL("/auth/signin", base));

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [user.id]
  );
  if (!profile) return NextResponse.redirect(new URL("/dashboard", base));

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });

  const state = jwt.sign(
    { photographer_id: profile.id, action: "connect_google_cal" },
    secret,
    { expiresIn: "10m" }
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    // calendar.readonly is what freeBusy + calendarList both need; openid +
    // userinfo.email so we can label the connection by the user's address.
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    // offline + prompt=consent forces Google to issue a refresh_token even
    // when the user has previously authorised this client. Without prompt
    // the second connect from the same Google account silently re-uses the
    // existing grant and skips refresh_token in the response — which would
    // leave us unable to renew access without forcing the user to re-auth.
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}
