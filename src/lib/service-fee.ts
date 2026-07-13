// Client-safe pricing constant — importable from browser components
// (src/lib/stripe.ts re-exports it for server code; keep the value HERE
// so there is exactly one source of truth).
export const SERVICE_FEE_RATE = 0.15; // 15% — raised from 12.5% on 2026-06-12

// The all-in amount a client pays for a given base price. Mirrors
// calculatePayment() in lib/stripe.ts (round fee to cents, then add).
export function clientPriceWithFee(basePrice: number): number {
  const fee = Math.round(basePrice * SERVICE_FEE_RATE * 100) / 100;
  return Math.round((basePrice + fee) * 100) / 100;
}
