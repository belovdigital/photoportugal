/**
 * Photographer onboarding is two-stage since 2026-08-02.
 *
 *   Stage 1 — build the profile. Seven checklist items, NO Stripe. When they
 *             are all done the photographer asks for approval, which stamps
 *             `approval_requested_at` and puts them in the admin queue.
 *   Stage 2 — an admin approves. `is_approved` flips exactly as it always
 *             did (the profile goes live and is bookable), AND the Stripe
 *             step unlocks with a one-week deadline in `stripe_deadline_at`.
 *
 * Why this shape: Stripe Connect was the last checklist item and it is where
 * applications died — people who had already uploaded 25 photographs walked
 * away at a bank form for a marketplace that had not yet told them they were
 * accepted. Approving first turns the bank form into paperwork for a job you
 * already have.
 *
 * Why `is_approved` still means "live": it is read in 128 places outside the
 * admin — catalogue, sitemap, schema, llms.json. A photographer live without
 * a payout account is safe: the transfer path skips them, the money stays
 * with the platform, and the retry sweep pays out once Stripe is connected.
 *
 * The deadline lives in its own column rather than being derived from
 * "approved but not payout-ready". A photographer whose Stripe KYC lapses
 * years later matches that derived condition too, and would be dropped into
 * the new-joiner nudge sequence on top of the KYC sweep that already handles
 * them. Only an approval sets the deadline.
 */

export const STRIPE_GRACE_DAYS = 7;

/**
 * What happens when the grace week runs out: the profile stops being public.
 * It is NOT the admin deactivate path — that also bans the user, and these
 * photographers need to be able to log in and fix the one thing missing.
 * Connecting Stripe restores them automatically.
 */
export const HIDE_ON_STRIPE_DEADLINE = true;

/** Days after approval on which we nudge an unfinished Stripe connection. */
export const STRIPE_NUDGE_DAYS = [1, 4, 7] as const;

export interface StageProfile {
  is_approved: boolean;
  approval_requested_at: string | Date | null;
  revision_status: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_deadline_at: string | Date | null;
  stripe_hidden_at: string | Date | null;
}

export type OnboardingStage =
  /** Still filling in the profile. */
  | "building"
  /** Admin asked for changes; the photographer has to resubmit. */
  | "revisions"
  /** Submitted, waiting for a human. */
  | "in_review"
  /** Approved and live; Stripe still outstanding. */
  | "awaiting_stripe"
  /** Approved, live and payable. Nothing left to do. */
  | "live"
  /** Was approved, never connected payouts, now hidden from the public site. */
  | "hidden_no_stripe";

export function isPayoutConnected(p: {
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
}): boolean {
  return Boolean(p.stripe_account_id && p.stripe_onboarding_complete);
}

export function onboardingStage(p: StageProfile): OnboardingStage {
  // Checked before is_approved: hiding works by clearing that flag, so the
  // marker is the only thing that distinguishes a hidden photographer from
  // one who was never reviewed.
  if (p.stripe_hidden_at && !p.is_approved) return "hidden_no_stripe";
  if (p.is_approved) return isPayoutConnected(p) ? "live" : "awaiting_stripe";
  if (p.revision_status === "pending") return "revisions";
  if (p.approval_requested_at) return "in_review";
  // A finished checklist is still "building": asking for approval is an
  // explicit action, so the photographer knows their profile went somewhere
  // rather than wondering whether a silent queue picked it up.
  return "building";
}

/** Whole days left before the Stripe deadline; negative once it has passed. */
export function daysUntilStripeDeadline(deadline: string | Date | null): number | null {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

/**
 * The stage-1 checklist, as SQL. Stripe is deliberately absent — it belongs
 * to stage 2. Kept here so the admin queue, the reminder cron and the
 * approval-request endpoint cannot drift apart about what "ready" means.
 */
export function stageOneCompleteSql(pp = "pp", u = "u", minPhotos = 25): string {
  return `${u}.avatar_url IS NOT NULL
    AND ${u}.phone IS NOT NULL
    AND ${pp}.cover_url IS NOT NULL
    AND ${pp}.bio IS NOT NULL AND LENGTH(${pp}.bio) > 10
    AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = ${pp}.id) >= ${minPhotos}
    AND (SELECT COUNT(*) FROM packages WHERE photographer_id = ${pp}.id AND custom_for_user_id IS NULL) >= 1
    AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = ${pp}.id) >= 1`;
}
