import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

// Tier thresholds
const TIERS = [
  { key: "founding", label: "Founding Photographer", limit: 10, planReward: "premium", duration: null, badge: "Founding Photographer" },
  { key: "early50", label: "Early Adopter", limit: 35, planReward: "premium", duration: 180, badge: null }, // 6 months — spots 11-35
  { key: "first100", label: "First 50", limit: 60, planReward: "pro", duration: 90, badge: null }, // 3 months — spots 36-60
] as const;

export async function GET() {
  try {
    const countRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.registration_number > 0 AND pp.is_test = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE"
    );
    const totalPhotographers = parseInt(countRow?.count || "0");

    // Determine current tier
    let currentTier = null;
    let spotsRemaining = 0;
    let tierIndex = -1;

    for (let i = 0; i < TIERS.length; i++) {
      if (totalPhotographers < TIERS[i].limit) {
        currentTier = TIERS[i];
        spotsRemaining = TIERS[i].limit - totalPhotographers;
        tierIndex = i;
        break;
      }
    }

    // All tiers filled
    if (!currentTier) {
      return NextResponse.json({
        totalPhotographers,
        currentTier: null,
        spotsRemaining: 0,
        allTiersFilled: true,
        tiers: TIERS.map((t) => ({ ...t, filled: true, spotsRemaining: 0 })),
      });
    }

    return NextResponse.json({
      totalPhotographers,
      currentTier: {
        key: currentTier.key,
        label: currentTier.label,
        planReward: currentTier.planReward,
        duration: currentTier.duration, // null = forever
        badge: currentTier.badge,
      },
      spotsRemaining,
      allTiersFilled: false,
      tiers: TIERS.map((t, i) => ({
        key: t.key,
        label: t.label,
        limit: t.limit,
        planReward: t.planReward,
        duration: t.duration,
        badge: t.badge,
        filled: i < tierIndex,
        active: i === tierIndex,
        spotsRemaining: i === tierIndex ? spotsRemaining : i < tierIndex ? 0 : t.limit - (i > 0 ? TIERS[i - 1].limit : 0),
      })),
    });
  } catch (error) {
    console.error("[early-bird] error:", error);
    return NextResponse.json({ error: "Failed to fetch tier info" }, { status: 500 });
  }
}
