"use client";

import { useState, useEffect } from "react";

export function StripeConnectSection() {
  const [status, setStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/connect")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, onboarded: false }));
  }, []);

  async function handleConnect() {
    setLoading(true);
    const res = await fetch("/api/stripe/connect", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-warm-200 bg-white p-6">
      <h2 className="text-lg font-bold text-gray-900">Payment Setup</h2>
      <p className="mt-2 text-sm text-gray-500">
        Connect your Stripe account to receive payments from clients.
      </p>

      {status === null ? (
        <div className="mt-4 h-10 w-40 animate-pulse rounded-lg bg-warm-200" />
      ) : status.onboarded ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100">
            <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-accent-700">Stripe connected</p>
            <p className="text-xs text-gray-500">You can receive payments from clients</p>
          </div>
        </div>
      ) : status.connected ? (
        <div className="mt-4">
          <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
            Your Stripe account is connected but onboarding is not complete. Please finish setting up your account.
          </p>
          <button onClick={handleConnect} disabled={loading}
            className="mt-3 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading ? "Loading..." : "Complete Setup"}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-3">
            To receive payments, you need to connect a Stripe account. This is a one-time setup that takes about 5 minutes.
          </p>
          <button onClick={handleConnect} disabled={loading}
            className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading ? "Setting up..." : "Connect with Stripe"}
          </button>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-warm-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">How payments work</h3>
        <ul className="mt-2 space-y-1 text-xs text-gray-500">
          <li>Client pays package price + 10% service fee at booking confirmation</li>
          <li>Payment is held securely until the session is marked as delivered</li>
          <li>Platform commission depends on your plan (Free: 20%, Pro: 12%, Premium: 7%)</li>
          <li>Payouts are processed automatically to your connected bank account</li>
        </ul>
      </div>
    </div>
  );
}
