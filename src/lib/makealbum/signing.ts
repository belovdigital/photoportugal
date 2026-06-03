import crypto from "node:crypto";

// HMAC handshake matches the makealbum.co spec: signature is
// HMAC_SHA256(secret, `${timestamp}.${rawBody}`) in hex, transmitted as
// `v1=<hex>` in the X-*-Signature header.

const TOLERANCE_SECONDS = 5 * 60;

export function signPayload(secret: string, timestamp: number, rawBody: string): string {
  const mac = crypto.createHmac("sha256", secret);
  mac.update(`${timestamp}.${rawBody}`);
  return `v1=${mac.digest("hex")}`;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify a `v1=<hex>` signature header against the raw body.
 *
 * Returns one of:
 *   { ok: true } — signature valid and timestamp within tolerance
 *   { ok: false, reason: "..."} — anything else, with a debuggable reason
 *
 * Caller responses should NOT echo the reason back to the network — only
 * log it server-side. The caller decides whether to enforce signing
 * (some env configs may legitimately skip it).
 */
export function verifySignature(opts: {
  secret: string;
  timestamp: string | number | null;
  signatureHeader: string | null;
  rawBody: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!opts.signatureHeader) return { ok: false, reason: "missing signature header" };
  if (!opts.timestamp) return { ok: false, reason: "missing timestamp header" };
  const ts = typeof opts.timestamp === "string" ? parseInt(opts.timestamp, 10) : opts.timestamp;
  if (!Number.isFinite(ts)) return { ok: false, reason: "non-numeric timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: `timestamp drift ${now - ts}s exceeds ±${TOLERANCE_SECONDS}s` };
  }
  const expected = signPayload(opts.secret, ts, opts.rawBody);
  // Compare just the hex part — never compare raw strings (timing leak).
  const expHex = expected.startsWith("v1=") ? expected.slice(3) : expected;
  const gotHex = opts.signatureHeader.startsWith("v1=") ? opts.signatureHeader.slice(3) : opts.signatureHeader;
  if (!timingSafeEqualHex(expHex, gotHex)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}
