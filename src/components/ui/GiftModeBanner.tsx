"use client";

// Sticky banner shown across all gift-mode pages — a constant reminder
// of "you have a gift, pick someone below". Click "Use later" hits
// /api/gift-card/pause to clear the user's active_gift_card_id and
// drops them back into normal browsing. Re-activating later means
// clicking the original magic link from the email again.
export function GiftModeBanner({
  buyerName,
  tierLabel,
  expiresAt,
}: {
  buyerName: string;
  tierLabel: string;
  expiresAt: string;
}) {
  const expiry = new Date(expiresAt).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
  async function pause() {
    await fetch("/api/gift-card/pause", { method: "POST" });
    // Hard reload so server components re-render without gift mode.
    window.location.href = "/dashboard/bookings";
  }
  return (
    <div className="bg-gradient-to-r from-primary-600 to-rose-500 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xl">🎁</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            You have a <span className="underline">{tierLabel}</span> gift session from {buyerName}
          </p>
          <p className="text-xs opacity-90">
            Pick any photographer below to book. Valid until {expiry}.
          </p>
        </div>
        <button
          onClick={pause}
          className="text-xs underline opacity-90 hover:opacity-100"
        >
          Use later
        </button>
      </div>
    </div>
  );
}
