import { requireStripe } from "@/lib/stripe";
import { query } from "@/lib/db";

/**
 * If a photographer's `stripe_onboarding_complete` flag is stale (false while
 * Stripe actually has the account onboarded), fetch live status and sync DB.
 * Safe to call often — only hits Stripe when the flag is false.
 * Returns the freshest flag.
 */
export async function syncStripeOnboardingIfStale(
  accountId: string | null,
  currentFlag: boolean
): Promise<boolean> {
  if (!accountId || currentFlag) return currentFlag;
  try {
    const account = await requireStripe().accounts.retrieve(accountId);
    if (account.charges_enabled && account.payouts_enabled) {
      await query(
        "UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE WHERE stripe_account_id = $1",
        [accountId]
      );
      return true;
    }
  } catch (err) {
    console.error("[stripe-sync] failed to check", accountId, err);
  }
  return false;
}
