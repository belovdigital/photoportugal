import { queryOne } from "@/lib/db";

/** Result of the photographer-can-buy gate.
 *  ok=true  → caller may proceed and use `profile`.
 *  ok=false → caller must immediately respond with `{ error, status }`. */
export type PurchaseGateResult =
  | { ok: true; profile: { id: string; is_approved: boolean; is_banned: boolean; stripe_account_id: string | null } }
  | { ok: false; status: number; error: string };

/**
 * Gate for any photographer-side paid action (Pro/Premium subscription,
 * Verified badge, Featured slot). Photographers can only buy these once
 * an admin has approved them AND their account isn't banned — buying
 * before that would give them a paid feature on a profile that's still
 * private/unfinished, which both confuses the photographer and pollutes
 * the marketplace if Stripe later refuses a refund.
 *
 * Centralised so the rule lives in one place — every endpoint calls this
 * before touching Stripe.
 */
export async function ensurePhotographerCanPurchase(
  userId: string | undefined | null,
): Promise<PurchaseGateResult> {
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };

  const row = await queryOne<{
    id: string;
    is_approved: boolean;
    stripe_account_id: string | null;
    is_banned: boolean;
  }>(
    `SELECT pp.id,
            COALESCE(pp.is_approved, FALSE) AS is_approved,
            pp.stripe_account_id,
            COALESCE(u.is_banned, FALSE) AS is_banned
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.user_id = $1`,
    [userId],
  );

  if (!row) return { ok: false, status: 400, error: "Not a photographer" };
  if (row.is_banned) return { ok: false, status: 403, error: "Account suspended" };
  if (!row.is_approved) {
    return {
      ok: false,
      status: 403,
      error: "Your profile is still in review. You'll be able to purchase paid plans, Verified or Featured once an admin approves your account.",
    };
  }

  return {
    ok: true,
    profile: {
      id: row.id,
      is_approved: row.is_approved,
      is_banned: row.is_banned,
      stripe_account_id: row.stripe_account_id,
    },
  };
}
