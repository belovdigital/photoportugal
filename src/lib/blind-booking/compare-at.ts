/**
 * Pre-offer all-in totals, shown struck through next to the summer-offer price
 * so the saving is visible.
 *
 * Lives apart from `./pricing` on purpose: the heroes that render this figure
 * are client components, and `pricing.ts` reaches `@/lib/db` — importing it
 * from the browser drags `pg` into the client bundle and fails the build.
 * `pricing.ts` re-exports this so server callers keep their single import.
 */
export const BLIND_COMPARE_AT_EUR: Record<number, number> = {
  // €5-rounded like every other client price since 2026-08-09 (was 344).
  60: 345,
  120: 575,
  180: 805,
};
