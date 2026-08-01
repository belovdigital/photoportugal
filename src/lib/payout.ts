/**
 * "Can this photographer be paid?" — expressed once, so the answer cannot drift
 * between the admin approval queue, the booking-confirmation gate and the
 * earnings page.
 *
 * Both markets pay through Stripe Connect. Spain briefly had a second, manual
 * branch here (we hold an IBAN and transfer by hand), added because we believed
 * a Portuguese-registered platform could not onboard Spanish photographers.
 * It can — the platform's country constrains only the platform account, while
 * each connected account carries its own country, identity and bank details.
 * The manual branch is gone rather than disabled: a payout path that nothing
 * exercises is a path nobody notices breaking.
 */
export function payoutReadySql(alias = "pp"): string {
  return `${alias}.stripe_account_id IS NOT NULL AND ${alias}.stripe_onboarding_complete = TRUE`;
}

/** Same question, answered against a row already loaded in JS. */
export function isPayoutReady(profile: {
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
}): boolean {
  return !!profile.stripe_account_id && !!profile.stripe_onboarding_complete;
}

/**
 * Copy for the onboarding checklist item and the error a photographer sees when
 * they try to confirm a booking before they can be paid. Kept next to the
 * predicate so the wording can never describe a payout method we do not use.
 */
export const payoutSetupCopy = {
  checklistLabel: "Stripe Connect",
  blockedError:
    "Please connect your Stripe account before confirming bookings. Go to Dashboard → Subscription → Stripe Connect to set up payments.",
};

/** Currency for this market. Both current countries are euro, kept explicit. */
export const payoutCurrency = "eur";
