"use client";

import { useMemo, useState } from "react";

export interface AdminMakeAlbumOrder {
  id: string;
  makealbum_order_id: string;
  makealbum_album_id: string;
  title: string | null;
  page_count: number | null;
  amount_cents: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  webhook_url: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "failed";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  shipping_address: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    state?: string;
    phone?: string;
    email?: string;
  } | null;
  webhook_delivered_at: string | null;
  webhook_attempts: number;
  webhook_last_error: string | null;
  created_at: string;
  paid_at: string | null;
}

const STATUS_STYLES: Record<AdminMakeAlbumOrder["status"], string> = {
  pending: "bg-gray-100 text-gray-700",
  paid: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-50 text-red-600",
  cancelled: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
};

function fmtMoney(cents: number, currency: string): string {
  const sym = currency.toUpperCase() === "EUR" ? "€" : currency.toUpperCase() + " ";
  return `${sym}${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function AdminMakeAlbumTab({ orders }: { orders: AdminMakeAlbumOrder[] }) {
  const [statusFilter, setStatusFilter] = useState<"all" | AdminMakeAlbumOrder["status"]>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let rows = orders;
    if (statusFilter !== "all") rows = rows.filter((o) => o.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.makealbum_order_id.toLowerCase().includes(q) ||
        o.makealbum_album_id.toLowerCase().includes(q) ||
        (o.title || "").toLowerCase().includes(q) ||
        (o.customer_email || "").toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [orders, statusFilter, search]);

  const summary = useMemo(() => {
    const t = { total: orders.length, paidCount: 0, paidGross: 0, pendingCount: 0, undelivered: 0 };
    for (const o of orders) {
      if (o.status === "paid") {
        t.paidCount++;
        t.paidGross += o.amount_cents;
        if (!o.webhook_delivered_at) t.undelivered++;
      }
      if (o.status === "pending") t.pendingCount++;
    }
    return t;
  }, [orders]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function redriveWebhook(id: string) {
    if (!confirm("Re-fire the post-payment webhook to MakeAlbum for this order?")) return;
    setBusy(id);
    setToast(null);
    try {
      const res = await fetch("/api/admin/makealbum/redrive-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkout_id: id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setToast("Webhook re-delivered. Page will refresh.");
        setTimeout(() => location.reload(), 1500);
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat label="Total orders" value={summary.total.toString()} />
        <SummaryStat label="Paid" value={`${summary.paidCount} · ${fmtMoney(summary.paidGross, "EUR")}`} />
        <SummaryStat label="Pending checkout" value={summary.pendingCount.toString()} />
        <SummaryStat label="Webhook not delivered" value={summary.undelivered.toString()} highlight={summary.undelivered > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AdminMakeAlbumOrder["status"] | "all")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending (Stripe not yet paid)</option>
          <option value="paid">Paid</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
        <input
          type="search"
          placeholder="Search order / album / customer / title"
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-10 text-center text-sm text-gray-500">
          {orders.length === 0
            ? "No MakeAlbum orders yet — the integration is live and waiting for the first checkout request."
            : "No orders match your filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const isOpen = expanded.has(o.id);
            const webhookOK = !!o.webhook_delivered_at;
            const webhookStuck = o.status === "paid" && !webhookOK;
            return (
              <div key={o.id} className="rounded-xl border border-warm-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="rounded bg-warm-50 px-2 py-0.5 text-xs font-mono">{o.id}</code>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.status]}`}>
                        {o.status}
                      </span>
                      <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                        {fmtMoney(o.amount_cents, o.currency)}
                      </span>
                      {o.page_count && (
                        <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {o.page_count} pages
                        </span>
                      )}
                      {webhookStuck && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          webhook stuck
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {o.title && (
                        <div>
                          <span className="text-gray-400">Album:</span>{" "}
                          <span className="font-medium text-gray-900">{o.title}</span>
                        </div>
                      )}
                      {(o.customer_name || o.customer_email) && (
                        <div>
                          <span className="text-gray-400">Customer:</span>{" "}
                          {o.customer_name && <span className="font-medium text-gray-900">{o.customer_name}</span>}
                          {o.customer_email && (
                            <>
                              {o.customer_name && " "}
                              <a href={`mailto:${o.customer_email}`} className="text-primary-600 hover:underline">
                                &lt;{o.customer_email}&gt;
                              </a>
                            </>
                          )}
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">MakeAlbum order:</span>{" "}
                        <code className="text-xs font-mono">{o.makealbum_order_id}</code>
                      </div>
                      <div>
                        <span className="text-gray-400">Album ID:</span>{" "}
                        <code className="text-xs font-mono">{o.makealbum_album_id}</code>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-gray-400">
                      Created {fmtDate(o.created_at)}
                      {o.paid_at && ` · Paid ${fmtDate(o.paid_at)}`}
                      {o.webhook_delivered_at && ` · Webhook delivered ${fmtDate(o.webhook_delivered_at)}`}
                      {o.webhook_attempts > 0 && !o.webhook_delivered_at && ` · ${o.webhook_attempts} webhook attempts failed`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleExpanded(o.id)}
                      className="rounded-md border border-warm-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-warm-50"
                    >
                      {isOpen ? "Hide details" : "Details"}
                    </button>
                    {webhookStuck && (
                      <button
                        onClick={() => redriveWebhook(o.id)}
                        disabled={busy === o.id}
                        className="rounded-md border border-primary-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
                      >
                        {busy === o.id ? "Re-firing…" : "Re-fire webhook"}
                      </button>
                    )}
                    {o.stripe_session_id && (
                      <a
                        href={`https://dashboard.stripe.com/${o.stripe_session_id.startsWith("cs_test_") ? "test/" : ""}payments/${o.stripe_payment_intent_id || o.stripe_session_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-warm-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-warm-50"
                      >
                        Stripe →
                      </a>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-warm-50 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Shipping address</p>
                      {o.shipping_address && (o.shipping_address.line1 || o.shipping_address.city) ? (
                        <div className="space-y-0.5 text-gray-700">
                          {o.shipping_address.name && <div>{o.shipping_address.name}</div>}
                          {o.shipping_address.line1 && <div>{o.shipping_address.line1}</div>}
                          {o.shipping_address.line2 && <div>{o.shipping_address.line2}</div>}
                          {(o.shipping_address.city || o.shipping_address.postalCode) && (
                            <div>{[o.shipping_address.postalCode, o.shipping_address.city].filter(Boolean).join(" ")}</div>
                          )}
                          {o.shipping_address.state && <div>{o.shipping_address.state}</div>}
                          {o.shipping_address.countryCode && <div>{o.shipping_address.countryCode}</div>}
                          {o.shipping_address.phone && (
                            <div className="pt-1">
                              <span className="text-gray-400">Phone:</span> {o.shipping_address.phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 italic">Not yet collected (still pending payment)</p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Integration</p>
                      <div className="space-y-0.5 text-gray-700 break-all">
                        <div>
                          <span className="text-gray-400">Webhook URL:</span> <code className="text-[11px] font-mono">{o.webhook_url}</code>
                        </div>
                        {o.stripe_session_id && (
                          <div>
                            <span className="text-gray-400">Stripe session:</span> <code className="text-[11px] font-mono">{o.stripe_session_id}</code>
                          </div>
                        )}
                        {o.stripe_payment_intent_id && (
                          <div>
                            <span className="text-gray-400">Payment intent:</span> <code className="text-[11px] font-mono">{o.stripe_payment_intent_id}</code>
                          </div>
                        )}
                        {o.webhook_last_error && (
                          <div className="rounded bg-red-50 border border-red-200 p-2 mt-2 text-red-700">
                            <p className="font-semibold mb-0.5">Last webhook error:</p>
                            <p className="font-mono text-[11px] break-all">{o.webhook_last_error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-red-300 bg-red-50" : "border-warm-200 bg-white"}`}>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className={`mt-1 text-lg font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
