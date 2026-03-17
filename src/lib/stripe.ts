import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null as unknown as Stripe;

// Commission rates by plan
export const COMMISSION_RATES: Record<string, number> = {
  free: 0.20,     // 20%
  pro: 0.12,      // 12%
  premium: 0.07,  // 7%
};

export const SERVICE_FEE_RATE = 0.10; // 10% client service fee

/**
 * Calculate payment breakdown
 */
export function calculatePayment(packagePrice: number, plan: string) {
  const serviceFee = Math.round(packagePrice * SERVICE_FEE_RATE * 100) / 100;
  const totalClientPays = packagePrice + serviceFee;
  const commissionRate = COMMISSION_RATES[plan] || COMMISSION_RATES.free;
  const platformFee = Math.round(packagePrice * commissionRate * 100) / 100;
  const photographerPayout = packagePrice - platformFee;

  return {
    packagePrice,
    serviceFee,
    totalClientPays,
    platformFee,
    photographerPayout,
    commissionRate,
  };
}
