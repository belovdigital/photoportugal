"use client";

import { useEffect, useState } from "react";

/**
 * Bank-details form that replaces Stripe Connect in manual-payout markets.
 *
 * Copy is plain English on purpose. Per CLAUDE.md, a component that calls
 * useTranslations() without matching keys in every messages/*.json renders the
 * raw key path in production and the `|| "fallback"` idiom does not catch it.
 * Literals cannot fail that way; Spanish wording comes later through proper
 * keys, and the photographer dashboard is EN/ES only in any case.
 */

type Details = {
  configured: boolean;
  iban_masked: string | null;
  holder: string | null;
  tax_id: string | null;
  updated_at: string | null;
};

export function PayoutDetailsSection() {
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [iban, setIban] = useState("");
  const [holder, setHolder] = useState("");
  const [taxId, setTaxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/payout-details")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.error) {
          setError(d.error);
        } else {
          setDetails(d);
          setHolder(d.holder || "");
          setTaxId(d.tax_id || "");
          setEditing(!d.configured);
        }
      })
      // Never fail silently — an invisible error here reads as "the form is
      // just empty" and the photographer waits forever for money.
      .catch((e) => !cancelled && setError(`Could not load your payout details: ${e.message}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/dashboard/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iban, holder, tax_id: taxId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Could not save (${res.status})`);
      } else {
        setDetails({
          configured: true,
          iban_masked: data.iban_masked,
          holder: data.holder,
          tax_id: data.tax_id,
          updated_at: new Date().toISOString(),
        });
        setIban("");
        setEditing(false);
        setSaved(true);
      }
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : e}`);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-warm-200 bg-white p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-warm-100" />
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-warm-200 bg-white p-6">
      <h2 className="font-display text-lg font-bold text-gray-900">Bank details for withdrawals</h2>
      <p className="mt-1 text-sm text-gray-500">
        We transfer your earnings to this account after each completed shoot. Payouts are
        sent manually, so make sure the name matches the account holder exactly — banks
        reject transfers where it doesn&apos;t.
      </p>

      {saved && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          Saved. Your payout details are on file.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p>
      )}

      {details?.configured && !editing ? (
        <div className="mt-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">IBAN</dt>
              <dd className="font-mono text-gray-900">{details.iban_masked}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Account holder</dt>
              <dd className="text-gray-900">{details.holder}</dd>
            </div>
            {details.tax_id && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Tax ID</dt>
                <dd className="text-gray-900">{details.tax_id}</dd>
              </div>
            )}
          </dl>
          <button
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
            className="mt-4 rounded-lg border border-warm-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-warm-50"
          >
            Change details
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">IBAN</label>
            <input
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="ES91 2100 0418 4502 0005 1332"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Account holder</label>
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="Full name exactly as it appears on the account"
              className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tax ID <span className="font-normal text-gray-400">(NIF/NIE — optional)</span>
            </label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="12345678Z"
              className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !iban.trim() || !holder.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save payout details"}
            </button>
            {details?.configured && (
              <button
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="rounded-lg border border-warm-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-warm-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
