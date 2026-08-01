import { country, isManualPayout } from "./country";

// Re-exported so call sites need only one payout import, not two.
export { isManualPayout } from "./country";

/**
 * "Can this photographer be paid?" — expressed once, so the answer cannot drift
 * between the admin approval queue, the booking-confirmation gate and the
 * earnings page.
 *
 * Two markets, two definitions of ready:
 *   • Connect markets (Portugal): Stripe holds a completed express account.
 *   • Manual markets (Spain): we hold bank details to transfer to by hand.
 *
 * The Connect branch is character-for-character what these call sites had
 * inline before, so Portugal's generated SQL is unchanged.
 */
export function payoutReadySql(alias = "pp"): string {
  return isManualPayout
    ? `${alias}.payout_iban IS NOT NULL AND length(trim(${alias}.payout_iban)) > 0`
    : `${alias}.stripe_account_id IS NOT NULL AND ${alias}.stripe_onboarding_complete = TRUE`;
}

/** Same question, answered against a row already loaded in JS. */
export function isPayoutReady(profile: {
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  payout_iban?: string | null;
}): boolean {
  return isManualPayout
    ? !!profile.payout_iban?.trim()
    : !!profile.stripe_account_id && !!profile.stripe_onboarding_complete;
}

/**
 * Copy for the onboarding checklist item and the error a photographer sees when
 * they try to confirm a booking before they can be paid. Kept next to the
 * predicate so the wording can never describe Stripe in a market that has none.
 */
export const payoutSetupCopy = isManualPayout
  ? {
      checklistLabel: "Bank details for payouts",
      blockedError:
        "Please add your bank details before confirming bookings. Go to Dashboard → Payouts to add your IBAN.",
    }
  : {
      checklistLabel: "Stripe Connect",
      blockedError:
        "Please connect your Stripe account before confirming bookings. Go to Dashboard → Subscription → Stripe Connect to set up payments.",
    };

/** Currency for this market. Both current countries are euro, kept explicit. */
export const payoutCurrency = country.code === "es" ? "eur" : "eur";
