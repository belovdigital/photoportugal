"use client";

import { useState, useMemo } from "react";

export interface AdminGiftCard {
  id: string;
  code: string;
  tier: "express" | "full";
  amount: number;
  photographer_payout: number;
  status: "purchased" | "sent" | "claimed" | "redeemed" | "expired" | "refunded";
  buyer_name: string;
  buyer_email: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string | null;
  recipient_user_id: string | null;
  personal_message: string | null;
  booking_id: string | null;
  photographer_name: string | null;
  created_at: string;
  sent_at: string | null;
  claimed_at: string | null;
  redeemed_at: string | null;
  expires_at: string;
}

const STATUS_STYLES: Record<AdminGiftCard["status"], string> = {
  purchased: "bg-gray-100 text-gray-700",
  sent: "bg-amber-100 text-amber-800",
  claimed: "bg-blue-100 text-blue-800",
  redeemed: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-50 text-red-600",
  refunded: "bg-purple-100 text-purple-800",
};

export function AdminGiftCardsTab({ cards }: { cards: AdminGiftCard[] }) {
  const [statusFilter, setStatusFilter] = useState<"all" | AdminGiftCard["status"]>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = cards;
    if (statusFilter !== "all") rows = rows.filter((c) => c.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) =>
        c.code.toLowerCase().includes(q) ||
        c.buyer_name.toLowerCase().includes(q) ||
        c.buyer_email.toLowerCase().includes(q) ||
        c.recipient_name.toLowerCase().includes(q) ||
        c.recipient_email.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [cards, statusFilter, search]);

  const summary = useMemo(() => {
    const t = { count: cards.length, gross: 0, paidOutSent: 0, redeemedCount: 0, sentCount: 0, claimedCount: 0 };
    for (const c of cards) {
      if (c.status !== "refunded" && c.status !== "expired") t.gross += Number(c.amount);
      if (c.status === "sent") t.sentCount++;
      if (c.status === "claimed") t.claimedCount++;
      if (c.status === "redeemed") { t.redeemedCount++; t.paidOutSent += Number(c.photographer_payout); }
    }
    return t;
  }, [cards]);

  async function resend(cardId: string) {
    setBusy(cardId);
    setToast(null);
    try {
      const res = await fetch("/api/admin/gift-card/fire-fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_card_id: cardId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setToast("Email re-sent (or already in 'sent' state — idempotent).");
      } else {
        setToast(data.error || "Failed");
      }
    } catch {
      setToast("Network error");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function manualExpire(cardId: string) {
    if (!confirm("Mark this card as expired? It can no longer be redeemed.")) return;
    setBusy(cardId);
    try {
      const res = await fetch("/api/admin/gift-card/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_card_id: cardId }),
      });
      const data = await res.json();
      setToast(res.ok && data.ok ? "Marked expired. Page will refresh." : data.error || "Failed");
      if (res.ok) setTimeout(() => location.reload(), 1500);
    } catch {
      setToast("Network error");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function refund(cardId: string) {
    if (!confirm("Refund this card? Marks status='refunded' but Stripe refund must be done manually in Stripe dashboard.")) return;
    setBusy(cardId);
    try {
      const res = await fetch("/api/admin/gift-card/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_card_id: cardId }),
      });
      const data = await res.json();
      setToast(res.ok && data.ok ? "Marked refunded. Page will refresh." : data.error || "Failed");
      if (res.ok) setTimeout(() => location.reload(), 1500);
    } catch {
      setToast("Network error");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryStat label="Total cards" value={summary.count.toString()} />
        <SummaryStat label="Gross sales" value={`€${Math.round(summary.gross)}`} />
        <SummaryStat label="Sent (awaiting claim)" value={summary.sentCount.toString()} />
        <SummaryStat label="Claimed (not redeemed)" value={summary.claimedCount.toString()} />
        <SummaryStat label="Redeemed (paid out)" value={`${summary.redeemedCount} · €${Math.round(summary.paidOutSent)}`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AdminGiftCard["status"] | "all")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="purchased">Purchased (Stripe pending)</option>
          <option value="sent">Sent (awaiting claim)</option>
          <option value="claimed">Claimed (not redeemed)</option>
          <option value="redeemed">Redeemed (booking made)</option>
          <option value="expired">Expired</option>
          <option value="refunded">Refunded</option>
        </select>
        <input
          type="search"
          placeholder="Search code / name / email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-900">
          {toast}
        </div>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-10 text-center text-sm text-gray-500">
          No gift cards match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-warm-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="rounded bg-warm-50 px-2 py-0.5 text-xs font-mono">{c.code}</code>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                    <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                      {c.tier === "express" ? "Express €349" : "Full €520"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-400">From:</span>{" "}
                      <span className="font-medium text-gray-900">{c.buyer_name}</span>{" "}
                      <a href={`mailto:${c.buyer_email}`} className="text-primary-600 hover:underline">&lt;{c.buyer_email}&gt;</a>
                    </div>
                    <div>
                      <span className="text-gray-400">To:</span>{" "}
                      <span className="font-medium text-gray-900">{c.recipient_name}</span>{" "}
                      <a href={`mailto:${c.recipient_email}`} className="text-primary-600 hover:underline">&lt;{c.recipient_email}&gt;</a>
                    </div>
                    {c.recipient_phone && (
                      <div>
                        <span className="text-gray-400">Phone:</span>{" "}
                        <a href={`https://wa.me/${c.recipient_phone.replace(/\D/g, "")}`} className="text-primary-600 hover:underline">{c.recipient_phone}</a>
                      </div>
                    )}
                    {c.photographer_name && (
                      <div>
                        <span className="text-gray-400">Photographer:</span>{" "}
                        <span className="font-medium text-gray-900">{c.photographer_name}</span>
                      </div>
                    )}
                  </div>
                  {c.personal_message && (
                    <p className="mt-2 text-xs italic text-gray-600">&ldquo;{c.personal_message}&rdquo;</p>
                  )}
                  <p className="mt-2 text-[11px] text-gray-400">
                    Created {new Date(c.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {c.sent_at && ` · Sent ${new Date(c.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    {c.claimed_at && ` · Claimed ${new Date(c.claimed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    {c.redeemed_at && ` · Redeemed ${new Date(c.redeemed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    {" · Expires "}{new Date(c.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(c.status === "purchased" || c.status === "sent") && (
                    <button
                      onClick={() => resend(c.id)}
                      disabled={busy === c.id}
                      className="rounded-md border border-primary-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
                    >
                      Re-send email
                    </button>
                  )}
                  {(c.status === "sent" || c.status === "claimed") && (
                    <button
                      onClick={() => manualExpire(c.id)}
                      disabled={busy === c.id}
                      className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Force expire
                    </button>
                  )}
                  {c.status !== "refunded" && c.status !== "expired" && (
                    <button
                      onClick={() => refund(c.id)}
                      disabled={busy === c.id}
                      className="rounded-md border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                    >
                      Mark refunded
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-warm-200 bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
