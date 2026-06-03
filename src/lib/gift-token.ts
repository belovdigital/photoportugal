import crypto from "crypto";

// Magic-link tokens for /gift/claim. Same HMAC-SHA256 + base64 envelope
// as the admin token, just a different payload shape (and a longer TTL
// because gift recipients may not check their email for weeks).
//
// Payload format: "${userId}:${bookingId}:${expiresAtMs}"
// Token format:   base64("${payload}:${hmac}")

// 13 months — covers the 12-month gift card validity window plus the
// +30 day extension that fires when a photographer cancels and we
// restore the card. Tokens are signed HMAC-SHA256 with NEXTAUTH_SECRET
// and re-validated server-side against the card's status/expires_at on
// every claim attempt, so a long TTL doesn't degrade security.
const TTL_DAYS = 395;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return secret;
}

export function signGiftToken(userId: string, bookingId: string): string {
  const expiresAt = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}:${bookingId}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export type GiftTokenPayload = {
  userId: string;
  bookingId: string;
  expiresAt: number;
};

export function verifyGiftToken(token: string): GiftTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [userId, bookingId, expiresAtStr, hmac] = parts;
    const payload = `${userId}:${bookingId}:${expiresAtStr}`;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    if (hmac.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    return { userId, bookingId, expiresAt };
  } catch {
    return null;
  }
}
