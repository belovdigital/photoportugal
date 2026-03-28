"use client";

import { useState, useEffect } from "react";

interface Dispute {
  id: string;
  booking_id: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  resolution_note: string | null;
  refund_amount: number | null;
  created_at: string;
  resolved_at: string | null;
  client_name: string;
  photographer_name: string;
  shoot_date: string;
  package_name: string | null;
  total_price: number | null;
}

const REASON_LABELS: Record<string, string> = {
  fewer_photos: "Fewer photos than promised",
  wrong_location: "Wrong location/subjects",
  technical_issues: "Technical issues",
  no_show: "Photographer no-show",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  under_review: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  rejected: "bg-gray-100 text-gray-600",
};

export function DisputesManager() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/disputes")
      .then((r) => r.json())
      .then((data) => { setDisputes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleResolve() {
    if (!selected || !resolution) return;
    setSaving(true);

    const body: Record<string, unknown> = {
      status: resolution === "rejected" ? "rejected" : "resolved",
      resolution,
      resolution_note: resolutionNote || null,
    };
    if (resolution === "partial_refund" && refundAmount) {
      body.refund_amount = parseFloat(refundAmount);
    }
    if (resolution === "full_refund" && selected.total_price) {
      body.refund_amount = selected.total_price;
    }

    const res = await fetch(`/api/disputes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === selected.id
            ? { ...d, status: body.status as string, resolution, resolution_note: resolutionNote, refund_amount: (body.refund_amount as number) || null, resolved_at: new Date().toISOString() }
            : d
        )
      );
      setSelected(null);
      setResolution("");
      setResolutionNote("");
      setRefundAmount("");
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading disputes...</p>;

  return (
    <div>
      {disputes.length === 0 ? (
        <p className="text-sm text-gray-400">No disputes yet.</p>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-xl border border-warm-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[d.status] || "bg-gray-100 text-gray-600"}`}>
                      {d.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {(d.status === "open" || d.status === "under_review") && (
                      <SlaTimer createdAt={d.created_at} />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {d.client_name} vs {d.photographer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {REASON_LABELS[d.reason] || d.reason}
                    {d.total_price ? ` — €${Math.round(Number(d.total_price))}` : ""}
                    {d.shoot_date ? ` — ${new Date(d.shoot_date).toLocaleDateString()}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">{d.description}</p>

                  {d.resolution && (
                    <div className="mt-3 rounded-lg bg-warm-50 p-3 text-xs">
                      <p className="font-semibold text-gray-700">Resolution: {d.resolution.replace("_", " ")}</p>
                      {d.refund_amount ? <p className="text-gray-500">Refund: €{d.refund_amount}</p> : null}
                      {d.resolution_note && <p className="mt-1 text-gray-500">{d.resolution_note}</p>}
                    </div>
                  )}
                </div>

                {(d.status === "open" || d.status === "under_review") && (
                  <button
                    onClick={() => { setSelected(d); setResolution(""); setResolutionNote(""); setRefundAmount(""); }}
                    className="shrink-0 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-100"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Resolve Dispute</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selected.client_name} vs {selected.photographer_name}
            </p>
            <p className="mt-1 text-xs text-gray-400">{selected.description}</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
                >
                  <option value="">Select...</option>
                  <option value="reshoot">Reshoot (photographer redoes session)</option>
                  <option value="partial_refund">Partial refund</option>
                  <option value="full_refund">Full refund</option>
                  <option value="rejected">Reject dispute</option>
                </select>
              </div>

              {resolution === "partial_refund" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Refund amount (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={selected.total_price ? `Max: €${Math.round(Number(selected.total_price))}` : ""}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Note (visible to both parties)</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  placeholder="Explain the decision..."
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleResolve}
                  disabled={!resolution || saving}
                  className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Confirm Resolution"}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlaTimer({ createdAt }: { createdAt: string }) {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  const label = days > 0 ? `${days}d ${remainingHours}h open` : `${hours}h open`;
  const isUrgent = hours >= 48;
  const isWarning = hours >= 24 && hours < 48;

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      isUrgent ? "bg-red-100 text-red-700" :
      isWarning ? "bg-orange-100 text-orange-700" :
      "bg-gray-100 text-gray-500"
    }`}>
      {label}
    </span>
  );
}
