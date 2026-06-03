import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { GiftCardToggle } from "@/components/photographers/GiftCardToggle";
import { GIFT_CARD_TIERS } from "@/lib/gift-card";

export const dynamic = "force-dynamic";

export default async function PhotographerGiftCardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const profile = await queryOne<{ id: string; accepts_gift_cards: boolean }>(
    `SELECT id, COALESCE(accepts_gift_cards, TRUE) as accepts_gift_cards
       FROM photographer_profiles WHERE user_id = $1`,
    [userId]
  );
  if (!profile) redirect("/dashboard");

  // Pull stats: total redemptions, payouts received, by tier.
  // Counts gift-card-redeemed bookings (gift_card_id IS NOT NULL).
  const stats = await queryOne<{
    total_redemptions: string;
    total_paid_out: string;
    pending_count: string;
    confirmed_count: string;
    completed_count: string;
  }>(
    `SELECT
       COUNT(*)::text as total_redemptions,
       COALESCE(SUM(b.payout_amount) FILTER (WHERE b.payout_transferred = TRUE), 0)::text as total_paid_out,
       COUNT(*) FILTER (WHERE b.status = 'pending')::text as pending_count,
       COUNT(*) FILTER (WHERE b.status = 'confirmed')::text as confirmed_count,
       COUNT(*) FILTER (WHERE b.status IN ('completed','delivered'))::text as completed_count
     FROM bookings b
     WHERE b.photographer_id = $1 AND b.gift_card_id IS NOT NULL`,
    [profile.id]
  );

  // Recent gift-card bookings (5 latest)
  const recent = await query<{
    id: string;
    tier: string;
    status: string;
    payout_amount: number;
    shoot_date: string | null;
    created_at: string;
    client_name: string;
  }>(
    `SELECT b.id, gc.tier::text as tier, b.status, b.payout_amount,
            b.shoot_date::text, b.created_at::text,
            cu.name as client_name
       FROM bookings b
       JOIN gift_cards gc ON gc.id = b.gift_card_id
       JOIN users cu ON cu.id = b.client_id
      WHERE b.photographer_id = $1
      ORDER BY b.created_at DESC LIMIT 10`,
    [profile.id]
  );

  const totalRedemptions = Number(stats?.total_redemptions || 0);
  const totalPaidOut = Number(stats?.total_paid_out || 0);
  const pendingCount = Number(stats?.pending_count || 0);
  const completedCount = Number(stats?.completed_count || 0);

  const hasRedemptions = totalRedemptions > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">🎁 Gift cards</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pre-paid sessions from gift card buyers. Flat payout per tier — no plan commission.
      </p>

      {/* Toggle */}
      <div className="mt-6">
        <GiftCardToggle initial={profile.accepts_gift_cards} />
      </div>

      {/* Stats — only render once there's something to show */}
      {hasRedemptions && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-warm-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Redemptions</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalRedemptions}</p>
          </div>
          <div className="rounded-xl border border-warm-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Paid out</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">€{Math.round(totalPaidOut)}</p>
          </div>
          <div className="rounded-xl border border-warm-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Awaiting</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-warm-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Completed</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{completedCount}</p>
          </div>
        </div>
      )}

      {/* Recent — render with empty state inline */}
      <div className="mt-6 rounded-xl border border-warm-200 bg-white overflow-hidden">
        <h2 className="px-5 py-4 font-semibold text-gray-900 border-b border-warm-100">
          {hasRedemptions ? "Recent gift card bookings" : "Your gift card bookings"}
        </h2>
        {recent.length > 0 ? (
          <ul className="divide-y divide-warm-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.client_name}</p>
                  <p className="text-xs text-gray-500">
                    {r.tier === "express" ? "Express" : "Full"}
                    {" · "}
                    {r.shoot_date ? new Date(r.shoot_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "flexible"}
                    {" · "}{r.status}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900">€{Math.round(Number(r.payout_amount))}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-3xl mb-2">🎁</p>
            <p className="text-sm font-medium text-gray-900">No gift card bookings yet</p>
            <p className="mt-1 text-xs text-gray-500">
              You&rsquo;ll receive <strong>€{GIFT_CARD_TIERS.express.photographerPayout}</strong> for Express, <strong>€{GIFT_CARD_TIERS.full.photographerPayout}</strong> for Full bookings when recipients redeem with you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
