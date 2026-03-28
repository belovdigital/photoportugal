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
