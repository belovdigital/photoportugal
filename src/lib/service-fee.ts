// Client-safe pricing constant — importable from browser components
// (src/lib/stripe.ts re-exports it for server code; keep the value HERE
// so there is exactly one source of truth).
export const SERVICE_FEE_RATE = 0.15; // 15% — raised from 12.5% on 2026-06-12

// The all-in amount a client pays for a given base price: +15%, rounded UP
// to the nearest €5 (Alex, 2026-08-09). Clients see ONE price everywhere —
// catalog, package page, checkout, Stripe — with no fee line, so it has to
// read as a price (€345), not as arithmetic (€343.85). Rounding up rather
// than to nearest so the platform margin is never shaved below 15%; the
// rounding remainder stays with the platform, same trick as extras-pricing.
//
// calculatePayment() in lib/stripe.ts charges THIS number. Any surface that
// shows a client a package-derived price must go through this function —
// a displayed price that differs from the Stripe charge is a support ticket.
export function clientPriceWithFee(basePrice: number): number {
  const cents = Math.round(basePrice * (1 + SERVICE_FEE_RATE) * 100);
  return Math.ceil(cents / 500) * 5;
}
