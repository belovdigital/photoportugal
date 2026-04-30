import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://photoportugal.com/api/calendar/google/callback";

function redirectBack(_req: NextRequest, params: Record<string, string>): NextResponse {
  // `req.url` resolves to the proxy upstream (http://localhost:3000) behind
  // nginx, so we'd send the user there if we used it as the base. Pin to
  // the canonical public host instead — set in env, falls back to the
  // hard-coded production URL.
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";
  const url = new URL("/dashboard/calendar-sync", base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * OAuth callback. Verifies state, exchanges the code for tokens, fetches
 * the user's email so we can label the connection, then upserts a
 * calendar_connections row. Default selection is the user's PRIMARY
 * calendar only — if they want secondary calendars to also count as busy,
 * they tick them in the dashboard UI. This avoids the "I connected and
 * now my kid's birthday blocks my shoots" surprise.
 *
 * The first sync runs in the background after the row is created; the
 * dashboard polls and shows updated event counts within a few seconds.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) {
    return redirectBack(req, { error: errParam });
  }
  if (!code || !state) {
    return redirectBack(req, { error: "missing_code_or_state" });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret || !clientId || !clientSecret) {
    return redirectBack(req, { error: "server_misconfigured" });
  }

  // Verify state — must be a JWT we issued, not yet expired, with action match
  let photographerId: string;
  try {
    const decoded = jwt.verify(state, secret) as { photographer_id?: string; action?: string };
    if (decoded.action !== "connect_google_cal" || !decoded.photographer_id) {
      throw new Error("bad action");
    }
    photographerId = decoded.photographer_id;
  } catch {
    return redirectBack(req, { error: "invalid_state" });
  }

  // Exchange code → tokens
  let tokens: { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("[google/callback] token exchange failed:", tokenRes.status, txt);
      return redirectBack(req, { error: "token_exchange_failed" });
    }
    tokens = await tokenRes.json();
  } catch (err) {
    console.error("[google/callback] token exchange error:", err);
    return redirectBack(req, { error: "token_exchange_error" });
  }

  if (!tokens.refresh_token) {
    // We forced prompt=consent, so this shouldn't happen on a first-time
    // grant. If it does, the connection is unusable long-term — bail.
    return redirectBack(req, { error: "no_refresh_token" });
  }

  // Fetch user email so we can label the connection (and dedup on it).
  let email: string;
  try {
    const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json() as { email?: string };
    if (!me.email) throw new Error("no email in userinfo");
    email = me.email;
  } catch (err) {
    console.error("[google/callback] userinfo fetch error:", err);
    return redirectBack(req, { error: "userinfo_failed" });
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Upsert — same Google account re-connecting just refreshes its tokens
  // and keeps any previous selected_calendar_ids the photographer set.
  let row: { id: string } | null;
  try {
    row = await queryOne<{ id: string }>(
      `INSERT INTO calendar_connections
         (photographer_id, type, display_name, google_email,
          google_refresh_token, google_access_token, google_access_token_expires_at,
          selected_calendar_ids)
       VALUES ($1, 'google', $2, $3, $4, $5, $6, ARRAY['primary'])
       ON CONFLICT (photographer_id, google_email) WHERE type = 'google' AND google_email IS NOT NULL
       DO UPDATE SET
         google_refresh_token = EXCLUDED.google_refresh_token,
         google_access_token = EXCLUDED.google_access_token,
         google_access_token_expires_at = EXCLUDED.google_access_token_expires_at,
         is_active = TRUE,
         last_sync_error = NULL,
         updated_at = NOW()
       RETURNING id`,
      [
        photographerId,
        `Google (${email})`,
        email,
        tokens.refresh_token,
        tokens.access_token,
        expiresAt,
      ]
    );
  } catch (err) {
    console.error("[google/callback] insert error:", err);
    return redirectBack(req, { error: "insert_failed" });
  }
  if (!row) return redirectBack(req, { error: "insert_returned_nothing" });

  // First sync in background — kick it off so the dashboard sees populated
  // event counts within seconds. Errors are written to last_sync_error on
  // the row, not surfaced here.
  import("@/lib/calendar-sync").then(async ({ syncConnection }) => {
    const conn = await queryOne<Parameters<typeof syncConnection>[0]>(
      `SELECT id, photographer_id, type, display_name, google_email, google_refresh_token,
              google_access_token, google_access_token_expires_at, selected_calendar_ids,
              ical_url, is_active, last_synced_at, last_sync_error, last_sync_event_count
         FROM calendar_connections WHERE id = $1`,
      [row!.id]
    );
    if (conn) await syncConnection(conn);
  }).catch((err) => console.error("[google/callback] initial sync error:", err));

  return redirectBack(req, { connected: "google", email });
}
