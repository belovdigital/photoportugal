"use client";

import { useState } from "react";

export function SubscriptionManager({ currentPlan }: { currentPlan: string }) {
  const [loading, setLoading] = useState("");

  async function handleSubscribe(plan: string) {
    setLoading(plan);
    const res = await fetch("/api/stripe/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", plan }),
    });
    const data = await res.json();
    setLoading("");
    if (data.url) window.location.href = data.url;
  }

  async function handlePortal() {
    setLoading("portal");
    const res = await fetch("/api/stripe/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "portal" }),
    });
    const data = await res.json();
    setLoading("");
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="mt-4 space-y-3">
      {currentPlan === "free" && (
        <div className="flex gap-3">
          <button onClick={() => handleSubscribe("pro")} disabled={!!loading}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading === "pro" ? "Redirecting..." : "Upgrade to Pro — €29/mo"}
          </button>
          <button onClick={() => handleSubscribe("premium")} disabled={!!loading}
            className="rounded-xl border border-primary-300 px-5 py-2.5 text-sm font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-50">
            {loading === "premium" ? "Redirecting..." : "Upgrade to Premium — €59/mo"}
          </button>
        </div>
      )}
      {currentPlan === "pro" && (
        <div className="flex gap-3">
          <button onClick={() => handleSubscribe("premium")} disabled={!!loading}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading === "premium" ? "Redirecting..." : "Upgrade to Premium — €59/mo"}
          </button>
          <button onClick={handlePortal} disabled={!!loading}
            className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loading === "portal" ? "Loading..." : "Manage Billing"}
          </button>
        </div>
      )}
      {currentPlan === "premium" && (
        <button onClick={handlePortal} disabled={!!loading}
          className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {loading === "portal" ? "Loading..." : "Manage Billing & Invoices"}
        </button>
      )}
      {currentPlan !== "free" && (
        <p className="text-xs text-gray-400">
          Manage your subscription, download invoices, or cancel through the Stripe billing portal.
        </p>
      )}
    </div>
  );
}
