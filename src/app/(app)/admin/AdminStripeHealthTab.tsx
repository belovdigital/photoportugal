"use client";

import { useCallback, useEffect, useState } from "react";
import type { StripeHealthRow } from "@/app/api/admin/stripe-health/route";

// Stripe's raw field paths collapsed into something readable at a glance.
const FIELD_LABELS: [RegExp, string][] = [
  [/^individual\.verification\.proof_of_liveness/, "selfie"],
  [/^individual\.verification\./, "ID document"],
  [/^(individual|representative)\.(first_name|last_name)/, "legal name"],
  [/^(individual|representative)\.dob/, "date of birth"],
  [/^(individual|representative)\.address/, "address"],
  [/^(individual|representative)\.phone/, "phone"],
  [/^(individual|representative)\.email/, "email"],
  [/^(individual|representative)\.id_number/, "tax ID"],
  [/^(owners|directors|company\.owners)/, "business owners"],
  [/^company\./, "company details"],
  [/^tos_acceptance/, "accept ToS"],
  [/^external_account/, "bank account"],
  [/^business_profile\.(url|product_description)/, "website"],
  [/^business_profile\.mcc/, "business category"],
];

function humanFields(fields: string[]): string {
  const out: string[] = [];
  for (const f of fields) {
    const hit = FIELD_LABELS.find(([re]) => re.test(f));
    const label = hit ? hit[1] : f;
    if (!out.includes(label)) out.push(label);
  }
  return out.join(", ");
}

const SEVERITY: Record<StripeHealthRow["severity"], { label: string; cls: string; dot: string }> = {
  blocked: { label: "Blocked", cls: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },
  deadline: { label: "Deadline", cls: "bg-amber-50 text-amber-900 border-amber-200", dot: "bg-amber-500" },
  unfinished: { label: "Unfinished", cls: "bg-gray-50 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  ok: { label: "OK", cls: "bg-green-50 text-green-800 border-green-200", dot: "bg-green-500" },
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function AdminStripeHealthTab() {
  const [rows, setRows] = useState<StripeHealthRow[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOk, setShowOk] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stripe-health${refresh ? "?refresh=1" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setRows(data.rows);
      setFetchedAt(data.fetched_at);
      if (data.error) setError(`Showing last good sweep — refresh failed: ${data.error}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Stripe status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const problems = rows?.filter((r) => r.severity !== "ok") ?? [];
  const okCount = rows?.filter((r) => r.severity === "ok").length ?? 0;
  const visible = showOk ? rows ?? [] : problems;
  const counts = {
    blocked: problems.filter((r) => r.severity === "blocked").length,
    deadline: problems.filter((r) => r.severity === "deadline").length,
    unfinished: problems.filter((r) => r.severity === "unfinished").length,
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Stripe health</h2>
          <p className="mt-1 text-sm text-gray-500">
            Live from the Stripe API — not the cached DB flag.
            {fetchedAt && ` Last checked ${new Date(fetchedAt).toLocaleTimeString()}.`}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Checking Stripe…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["blocked", "deadline", "unfinished"] as const).map((k) => (
              <span key={k} className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY[k].cls}`}>
                {SEVERITY[k].label}: {counts[k]}
              </span>
            ))}
            <button
              onClick={() => setShowOk((v) => !v)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {showOk ? "Hide" : "Show"} healthy ({okCount})
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Every connected account is in good standing.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Photographer</th>
                    <th className="py-2 pr-3 font-semibold">What Stripe wants</th>
                    <th className="py-2 pr-3 font-semibold">Deadline</th>
                    <th className="py-2 pr-3 font-semibold">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const sev = SEVERITY[r.severity];
                    const missing = [...r.past_due, ...r.currently_due];
                    const days = r.deadline ? daysUntil(r.deadline) : null;
                    return (
                      <tr key={r.photographer_id} className="border-b border-gray-100 align-top">
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${sev.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                            {sev.label}
                          </span>
                          {r.is_banned && <div className="mt-1 text-[11px] text-gray-400">banned</div>}
                          {!r.is_approved && !r.is_banned && <div className="mt-1 text-[11px] text-gray-400">not approved</div>}
                        </td>
                        <td className="py-3 pr-3">
                          <a
                            href={`/photographers/${r.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-gray-900 hover:underline"
                          >
                            {r.name}
                          </a>
                          <div className="text-xs text-gray-500">{r.email}</div>
                          {r.stripe_email && r.stripe_email.toLowerCase() !== r.email.toLowerCase() && (
                            <div className="mt-0.5 text-[11px] text-amber-700">
                              Stripe writes to {r.stripe_email}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-gray-700">
                          {r.error ? (
                            <span className="text-red-700">{r.error.slice(0, 120)}</span>
                          ) : missing.length ? (
                            <>
                              {humanFields(missing)}
                              {r.disabled_reason && (
                                <div className="mt-0.5 text-[11px] text-gray-400">{r.disabled_reason}</div>
                              )}
                            </>
                          ) : r.pending_verification.length ? (
                            <span className="text-gray-500">Stripe is reviewing documents</span>
                          ) : !r.payouts_enabled ? (
                            <span>Payouts off — no fields listed</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {r.deadline ? (
                            <>
                              <div className={days !== null && days < 14 ? "font-semibold text-red-700" : "text-gray-700"}>
                                {new Date(r.deadline).toLocaleDateString()}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {days !== null && days >= 0 ? `in ${days} d` : `${Math.abs(days ?? 0)} d ago`}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap text-xs text-gray-500">
                          <div>{r.paid_bookings} paid</div>
                          {r.upcoming_bookings > 0 && <div className="text-gray-700">{r.upcoming_bookings} upcoming</div>}
                          {r.pending_payouts > 0 && (
                            <div className="font-semibold text-red-700">{r.pending_payouts} payout pending</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
