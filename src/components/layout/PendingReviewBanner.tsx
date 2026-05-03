import { query } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

// Site-wide nudge for clients sitting on completed bookings without a review.
// Surfaces the oldest unreviewed delivery so they can knock it out in one click —
// the link deep-targets ReviewForm via the ?review= URL param. Renders nothing
// when there's nothing pending; renders nothing for photographers.
export async function PendingReviewBanner({ userId, role, locale }: { userId: string; role: string; locale: string }) {
  if (role !== "client") return null;

  let pending: { id: string; photographer_name: string }[] = [];
  try {
    pending = await query<{ id: string; photographer_name: string }>(
      `SELECT b.id, pu.name as photographer_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.client_id = $1
         AND b.delivery_accepted = TRUE
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
       ORDER BY b.delivery_accepted_at DESC
       LIMIT 5`,
      [userId]
    );
  } catch {
    return null;
  }

  if (pending.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "pendingReviewBanner" });
  const first = pending[0];
  const firstName = (first.photographer_name || "").split(" ")[0];
  const more = pending.length > 1 ? pending.length - 1 : 0;

  return (
    <Link
      href={`/dashboard/bookings?review=${encodeURIComponent(first.id)}`}
      className="block bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 transition hover:from-yellow-500 hover:to-amber-600"
    >
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">⭐</span>
          <p className="text-sm font-semibold truncate">
            {t("text", { name: firstName })}
            {more > 0 && <span className="ml-2 rounded-full bg-gray-900/15 px-2 py-0.5 text-xs">+{more}</span>}
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white">
          {t("cta")}
        </span>
      </div>
    </Link>
  );
}
