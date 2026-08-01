"use client";

import { useEffect, useState } from "react";

/**
 * Admin queue for markets paid by hand (Spain).
 *
 * Answers one question: who is owed money right now, and did we send it. The
 * IBAN is shown in full here on purpose — this is the screen someone copies it
 * from into the bank, and masking it would just push them to the database.
 *
 * Copy is plain English: the admin surface is internal and English-only, and
 * per CLAUDE.md an unbacked useTranslations() key renders as a raw path.
 */

type Row = {
  booking_id: string;
  shoot_date: string | null;
  photographer_name: string;
  photographer_email: string;
  payout_iban: string | null;
  payout_holder: string | null;
  payout_tax_id: string | null;
  payout_amount: string | null;
  client_name: string;
  delivery_accepted_at: string | null;
  paid_at: string | null;
  reference: string | null;
};

type Data = {
  pending: Row[];
  paid: Row[];
  owed_total: number;
  missing_details: number;
};

export function ManualPayoutsTab() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/manual-payouts");
      const d = await res.json();
      if (!res.ok) setError(d?.error || `Failed to load (${res.status})`);
      else { setData(d); setError(null); }
    } catch (e) {
      setError(`Could not load payouts: ${e instanceof Error ? e.message : e}`);
    }
  }

  useEffect(() => { load(); }, []);

  async function markPaid(row: Row) {
    const reference = window.prompt(
      `Mark as paid?\n\n${row.photographer_name} — €${Number(row.payout_amount || 0).toFixed(2)}\n` +
        `IBAN: ${row.payout_iban}\n\nBank reference (optional):`,
      ""
    );
    if (reference === null) return;
    setBusy(row.booking_id);
    try {
      const res = await fetch("/api/admin/manual-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: row.booking_id, reference }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(`Failed: ${d?.error || res.status}`);
      else await load();
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(null);
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p>;
  }
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl border border-warm-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Owed now</p>
          <p className="mt-1 text-xl font-bold text-gray-900">€{data.owed_total.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-warm-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Awaiting transfer</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{data.pending.length}</p>
        </div>
        {data.missing_details > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-amber-700">No bank details</p>
            <p className="mt-1 text-xl font-bold text-amber-800">{data.missing_details}</p>
            <p className="text-[11px] text-amber-700">Can&apos;t be paid — chase them</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Awaiting transfer
        </h3>
        {data.pending.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing owed. Everyone is paid up.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-warm-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">Photographer</th>
                  <th className="px-3 py-2">Bank details</th>
                  <th className="px-3 py-2">Client / shoot</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.pending.map((r) => (
                  <tr key={r.booking_id} className="border-t border-warm-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{r.photographer_name}</p>
                      <p className="text-xs text-gray-400">{r.photographer_email}</p>
                    </td>
                    <td className="px-3 py-2">
                      {r.payout_iban ? (
                        <>
                          <p className="font-mono text-xs text-gray-900">{r.payout_iban}</p>
                          <p className="text-xs text-gray-500">{r.payout_holder}</p>
                          {r.payout_tax_id && <p className="text-[11px] text-gray-400">{r.payout_tax_id}</p>}
                        </>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          not provided
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-gray-700">{r.client_name}</p>
                      <p className="text-xs text-gray-400">
                        {r.shoot_date ? new Date(r.shoot_date).toLocaleDateString("en-GB") : "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      €{Number(r.payout_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => markPaid(r)}
                        disabled={!r.payout_iban || busy === r.booking_id}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-40"
                      >
                        {busy === r.booking_id ? "Saving…" : "Mark as sent"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.paid.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Sent</h3>
          <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {data.paid.map((r) => (
                  <tr key={r.booking_id} className="border-t border-warm-100">
                    <td className="px-3 py-2 text-gray-700">{r.photographer_name}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      €{Number(r.payout_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString("en-GB") : ""}
                      {r.reference ? ` · ${r.reference}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
