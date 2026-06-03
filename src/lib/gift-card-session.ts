import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { GIFT_CARD_TIERS, isGiftCardTier, type GiftCardTier } from "@/lib/gift-card";

export type ActiveGiftCard = {
  id: string;
  tier: GiftCardTier;
  buyerName: string;
  expiresAt: string;
  meta: typeof GIFT_CARD_TIERS[GiftCardTier];
};

/**
 * Reads the current viewer's active gift card (if any) from the session
 * user + DB. Returns null when the viewer is signed out, has no card
 * attached, or the card is in a non-redeemable state.
 *
 * Server-only — pages/layouts call this to flip into gift-mode rendering.
 */
export async function getActiveGiftCard(): Promise<ActiveGiftCard | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  const user = await queryOne<{ active_gift_card_id: string | null }>(
    "SELECT active_gift_card_id FROM users WHERE id = $1",
    [userId]
  );
  if (!user?.active_gift_card_id) return null;

  const card = await queryOne<{
    id: string;
    tier: string;
    status: string;
    buyer_name: string;
    expires_at: string;
  }>(
    "SELECT id, tier, status, buyer_name, expires_at FROM gift_cards WHERE id = $1",
    [user.active_gift_card_id]
  );
  if (!card) return null;
  // Stale flag handling — when the card moved to a terminal state
  // (redeemed/expired/refunded) the user's active_gift_card_id row is
  // outdated. Clear it lazily so future hits short-circuit cheaper.
  // Guarded so we only WRITE on the FIRST read after termination —
  // subsequent reads hit "active_gift_card_id IS NULL" branch above.
  if (card.status === "redeemed" || card.status === "expired" || card.status === "refunded"
      || new Date(card.expires_at) < new Date()) {
    await queryOne(
      "UPDATE users SET active_gift_card_id = NULL WHERE id = $1 AND active_gift_card_id IS NOT NULL RETURNING id",
      [userId]
    ).catch(() => null);
    return null;
  }
  if (!isGiftCardTier(card.tier)) return null;

  return {
    id: card.id,
    tier: card.tier,
    buyerName: card.buyer_name,
    expiresAt: card.expires_at,
    meta: GIFT_CARD_TIERS[card.tier],
  };
}
