"use client";

import { useState } from "react";

interface AddOnsSectionProps {
  isVerified: boolean;
  isFeatured: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
}

export function AddOnsSection({ isVerified, isFeatured, phoneVerified: initialPhoneVerified, phoneNumber: initialPhone }: AddOnsSectionProps) {
  const [loading, setLoading] = useState("");
  const [phone, setPhone] = useState(initialPhone || "");
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function handleSendCode() {
    if (!phone.trim() || phone.length < 8) {
      setError("Enter a valid phone number with country code (e.g. +351...)");
      return;
    }
    setLoading("send-code");
    setError("");
    try {
      const res = await fetch("/api/dashboard/verification/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCodeSent(true);
      } else {
        setError(data.error || "Failed to send code");
      }
    } catch {
      setError("Failed to send code");
    }
    setLoading("");
  }

  async function handleVerifyCode() {
    if (!code.trim() || code.length < 4) {
      setError("Enter the verification code");
      return;
    }
    setLoading("verify-code");
    setError("");
    try {
      const res = await fetch("/api/dashboard/verification/phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneVerified(true);
      } else {
        setError(data.error || "Invalid code");
      }
    } catch {
      setError("Verification failed");
    }
    setLoading("");
  }

  async function handleBuyVerified() {
    setLoading("buy-verified");
    try {
      const res = await fetch("/api/stripe/verified", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
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
              <p className="text-xs text-gray-500">&euro;19 one-time — Phone verification</p>
            </div>
          </div>

          {isVerified ? (
            /* Already verified */
            <div className="mt-4">
              <div className="flex items-center gap-2 rounded-lg bg-accent-50 p-3">
                <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-accent-700">Verified</span>
              </div>
              {initialPhone && (
                <p className="mt-2 text-xs text-gray-400">Phone: {initialPhone}</p>
              )}
            </div>
          ) : !phoneVerified ? (
            /* Step 1: Phone verification */
            <div className="mt-4">
              <p className="text-xs text-gray-500">
                Verify your phone number to prove your identity. Then complete payment for the badge.
              </p>

              {/* Steps indicator */}
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">1</span>
                <span className="font-medium text-blue-600">Phone</span>
                <div className="h-px w-4 bg-gray-200" />
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-400 font-bold text-[10px]">2</span>
                <span className="text-gray-400">Payment</span>
              </div>

              {!codeSent ? (
                <div className="mt-3">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="962 598 885"
                    className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Portuguese numbers auto-prefixed with +351</p>
                  <button
                    onClick={handleSendCode}
                    disabled={!!loading}
                    className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading === "send-code" ? "Sending..." : "Send SMS Code"}
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-accent-600 font-medium">Code sent to {phone}</p>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Enter 4-digit code"
                    maxLength={4}
                    className="mt-2 w-full rounded-lg border border-warm-200 px-3 py-2 text-center text-lg tracking-[0.3em] font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    onClick={handleVerifyCode}
                    disabled={!!loading}
                    className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading === "verify-code" ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    onClick={() => { setCodeSent(false); setCode(""); setError(""); }}
                    className="mt-1 w-full text-xs text-gray-400 hover:text-gray-600"
                  >
                    Change number or resend
                  </button>
                </div>
              )}

              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            </div>
          ) : (
            /* Step 2: Phone verified, now pay */
            <div className="mt-4">
              {/* Steps indicator */}
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-white font-bold text-[10px]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </span>
                <span className="font-medium text-accent-600">Phone verified</span>
                <div className="h-px w-4 bg-gray-200" />
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">2</span>
                <span className="font-medium text-blue-600">Payment</span>
              </div>

              <div className="rounded-lg bg-accent-50 p-3 mb-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-accent-700">Phone verified: {phone || initialPhone}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500">Complete payment to activate your Verified badge.</p>
              <button
                onClick={handleBuyVerified}
                disabled={!!loading}
                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === "buy-verified" ? "Redirecting..." : "Get Verified — \u20AC19"}
              </button>
            </div>
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
              <p className="text-xs text-gray-500">&euro;19/month — Priority visibility</p>
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
                Featured on the homepage, shown first on the photographers page, and a &quot;Featured&quot; badge on your profile and cards.
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
