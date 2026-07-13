import Stripe from "stripe";

function getStripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // Pin to acacia. The SDK now defaults to "2026-02-25.clover" which
  // rebranded `coupon` → `promotion` (and changed it from a string to
  // a nested object) for `promotion_codes.create`. That broke
  // createReviewRewardPromoCode and would silently break any other
  // coupon/promo flow we haven't audited yet. Stay on acacia until we
  // explicitly migrate every Stripe call to the new schema.
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion });
}

export const stripe = getStripeClient();

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
  }
  return stripe;
}

// Commission rates by plan (whole percentages)
export const COMMISSION_RATES: Record<string, number> = {
  free: 20,
  pro: 15,
  premium: 10,
};

// Plan prices (monthly, in EUR)
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 29,
  premium: 59,
};

// Single source of truth lives in lib/service-fee (client-safe module —
// chat cards etc. must not import this stripe-SDK file). Re-exported here
// so existing server imports keep working.
export { SERVICE_FEE_RATE } from "@/lib/service-fee";
import { SERVICE_FEE_RATE } from "@/lib/service-fee";

// Large-group surcharge: 9+ people pay an extra 50% on the package base
// price. Applied before service fee. Smaller groups (≤8) pay the package
// price as-is.
export const LARGE_GROUP_THRESHOLD = 9;
export const LARGE_GROUP_SURCHARGE_RATE = 0.5;
export function largeGroupMultiplier(groupSize: number): number {
  return groupSize >= LARGE_GROUP_THRESHOLD ? 1 + LARGE_GROUP_SURCHARGE_RATE : 1;
}

/**
 * Calculate payment breakdown
 */
export function calculatePayment(packagePrice: number | string, plan: string) {
  const price = Number(packagePrice);
  const serviceFee = Math.round(price * SERVICE_FEE_RATE * 100) / 100;
  const totalClientPays = price + serviceFee;
  const commissionPct = COMMISSION_RATES[plan] ?? COMMISSION_RATES.free;
  const commissionRate = commissionPct / 100;
  const platformFee = Math.round(price * commissionRate * 100) / 100;
  const photographerPayout = price - platformFee;

  return {
    packagePrice: price,
    serviceFee,
    totalClientPays,
    platformFee,
    photographerPayout,
    commissionRate,
  };
}

/**
 * Admin-Telegram payout message with the full money split. Numbers come
 * from the booking row (actuals, not re-derived theory): commission is
 * base − payout as actually transferred; service fee is the stored
 * column. NUMERIC columns arrive as strings from pg — everything is
 * Number()-coerced here. Lines that can't be computed are omitted
 * rather than guessed.
 */
export function payoutBreakdownTelegram(opts: {
  payout: number;
  base: number | string | null;
  serviceFee: number | string | null;
  plan: string | null;
  photographerName: string;
  clientName: string;
  bookingId: string;
  note?: string;
}): string {
  const eur = (n: number) => `€${n.toFixed(2)}`;
  const lines = [
    `💸 <b>Отправили фотографу</b> ${eur(opts.payout)}${opts.note ? ` (${opts.note})` : ""}`,
    `${opts.photographerName} · ${opts.clientName}`,
  ];
  const base = opts.base != null ? Number(opts.base) : null;
  if (base && base > 0) {
    const commission = Math.round((base - opts.payout) * 100) / 100;
    if (commission >= 0) {
      const pct = Math.round((commission / base) * 1000) / 10;
      const planLabel = opts.plan ? `, план ${opts.plan}` : "";
      const fee = opts.serviceFee != null ? Number(opts.serviceFee) : null;
      if (fee != null && fee > 0) {
        const ourTotal = Math.round((fee + commission) * 100) / 100;
        lines.push(`Клиент заплатил ${eur(Math.round((base + fee) * 100) / 100)} = база ${eur(base)} + сбор ${eur(fee)}`);
        lines.push(`Нам ${eur(ourTotal)}: сбор ${eur(fee)} + комиссия ${eur(commission)} (${pct}%${planLabel})`);
      } else {
        lines.push(`База ${eur(base)}, наша комиссия ${eur(commission)} (${pct}%${planLabel})`);
      }
    }
  }
  lines.push(`Букинг: <code>${opts.bookingId.slice(-8)}</code>`);
  return lines.join("\n");
}

/**
 * Mint a one-time-use percent-off Stripe promotion code as a thank-you for
 * leaving a review. Code stays valid for 12 months. Returns the human-readable
 * code (REVIEW-XXXX...) plus the underlying Stripe promotionCode.id so the
 * caller can persist it on the review row for support/debugging.
 *
 * Caller MUST handle errors — Stripe outages shouldn't fail the review POST.
 */
export async function createReviewRewardPromoCode(opts: {
  percentOff?: number; // default 10
  validForDays?: number; // default 365
  reviewId?: string; // appears in coupon name for traceability
}): Promise<{ code: string; promotionCodeId: string; couponId: string; percentOff: number }> {
  const stripeClient = requireStripe();
  const percentOff = opts.percentOff ?? 10;
  const validForDays = opts.validForDays ?? 365;
  const expiresAt = Math.floor(Date.now() / 1000) + validForDays * 24 * 60 * 60;
  const code = `REVIEW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coupon = await (stripeClient.coupons.create as any)({
    duration: "once",
    percent_off: percentOff,
    name: `Review thank-you${opts.reviewId ? ` (${opts.reviewId.slice(0, 8)})` : ""}`,
    redeem_by: expiresAt,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promo = await (stripeClient.promotionCodes.create as any)({
    coupon: coupon.id,
    code,
    max_redemptions: 1,
    expires_at: expiresAt,
  });

  return { code: promo.code, promotionCodeId: promo.id, couponId: coupon.id, percentOff };
}

// Manual-capture helpers — used by blind-booking flow where the auth-hold
// is placed at checkout time and only captured once an admin assigns a
// photographer. Auto-refund cron voids if no assignment within 24h.
export async function capturePaymentIntent(paymentIntentId: string) {
  return requireStripe().paymentIntents.capture(paymentIntentId);
}

export async function voidUncapturedPaymentIntent(paymentIntentId: string) {
  return requireStripe().paymentIntents.cancel(paymentIntentId, {
    cancellation_reason: "abandoned",
  });
}

