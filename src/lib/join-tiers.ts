import { queryOne } from "@/lib/db";

// Cohort state of the First 100 program on THIS market — one source of truth
// for the /join page and the /for-photographers hero, so the button that opens
// the join page always names the tier the join page will show as open.
//
// Thresholds: founding 0..9, early bird 10..34 (25 spots, closed in practice —
// kept as a fallback window), first 100 35..99. The tier KEY "early50" holds
// 25 spots, not 50 — the name is a fossil, see docs/DOMAIN.md §7.
export const TIER_KEYS = ["founding", "early50", "first100"] as const;
export type JoinTierKey = (typeof TIER_KEYS)[number];
export const TIER_THRESHOLDS = [10, 35, 100] as const;

// Same roster the /join counter shows: approved, real (registration_number
// assigned), not test, not banned. Every market's DB is its own, so this is
// per-market by construction. On a DB hiccup returns 0 — the page then renders
// the founding tier rather than erroring, matching /join's behaviour.
export async function approvedPhotographerCount(): Promise<number> {
  try {
    const row = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.registration_number > 0 AND pp.is_test = FALSE AND pp.is_approved = TRUE AND COALESCE(u.is_banned, FALSE) = FALSE"
    );
    return parseInt(row?.count || "0");
  } catch {
    return 0;
  }
}

// null = all 100 spots claimed, the program is over.
export function activeJoinTier(total: number): JoinTierKey | null {
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (total < TIER_THRESHOLDS[i]) return TIER_KEYS[i];
  }
  return null;
}
