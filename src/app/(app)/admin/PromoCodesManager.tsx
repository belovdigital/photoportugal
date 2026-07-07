"use client";

import { useState, useEffect, useCallback } from "react";
import DatePicker from "@/components/ui/DatePicker";
import { todayLocalISO } from "@/lib/date-utils";

interface PromoCode {
  id: string;
  code: string;
  coupon_id: string | null;
  coupon_name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  times_redeemed: number;
  max_redemptions: number | null;
  active: boolean;
  expires_at: number | null;
  source: "video_review" | "regular_review" | "admin_panel" | "manual_stripe";
  notes: string | null;
  created_by_email: string | null;
}

export function PromoCodesManager() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [durationInMonths, setDurationInMonths] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promo-codes");
      if (res.ok) {
        const data = await res.json();
        setCodes(data);
      }
    } catch {
      console.error("Failed to fetch promo codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setPercentOff("");
    setAmountOff("");
    setDuration("once");
    setDurationInMonths("");
    setMaxRedemptions("");
    setExpiresAt("");
    setError("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        code: code.toUpperCase(),
        duration,
      };

      if (discountType === "percent") {
        body.percent_off = parseFloat(percentOff);
      } else {
        body.amount_off = parseFloat(amountOff);
        body.currency = "eur";
      }

      if (duration === "repeating" && durationInMonths) {
        body.duration_in_months = parseInt(durationInMonths);
      }

      if (maxRedemptions) {
        body.max_redemptions = parseInt(maxRedemptions);
      }

      if (expiresAt) {
        body.expires_at = expiresAt;
      }

      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create promo code");
      }

      resetForm();
      setShowForm(false);
      await fetchCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promo code");
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this promo code? It stays in Stripe (so historical orders keep working) but can't be used for new purchases.")) return;
    try {
      const res = await fetch(`/api/admin/promo-codes?id=${id}&mode=deactivate`, { method: "DELETE" });
      if (res.ok) await fetchCodes();
    } catch {
      console.error("Failed to deactivate promo code");
    }
  };

  const handleDelete = async (pc: PromoCode) => {
    const warning = pc.times_redeemed > 0
      ? "This code has been redeemed and can't be fully deleted from Stripe — it'll be deactivated instead. Continue?"
      : "Permanently delete this unused code from Stripe? This cannot be undone.";
    if (!confirm(warning)) return;
    try {
      const qs = new URLSearchParams({ id: pc.id, mode: "delete" });
      if (pc.coupon_id) qs.set("coupon", pc.coupon_id);
      const res = await fetch(`/api/admin/promo-codes?${qs.toString()}`, { method: "DELETE" });
      if (res.ok) await fetchCodes();
    } catch {
      console.error("Failed to delete promo code");
    }
  };

  const handleNotesSave = async (code: string, notes: string) => {
    try {
      await fetch("/api/admin/promo-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, notes }),
      });
      await fetchCodes();
    } catch {
      console.error("Failed to save notes");
    }
  };

  const formatDiscount = (pc: PromoCode) => {
    if (pc.percent_off) return `${pc.percent_off}% off`;
    if (pc.amount_off) return `${pc.amount_off.toFixed(2)} ${(pc.currency || "EUR").toUpperCase()} off`;
    return "—";
  };

  const formatDuration = (pc: PromoCode) => {
    if (pc.duration === "once") return "Once";
    if (pc.duration === "forever") return "Forever";
    if (pc.duration === "repeating") return `${pc.duration_in_months} months`;
    return pc.duration;
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Promo Codes</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Stripe is the source of truth. Codes created here also sync back to Stripe; codes created in the Stripe Dashboard show up too.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCodes()}
            disabled={loading}
            className="rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-warm-50 disabled:opacity-50"
            title="Re-fetch latest state from Stripe"
          >
            {loading ? "Syncing…" : "↻ Sync"}
          </button>
          <button
            onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            {showForm ? "Cancel" : "Create Promo Code"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER25"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discount type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "percent"}
                  onChange={() => setDiscountType("percent")}
                  className="text-primary-600"
                />
                Percentage
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "fixed"}
                  onChange={() => setDiscountType("fixed")}
                  className="text-primary-600"
                />
                Fixed amount
              </label>
            </div>
          </div>

          {discountType === "percent" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percent off</label>
              <input
                type="number"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                placeholder="e.g. 25"
                min="1"
                max="100"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount off (EUR)</label>
              <input
                type="number"
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
                placeholder="e.g. 10.00"
                min="0.01"
                step="0.01"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as "once" | "repeating" | "forever")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="once">Once</option>
              <option value="repeating">Repeating</option>
              <option value="forever">Forever</option>
            </select>
          </div>

          {duration === "repeating" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration in months</label>
              <input
                type="number"
                value={durationInMonths}
                onChange={(e) => setDurationInMonths(e.target.value)}
                placeholder="e.g. 3"
                min="1"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max redemptions (optional)</label>
            <input
              type="number"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Leave empty for unlimited"
              min="1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <DatePicker
            label="Expiry date (optional)"
            value={expiresAt}
            onChange={setExpiresAt}
            min={todayLocalISO()}
            placeholder="No expiry"
          />

          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create Promo Code"}
          </button>
        </form>
      )}

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-warm-200 bg-white">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400">Loading promo codes...</div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Discount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Used / Max</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expires</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Notes</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {codes.map((pc) => (
                <tr key={pc.id} className={pc.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{pc.code}</td>
                  <td className="px-4 py-3">
                    {pc.source === "video_review" && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-700">🎥 Video review</span>
                    )}
                    {pc.source === "regular_review" && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">⭐ Review</span>
                    )}
                    {pc.source === "admin_panel" && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700" title={pc.created_by_email || ""}>👤 Admin</span>
                    )}
                    {pc.source === "manual_stripe" && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">⚙ Stripe</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDiscount(pc)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDuration(pc)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {pc.times_redeemed}{pc.max_redemptions ? ` / ${pc.max_redemptions}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {pc.expires_at
                      ? new Date(pc.expires_at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <NotesCell code={pc.code} initial={pc.notes || ""} onSave={handleNotesSave} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      pc.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {pc.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {pc.active && (
                        <button
                          onClick={() => handleDeactivate(pc.id)}
                          className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
                          title="Disable for new purchases; keep in Stripe for historical orders"
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(pc)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                        title={pc.times_redeemed > 0 ? "Code has redemptions — Stripe will deactivate instead of delete" : "Permanently remove from Stripe"}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No promo codes yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// Inline editable notes cell. Shows the current note as text; click to
// edit; blur or Enter to save. Empty input clears the note.
function NotesCell({ code, initial, onSave }: { code: string; initial: string; onSave: (code: string, notes: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  // Re-sync when the parent refetches.
  useEffect(() => { setValue(initial); }, [initial]);

  async function commit() {
    setEditing(false);
    if (value.trim() === initial.trim()) return;
    await onSave(code, value.trim());
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 500))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setValue(initial); setEditing(false); }
        }}
        placeholder="Note…"
        className="w-full rounded border border-primary-300 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left text-xs text-gray-600 hover:text-gray-900 max-w-[200px] truncate"
      title={value || "Click to add a note"}
    >
      {value || <span className="text-gray-400 italic">add note…</span>}
    </button>
  );
}
