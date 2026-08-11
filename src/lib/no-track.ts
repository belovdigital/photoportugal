import type { NextRequest } from "next/server";

/**
 * Opt-out marker for our own browsing.
 *
 * The admin panel itself was never tracked (VisitorTracker only mounts
 * under [locale]), but the same browser then walks the public site — and
 * every one of those visits landed in Recent Visitors under the name of
 * whoever was last impersonated. /api/admin/impersonate mints an ordinary
 * next-auth cookie, the tracker read it as a real login, and
 * /api/link-visitor stamped that user id onto the entire history of the
 * `vid` cookie. Logging out never undid it: the admin list resolves an
 * anonymous session to the last user ever seen on that visitor id.
 *
 * So anything that authenticates as an admin now sets this cookie, and
 * the tracker plus every ingest endpoint do nothing at all for that
 * browser. Not httpOnly on purpose — the client reads it before it
 * fetches, so no request is made in the first place.
 *
 * To be counted as an ordinary visitor again (QA-ing the funnel, checking
 * that tracking still works), delete the cookie or use a private window.
 */
export const NO_TRACK_COOKIE = "pp_notrack";

/** Long-lived: one admin login should keep a browser quiet for good. */
export const NO_TRACK_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 365 * 24 * 60 * 60,
} as const;

/** Server side — for the ingest routes. */
export function isNoTrackRequest(req: NextRequest): boolean {
  return req.cookies.get(NO_TRACK_COOKIE)?.value === "1";
}
