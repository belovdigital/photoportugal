import crypto from "crypto";
import { signGiftToken, verifyGiftToken } from "@/lib/gift-token";

// Tier definitions are the source of truth for buyer price, photographer
// payout, and the standard package shape. Edit here if pricing changes.
export const GIFT_CARD_TIERS = {
  express: {
    code: "express" as const,
    label: "Express",
    durationMinutes: 60,
    photos: 30,
    locations: 1,
    deliveryDays: 7,
    outfitChange: false,
    buyerPrice: 349,
    photographerPayout: 254,
    description: "1-hour photo session — 30 edited photos, 1 location, delivered in 7 days.",
  },
  full: {
    code: "full" as const,
    label: "Full",
    durationMinutes: 120,
    photos: 60,
    locations: 2,
    deliveryDays: 7,
    outfitChange: true,
    buyerPrice: 520,
    photographerPayout: 382,
    description: "2-hour photo session — 60 edited photos, up to 2 locations, one outfit change, delivered in 7 days.",
  },
} as const;

export type GiftCardTier = keyof typeof GIFT_CARD_TIERS;

export function isGiftCardTier(s: unknown): s is GiftCardTier {
  return typeof s === "string" && (s === "express" || s === "full");
}

/**
 * Human-readable card code: GIFT-XXXX-XXXX (12 chars, unambiguous alphabet).
 * Used in the recipient email as a fallback if the magic-link breaks; also
 * the public identifier on the PDF certificate.
 */
export function generateGiftCardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip I, O, 0, 1
  const pick = (n: number) =>
    Array.from(crypto.randomFillSync(new Uint8Array(n)))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `GIFT-${pick(4)}-${pick(4)}`;
}

/**
 * Gift card validity is 12 months from purchase, with optional +30 day
 * extensions when a photographer cancels a redeemed booking.
 */
export function defaultGiftCardExpiry(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/**
 * Magic-link claim URL for a gift card. Reuses the existing gift-token
 * signer (HMAC-SHA256 over userId:bookingId:expiresAt). For gift cards
 * we encode userId=recipientUserId, bookingId=giftCardId — same envelope,
 * different payload semantic. The `/gift-card/claim` page knows it's a
 * gift-card token because of the URL it lands on.
 */
export function signGiftCardClaimToken(recipientUserId: string, giftCardId: string): string {
  return signGiftToken(recipientUserId, giftCardId);
}

export function verifyGiftCardClaimToken(token: string) {
  const payload = verifyGiftToken(token);
  if (!payload) return null;
  return { recipientUserId: payload.userId, giftCardId: payload.bookingId, expiresAt: payload.expiresAt };
}
