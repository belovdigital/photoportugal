"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

interface AddOnsSectionProps {
  isVerified: boolean;
  isFeatured: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  compact?: boolean;
}

/* Mini photographer card skeleton that shows how the badge/feature looks */
function MockCard({ type }: { type: "verified" | "featured" }) {
  return (
    <div className="relative mx-auto w-full max-w-[200px] overflow-hidden rounded-xl border border-warm-200 bg-white shadow-sm">
      {/* Cover area */}
      <div className="relative h-16 bg-gradient-to-br from-primary-200 to-primary-400">
        {type === "featured" && (
          <span className="absolute right-2 top-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[8px] font-bold text-yellow-900">
            FEATURED
          </span>
        )}
        {/* Avatar */}
        <div className="absolute -bottom-3 left-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary-100 text-[10px] font-bold text-primary-600 shadow">
            JP
          </div>
        </div>
      </div>
      <div className="p-3 pt-5">
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-16 rounded bg-gray-200" />
          {type === "verified" && (
            <svg className="h-3.5 w-3.5 shrink-0 text-accent-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="mt-1.5 h-2 w-24 rounded bg-gray-100" />
        <div className="mt-2 flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <svg key={i} className="h-2.5 w-2.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <div className="mt-2 h-2 w-20 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export function AddOnsSection({ isVerified, isFeatured, phoneVerified: initialPhoneVerified, phoneNumber: initialPhone, compact }: AddOnsSectionProps) {
  const [loading, setLoading] = useState("");
  const [phone, setPhone] = useState(initialPhone || "");
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const t = useTranslations("subscriptions");
  const locale = useLocale();

  async function handleSendCode() {
    if (!phone.trim() || phone.length < 8) { setError(t("enterValidPhone")); return; }
    setLoading("send-code"); setError("");
    try {
      const res = await fetch("/api/dashboard/verification/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim() }) });
      const data = await res.json();
      if (res.ok) setCodeSent(true); else setError(data.error || t("failedSendCode"));
    } catch { setError(t("failedSendCode")); }
    setLoading("");
  }

  async function handleVerifyCode() {
    if (!code.trim() || code.length < 4) { setError(t("enterVerificationCode")); return; }
    setLoading("verify-code"); setError("");
    try {
      const res = await fetch("/api/dashboard/verification/phone", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) });
      const data = await res.json();
      if (res.ok) setPhoneVerified(true); else setError(data.error || t("invalidCode"));
    } catch { setError(t("verificationFailed")); }
    setLoading("");
  }

  async function handleBuyVerified() {
    setLoading("buy-verified");
    try {
      const res = await fetch("/api/stripe/verified", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoading("");
  }

  async function handleGetFeatured() {
    setLoading("featured");
    try {
      const res = await fetch("/api/stripe/featured", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoading("");
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "portal", locale }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoading("");
  }

  return (
    <div className={compact ? "" : "mt-8 rounded-xl border border-warm-200 bg-white p-6"}>
      {!compact && (
        <>
          <h2 className="text-lg font-bold text-gray-900">{t("addOns")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("addOnsSubtitle")}</p>
        </>
      )}

      <div className={`${compact ? "" : "mt-6"} grid gap-4 sm:grid-cols-2`}>
        {/* Verified Badge */}
        <div className={`rounded-xl border overflow-hidden ${isVerified ? "border-accent-200 bg-accent-50/30" : "border-warm-200 bg-gradient-to-b from-blue-50/50 to-white"}`}>
          {/* Preview card */}
          {!isVerified && !compact && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-5 pt-5 pb-3">
              <MockCard type="verified" />
              <p className="mt-2 text-center text-[10px] font-medium text-blue-500">{t("verifiedPreviewLabel")}</p>
            </div>
          )}

          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("verifiedBadge")}</h3>
                <p className="text-xs text-gray-500">{t("verifiedBadgePrice")}</p>
              </div>
            </div>

            {/* Benefits list */}
            {!isVerified && (
              <ul className="mt-3 space-y-1.5">
                {[t("verifiedBenefit1"), t("verifiedBenefit2"), t("verifiedBenefit3")].map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {isVerified ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-lg bg-accent-50 p-3">
                  <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-accent-700">{t("verified")}</span>
                </div>
                {initialPhone && <p className="mt-2 text-xs text-gray-400">{t("phoneLabel", { phone: initialPhone })}</p>}
                <p className="mt-2 text-xs text-gray-400">{t("renewsYearly")}</p>
                <button onClick={handlePortal} disabled={!!loading} className="mt-2 w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">
                  {loading === "portal" ? t("loading") : t("cancelVerified")}
                </button>
              </div>
            ) : !phoneVerified ? (
              <div className="mt-4">
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">1</span>
                  <span className="font-medium text-blue-600">{t("stepPhone")}</span>
                  <div className="h-px w-4 bg-gray-200" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-400 font-bold text-[10px]">2</span>
                  <span className="text-gray-400">{t("stepPayment")}</span>
                </div>
                {!codeSent ? (
                  <div className="mt-3">
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phonePlaceholder")} className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    <p className="mt-1 text-[11px] text-gray-400">{t("phoneAutoPrefix")}</p>
                    <button onClick={handleSendCode} disabled={!!loading} className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {loading === "send-code" ? t("sending") : t("sendSmsCode")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs text-accent-600 font-medium">{t("codeSentTo", { phone })}</p>
                    <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("enterCode")} maxLength={4} className="mt-2 w-full rounded-lg border border-warm-200 px-3 py-2 text-center text-lg tracking-[0.3em] font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    <button onClick={handleVerifyCode} disabled={!!loading} className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {loading === "verify-code" ? t("verifying") : t("verifyCode")}
                    </button>
                    <button onClick={() => { setCodeSent(false); setCode(""); setError(""); }} className="mt-1 w-full text-xs text-gray-400 hover:text-gray-600">
                      {t("changeOrResend")}
                    </button>
                  </div>
                )}
                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              </div>
            ) : (
              <div className="mt-4">
                <div className="mb-3 flex items-center gap-2 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-white font-bold text-[10px]">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <span className="font-medium text-accent-600">{t("phoneVerified")}</span>
                  <div className="h-px w-4 bg-gray-200" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">2</span>
                  <span className="font-medium text-blue-600">{t("stepPayment")}</span>
                </div>
                <div className="rounded-lg bg-accent-50 p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-accent-700">{t("phoneVerifiedLabel", { phone: phone || initialPhone || "" })}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{t("completePaymentDesc")}</p>
                <button onClick={handleBuyVerified} disabled={!!loading} className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {loading === "buy-verified" ? t("redirecting") : t("getVerified")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Featured Placement */}
        <div className={`rounded-xl border overflow-hidden ${isFeatured ? "border-yellow-200 bg-yellow-50/30" : "border-warm-200 bg-gradient-to-b from-yellow-50/50 to-white"}`}>
          {/* Preview card */}
          {!isFeatured && !compact && (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 px-5 pt-5 pb-3">
              <MockCard type="featured" />
              <p className="mt-2 text-center text-[10px] font-medium text-yellow-600">{t("featuredPreviewLabel")}</p>
            </div>
          )}

          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("featuredPlacement")}</h3>
                <p className="text-xs text-gray-500">{t("featuredPlacementPrice")}</p>
              </div>
            </div>

            {/* Benefits list */}
            {!isFeatured && (
              <ul className="mt-3 space-y-1.5">
                {[t("featuredBenefit1"), t("featuredBenefit2"), t("featuredBenefit3")].map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {isFeatured ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
                  <svg className="h-4 w-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-medium text-yellow-700">{t("activeFeatured")}</span>
                </div>
                <p className="mt-2 text-xs text-gray-400">{t("renewsMonthly")}</p>
                <button onClick={handlePortal} disabled={!!loading} className="mt-2 w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">
                  {loading === "portal" ? t("loading") : t("cancelFeatured")}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <button onClick={handleGetFeatured} disabled={!!loading} className="w-full rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50">
                  {loading === "featured" ? t("redirecting") : t("getFeatured")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
