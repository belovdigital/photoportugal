import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Photographer earnings detail.
 *
 * Used by the mobile earnings screen to show the photographer where
 * their money is in the Stripe pipeline:
 *
 * - balance: incoming (transfers in flight to the photographer's
 *   account but not yet paid out) + available (cleared, payout-ready)
 * - next_payout: amount + arrival_date of the next scheduled payout if
 *   any (Stripe schedules these per their connected account settings)
 * - recent_payouts: last 12 payouts, sorted newest first
 * - connect_status: a tri-state pill — "active" / "setup_needed" / "disabled"
 *
 * If the photographer hasn't connected Stripe yet we return zeros
 * with connect_status="setup_needed" so the UI can prompt them to
 * finish setup on web (in-app onboarding is a Phase 2 thing).
 */
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
  }>(
    `SELECT stripe_account_id, stripe_onboarding_complete
     FROM photographer_profiles WHERE user_id = $1`,
    [user.id]
  );

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Not connected yet — short-circuit with a friendly status.
  if (!profile.stripe_account_id) {
    return NextResponse.json({
      connect_status: "setup_needed",
      balance: { incoming: 0, available: 0 },
      next_payout: null,
      recent_payouts: [],
      currency: "eur",
    });
  }

  const stripe = requireStripe();
  const acctId = profile.stripe_account_id;

  // All three calls scope to the connected account via the Stripe-Account
  // header (passed as second arg with `stripeAccount`). They run in
  // parallel — none depend on each other.
  const [balanceRes, payoutsRes, accountRes] = await Promise.allSettled([
    stripe.balance.retrieve({}, { stripeAccount: acctId }),
    stripe.payouts.list({ limit: 12 }, { stripeAccount: acctId }),
    stripe.accounts.retrieve(acctId),
  ]);

  // Balance — sum everything in the same currency. Most accounts only
  // have one currency (EUR for this platform); if a photographer ever
  // gets a USD top-up we still show it but in cents — UI displays raw.
  let incoming = 0;
  let available = 0;
  let currency = "eur";
  if (balanceRes.status === "fulfilled") {
    const bal = balanceRes.value;
    for (const p of bal.pending || []) incoming += p.amount;
    for (const p of bal.available || []) available += p.amount;
    if (bal.available?.[0]?.currency) currency = bal.available[0].currency;
    else if (bal.pending?.[0]?.currency) currency = bal.pending[0].currency;
  }

  // Recent payouts — Stripe gives us amount in cents + arrival_date.
  const recent_payouts = payoutsRes.status === "fulfilled"
    ? payoutsRes.value.data.map((p) => ({
        id: p.id,
        amount: p.amount, // cents
        currency: p.currency,
        status: p.status,
        arrival_date: p.arrival_date * 1000, // → ms epoch for JS
        method: p.method,
        description: p.description,
      }))
    : [];

  // Next payout — Stripe doesn't expose a clean "next scheduled" API, so
  // we approximate: the most recent payout in status="pending" or "in_transit"
  // is the one en route. If none, photographer's payout schedule + balance
  // available implies the next will arrive on the next scheduled day.
  const upcoming = recent_payouts.find(
    (p) => p.status === "pending" || p.status === "in_transit",
  );
  const next_payout = upcoming
    ? { amount: upcoming.amount, currency: upcoming.currency, arrival_date: upcoming.arrival_date, status: upcoming.status }
    : null;

  // Connect status — the Stripe account .charges_enabled + .payouts_enabled
  // is the source of truth. Our DB flag can drift on early-onboarded
  // accounts.
  let connect_status: "active" | "setup_needed" | "disabled" = "setup_needed";
  if (accountRes.status === "fulfilled") {
    const a = accountRes.value;
    if (a.charges_enabled && a.payouts_enabled) connect_status = "active";
    else if (a.requirements?.disabled_reason) connect_status = "disabled";
    else connect_status = "setup_needed";
  }

  return NextResponse.json({
    connect_status,
    balance: { incoming, available },
    next_payout,
    recent_payouts,
    currency,
  });
}
