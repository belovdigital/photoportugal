"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { DeliveryGalleryClient } from "./DeliveryGalleryClient";
import { Avatar } from "@/components/ui/Avatar";
import { DisputeForm } from "@/components/ui/DisputeForm";
import { trackDeliveryAccepted } from "@/lib/analytics";
import { normalizeName } from "@/lib/format-name";
import { useConfirmModal } from "@/components/ui/ConfirmModal";
import { useSession } from "next-auth/react";

interface Photo {
  id: string;
  url: string;
  filename: string;
  file_size: number;
}

interface GalleryData {
  booking_id: string;
  client_id: string;
  photographer_name: string;
  photographer_avatar: string | null;
  client_name: string;
  shoot_date: string | null;
  photos: Photo[];
  photo_count: number;
  expires_at: string;
  delivery_accepted: boolean;
  payment_status: string;
  zip_ready?: boolean;
  zip_size?: number | null;
}

export function DeliveryPageClient({
  token,
  photographerName,
  photographerAvatar,
}: {
  token: string;
  photographerName: string;
  photographerAvatar: string | null;
}) {
  const t = useTranslations("delivery");
  const locale = useLocale();
  const { data: session } = useSession();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [error, setError] = useState("");
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const { modal, confirm } = useConfirmModal();

  // Auto-login with URL param or cached password
  useEffect(() => {
    const urlPw = new URLSearchParams(window.location.search).get("pw");
    const cached = urlPw || sessionStorage.getItem(`delivery_pw_${token}`);
    if (urlPw) sessionStorage.setItem(`delivery_pw_${token}`, urlPw);
    if (cached) {
      fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: cached }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setGallery(data);
            if (data.delivery_accepted) setAccepted(true);
          }
          setAutoLoading(false);
        })
        .catch(() => setAutoLoading(false));
    } else {
      setAutoLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for ZIP readiness after accept
  useEffect(() => {
    if (!accepted || !gallery || gallery.zip_ready) return;
    const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
    if (!pw) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/delivery/${token}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.zip_ready) {
            setGallery(data);
            clearInterval(interval);
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [accepted, gallery?.zip_ready, token, password]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setGallery(data);
        if (data.delivery_accepted) setAccepted(true);
        sessionStorage.setItem(`delivery_pw_${token}`, password.trim());
      } else if (res.status === 401) {
        setError(t("incorrectPassword"));
      } else if (res.status === 410) {
        setError(t("galleryExpired"));
      } else if (res.status === 429) {
        setError("Too many attempts. Please wait 15 minutes and try again.");
      } else {
        setError(t("somethingWentWrong"));
      }
    } catch {
      setError(t("connectionError"));
    }
    setLoading(false);
  }

  async function handleAcceptDelivery() {
    const ok = await confirm(t("acceptDeliveryTitle") || "Accept Delivery", t("confirmAcceptDelivery"), { confirmLabel: t("acceptButton") || "Accept" });
    if (!ok) return;

    setAccepting(true);
    setAcceptError("");

    try {
      const cachedPw = sessionStorage.getItem(`delivery_pw_${token}`) || "";
      const res = await fetch(`/api/delivery/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() || cachedPw }),
      });

      if (res.ok) {
        setAccepted(true);
        trackDeliveryAccepted();
        // Re-fetch gallery to get full-res URLs now that delivery is accepted
        try {
          const pw = password.trim() || sessionStorage.getItem(`delivery_pw_${token}`) || "";
          const verifyRes = await fetch(`/api/delivery/${token}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pw }),
          });
          if (verifyRes.ok) {
            const updatedData = await verifyRes.json();
            setGallery(updatedData);
          }
        } catch {
          // Gallery will still show preview URLs but that's acceptable
        }
      } else {
        const data = await res.json();
        if (data.already_accepted) {
          setAccepted(true);
        } else {
          setAcceptError(data.error || t("failedAcceptDelivery"));
        }
      }
    } catch {
      setAcceptError(t("connectionError"));
    }
    setAccepting(false);
  }

  // Loading cached password
  if (autoLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  // Password gate
  if (!gallery) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <Avatar src={photographerAvatar} fallback={normalizeName(photographerName)} size="lg" className="mx-auto" />
            <h1 className="mt-4 font-display text-xl font-bold text-gray-900">{normalizeName(photographerName)}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("sharedPhotosWithYou")}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t("enterGalleryPassword")}
            </label>
            <p className="mt-0.5 text-xs text-gray-400">
              {t("checkMessagesForPassword")}
            </p>
            <input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("galleryPasswordInputPlaceholder")}
              autoFocus
              className="mt-3 w-full rounded-xl border border-warm-200 px-4 py-3 text-center text-lg tracking-widest focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="mt-4 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? t("verifying") : t("viewPhotos")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            {t("brandFooter")}
          </p>
        </div>
      </div>
    );
  }

  // Gallery view (after password verified)
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  const isOwner = !!sessionUserId && sessionUserId === gallery.client_id;
  const totalSize = gallery.photos.reduce((sum, p) => sum + (p.file_size || 0), 0);
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
  const expiresDate = new Date(gallery.expires_at).toLocaleDateString(dateLocale, {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-100">
          {photographerAvatar ? (
            <img src={photographerAvatar} alt={normalizeName(photographerName)} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary-600">{normalizeName(photographerName).charAt(0)}</span>
          )}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("photosReady")}
        </h1>
        <p className="mt-2 text-gray-500">
          {normalizeName(gallery.photographer_name)} &middot;{" "}
          {gallery.shoot_date
            ? new Date(gallery.shoot_date).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })
            : "Photo Portugal"}
        </p>
      </div>

      {/* Stats & Download */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-warm-200 bg-white p-5 sm:flex-row">
        <div className="text-sm text-gray-500">
          <strong className="text-gray-900">{gallery.photo_count}</strong> {gallery.photo_count !== 1 ? t("photoPlural") : t("photoSingular")} &middot;{" "}
          {totalSize > 1024 * 1024
            ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
            : `${(totalSize / 1024).toFixed(0)} KB`}
          <span className="ml-3 text-xs text-gray-400">{t("availableUntil", { date: expiresDate })}</span>
        </div>
        {accepted ? (
          gallery?.zip_ready ? (
            <a
              href={`/api/delivery/${token}/download?password=${encodeURIComponent(password || sessionStorage.getItem(`delivery_pw_${token}`) || "")}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white hover:bg-primary-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t("downloadAllZip")}
              {gallery.zip_size && <span className="text-xs opacity-75">({(gallery.zip_size / (1024 * 1024)).toFixed(0)} MB)</span>}
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 text-sm font-medium text-gray-500">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Preparing ZIP...
            </span>
          )
        ) : isOwner ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-5 py-3 text-sm font-medium text-amber-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t("acceptToUnlockFullRes")}
          </span>
        ) : null}
      </div>

      {/* Accept Delivery Section — only for the logged-in client who owns this booking */}
      {isOwner ? (
        <div className="mt-6">
          {accepted ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-700">{t("deliveryAccepted")}</p>
                  <p className="text-sm text-green-600">{t("deliveryAcceptedThankYou")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-amber-800">{t("happyWithPhotos")}</p>
                  <p className="mt-1 text-sm text-amber-700">
                    {t("acceptDeliveryPrompt")} {gallery.payment_status === "paid" ? t("acceptDeliveryPaymentNote") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <DisputeForm bookingId={gallery.booking_id} />
                  <button
                    onClick={handleAcceptDelivery}
                    disabled={accepting}
                    className="shrink-0 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {accepting ? t("accepting") : t("acceptDelivery")}
                  </button>
                </div>
              </div>
              {acceptError && (
                <p className="mt-3 text-sm text-red-600">{acceptError}</p>
              )}
            </div>
          )}
        </div>
      ) : !accepted && (
        <div className="mt-6 rounded-xl border border-warm-200 bg-warm-50 p-5 text-center">
          <p className="text-sm text-gray-500">{t("loginToAccept")}</p>
          <a href="/auth/signin" className="mt-3 inline-block rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            {t("logIn")}
          </a>
        </div>
      )}

      {/* Gallery */}
      <DeliveryGalleryClient photos={gallery.photos} deliveryAccepted={accepted} />

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-400">
          {t("deliveredVia")} <a href="https://photoportugal.com" className="text-primary-600 hover:underline">Photo Portugal</a>
        </p>
      </div>
      {modal}
    </div>
  );
}
