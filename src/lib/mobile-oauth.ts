import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";

/**
 * Verifies the identity tokens the mobile app sends for Sign in with Apple and
 * Google.
 *
 * These are MARKET-INVARIANT. The audiences are bound to the app's bundle id
 * and Google project, not to any website — one app, one set of client ids,
 * identical in all three deployments. Do NOT move them into the country pack:
 * a per-market value invites a wrong entry that locks the app out of a market.
 *
 * History: both routes used to accept a token without verifying its signature.
 * Apple's especially — `jwt.decode()` parses base64 and checks nothing, and
 * the only guard was `iss`, a field the caller writes. A forged, unsigned JWT
 * carrying any victim's email was accepted, matched to that account by email,
 * and a session issued: full account takeover from an email address alone.
 */

// Native Sign in with Apple sets `aud` to the app's bundle identifier.
const APPLE_AUDIENCE = "com.photoportugal.app";

// Every OAuth client under Google project 133920543165. @react-native-google-signin
// stamps `aud` with the web client id when a webClientId is configured, but iOS
// and Android builds can surface their own — all three are ours, so accepting
// any of them is safe, and a token from a foreign project carries none of them.
const GOOGLE_AUDIENCES = [
  "133920543165-n0aqj96or5eihuge8i464dni228c42rj.apps.googleusercontent.com", // web
  "133920543165-feat1a7gnkg6v8d225ek8rut9jn927b0.apps.googleusercontent.com", // ios
  "133920543165-4sa1lhnketrpbg3obosu2bop100j9k9d.apps.googleusercontent.com", // android
];

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Raised when a token fails cryptographic verification. Callers map it to 401. */
export class OAuthTokenInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthTokenInvalid";
  }
}

/**
 * Log why a token was rejected, using an UNVERIFIED decode purely for
 * diagnostics. Never returned to the client and never trusted — it exists so a
 * bad-audience misconfiguration surfaces in the logs on the first failed real
 * sign-in instead of as a silent lockout.
 */
function logRejection(provider: string, token: string, err: unknown) {
  let claims = "<undecodable>";
  try {
    const c = decodeJwt(token);
    claims = `iss=${c.iss} aud=${JSON.stringify(c.aud)} exp=${c.exp}`;
  } catch {
    // leave placeholder
  }
  console.warn(`[oauth/${provider}] token rejected: ${(err as Error).message} | ${claims}`);
}

export interface AppleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleClaims> {
  try {
    const { payload } = await jwtVerify(token, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: APPLE_AUDIENCE,
    });
    if (!payload.sub) throw new Error("no sub");
    // Apple sends email_verified as the string "true"/"false" or a boolean.
    const ev = payload.email_verified;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      email_verified: ev === true || ev === "true",
    };
  } catch (err) {
    logRejection("apple", token, err);
    throw new OAuthTokenInvalid("Invalid Apple token");
  }
}

export interface GoogleClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(token: string): Promise<GoogleClaims> {
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: GOOGLE_AUDIENCES,
    });
    if (!payload.sub || typeof payload.email !== "string") {
      throw new Error("missing sub/email");
    }
    const ev = payload.email_verified;
    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: ev === true || ev === "true",
      name: typeof payload.name === "string" ? payload.name : undefined,
      given_name: typeof payload.given_name === "string" ? payload.given_name : undefined,
      family_name: typeof payload.family_name === "string" ? payload.family_name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch (err) {
    logRejection("google", token, err);
    throw new OAuthTokenInvalid("Invalid Google token");
  }
}
