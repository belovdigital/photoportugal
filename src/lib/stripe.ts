import Stripe from "stripe";

function getStripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
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

export const SERVICE_FEE_RATE = 0.10; // 10%

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
    promotion: { type: "coupon", coupon: coupon.id },
    code,
    max_redemptions: 1,
    expires_at: expiresAt,
  });

  return { code: promo.code, promotionCodeId: promo.id, couponId: coupon.id, percentOff };
}
