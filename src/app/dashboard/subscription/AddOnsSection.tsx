"use client";

import { useState } from "react";

interface AddOnsSectionProps {
  isVerified: boolean;
  isFeatured: boolean;
  verificationRequested: boolean;
}

export function AddOnsSection({ isVerified, isFeatured, verificationRequested }: AddOnsSectionProps) {
  const [loading, setLoading] = useState("");
  const [requested, setRequested] = useState(verificationRequested);

  async function handleRequestVerification() {
    setLoading("verify");
    try {
      const res = await fetch("/api/dashboard/verification", { method: "POST" });
      if (res.ok) setRequested(true);
    } catch {}
    setLoading("");
  }

  async function handleGetFeatured() {
    setLoading("featured");
    try {
      const res = await fetch("/api/stripe/featured", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoading("");
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoading("");
  }

  return (
    <div className="mt-8 rounded-xl border border-warm-200 bg-white p-6">
      <h2 className="text-lg font-bold text-gray-900">Add-ons</h2>
      <p className="mt-1 text-sm text-gray-500">Boost your visibility and build trust with clients</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Verified Badge */}
        <div className="rounded-xl border border-warm-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Verified Badge</h3>
              <p className="text-xs text-gray-500">Free — Identity verification</p>
            </div>
          </div>

          {isVerified ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-50 p-3">
              <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-accent-700">Verified</span>
            </div>
          ) : requested ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
              <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-yellow-700">Pending review — we&apos;ll verify your profile shortly</span>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs text-gray-500">
                Get verified to build trust with clients. Our team will review your profile and portfolio.
              </p>
              <button
                onClick={handleRequestVerification}
                disabled={!!loading}
                className="mt-3 w-full rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {loading === "verify" ? "Submitting..." : "Request Verification"}
              </button>
            </>
          )}
        </div>

        {/* Featured Placement */}
        <div className="rounded-xl border border-warm-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Featured Placement</h3>
              <p className="text-xs text-gray-500">&euro;19/month — Homepage visibility</p>
            </div>
          </div>

          {isFeatured ? (
            <div className="mt-4">
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
                <svg className="h-4 w-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-medium text-yellow-700">Active — Featured on homepage</span>
              </div>
              <button
                onClick={handlePortal}
                disabled={!!loading}
                className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading === "portal" ? "Loading..." : "Manage in Billing Portal"}
              </button>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs text-gray-500">
                Get featured on the homepage and appear first in search results. Includes a &quot;Featured&quot; badge on your profile.
              </p>
              <button
                onClick={handleGetFeatured}
                disabled={!!loading}
                className="mt-3 w-full rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
              >
                {loading === "featured" ? "Redirecting..." : "Get Featured — \u20AC19/mo"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
