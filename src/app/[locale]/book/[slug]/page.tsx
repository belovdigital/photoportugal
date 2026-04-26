"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { SERVICE_FEE_RATE } from "@/lib/stripe";
import { trackBookingSubmitted, trackStartBooking } from "@/lib/analytics";
import DatePicker, { UnavailableRange } from "@/components/ui/DatePicker";
import { formatDuration } from "@/lib/package-pricing";
import { AuthModal } from "@/components/ui/AuthModal";

interface Package {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
}

interface BookReview {
  id: string;
  rating: number;
  title: string | null;
  text: string | null;
  client_name: string | null;
  created_at: string;
}

interface Photographer {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  rating?: number;
  review_count?: number;
  locations: { slug: string; name: string }[];
  packages: Package[];
  reviews?: BookReview[];
}

export default function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const t = useTranslations("book");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("flexible");
  const [flexibleDate, setFlexibleDate] = useState(false);
  const [flexibleDateFrom, setFlexibleDateFrom] = useState("");
  const [flexibleDateTo, setFlexibleDateTo] = useState("");
  const [unavailableRanges, setUnavailableRanges] = useState<UnavailableRange[]>([]);
  const [groupSize, setGroupSize] = useState("2");
  const [occasion, setOccasion] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [message, setMessage] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingSubmit = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    params.then(({ slug }) => {
      fetch(`/api/photographers/${slug}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(t("photographerNotFound"));
          } else if (data.is_demo) {
            setError(t("sampleProfile"));
            setLoading(false);
            return;
          } else {
            setPhotographer(data);
            // Pre-fill message if user came from AI Concierge with prefill_message param
            const prefill = searchParams.get("prefill_message");
            if (prefill) {
              setMessage(decodeURIComponent(prefill).slice(0, 1000));
            }
            if (data.packages?.length > 0) {
              const pkgParam = searchParams.get("package");
              const fromUrl = pkgParam ? data.packages.find((p: Package) => p.id === pkgParam) : null;
              const popular = data.packages.find((p: Package) => p.is_popular);
              setSelectedPackage(fromUrl?.id || popular?.id || data.packages[0].id);
            }
            if (data.locations?.length > 0) {
              setSelectedLocation(data.locations[0].slug);
            }
            // Fetch photographer unavailability
            fetch(`/api/availability?photographer_id=${data.id}`)
              .then((r) => r.json())
              .then((ranges) => setUnavailableRanges(ranges))
              .catch(() => {});
          }
          setLoading(false);
        })
        .catch(() => {
          setError(t("failedToLoad"));
          setLoading(false);
        });
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photographer) return;

    if (!flexibleDate && !shootDate) {
      setError(t("form.selectDateOrFlexible"));
      return;
    }
    if (flexibleDate && (!flexibleDateFrom || !flexibleDateTo)) {
      setError(t("form.selectDateRange"));
      return;
    }

    // If not logged in, save form data and show auth modal
    if (status !== "authenticated") {
      pendingSubmit.current = true;
      try {
        sessionStorage.setItem("booking_form", JSON.stringify({
          selectedPackage, selectedLocation, shootDate, shootTime,
          flexibleDate, flexibleDateFrom, flexibleDateTo,
          groupSize, occasion, locationDetail, message,
        }));
      } catch {}
      setShowAuthModal(true);
      return;
    }

    setSubmitting(true);
    setError("");

    const { getAllAttribution } = await import("@/lib/attribution");
    const attribution = getAllAttribution();
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photographer_id: photographer.id,
        package_id: selectedPackage || null,
        location_slug: selectedLocation || null,
        location_detail: locationDetail.trim() || null,
        shoot_date: flexibleDate ? "flexible" : shootDate,
        shoot_time: shootTime || null,
        flexible_date_from: flexibleDate ? flexibleDateFrom : null,
        flexible_date_to: flexibleDate ? flexibleDateTo : null,
        group_size: parseInt(groupSize) || 2,
        occasion: occasion || null,
        message,
        ...attribution,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      const pkg = photographer.packages.find((p) => p.id === selectedPackage);
      if (pkg) {
        trackStartBooking(photographer.slug, pkg.name, pkg.price);
        trackBookingSubmitted(photographer.slug, pkg.price);
      }
      setSuccess(true);
    } else {
      const data = await res.json();
      setError(data.error || t("failedToSend"));
    }
  }

  // After auth (modal or Google OAuth redirect), restore form and auto-submit
  useEffect(() => {
    if (status === "authenticated" && pendingSubmit.current) {
      // Came from AuthModal email/password login
      pendingSubmit.current = false;
      setShowAuthModal(false);
      setTimeout(() => formRef.current?.requestSubmit(), 100);
      return;
    }
    if (status === "authenticated" && photographer) {
      // Came back from Google OAuth redirect — check for saved form data
      try {
        const saved = sessionStorage.getItem("booking_form");
        if (saved) {
          const data = JSON.parse(saved);
          sessionStorage.removeItem("booking_form");
          if (data.selectedPackage) setSelectedPackage(data.selectedPackage);
          if (data.selectedLocation) setSelectedLocation(data.selectedLocation);
          if (data.shootDate) setShootDate(data.shootDate);
          if (data.shootTime) setShootTime(data.shootTime);
          if (data.flexibleDate) setFlexibleDate(data.flexibleDate);
          if (data.flexibleDateFrom) setFlexibleDateFrom(data.flexibleDateFrom);
          if (data.flexibleDateTo) setFlexibleDateTo(data.flexibleDateTo);
          if (data.groupSize) setGroupSize(data.groupSize);
          if (data.occasion) setOccasion(data.occasion);
          if (data.locationDetail) setLocationDetail(data.locationDetail);
          if (data.message) setMessage(data.message);
          // Auto-submit after state updates
          setTimeout(() => formRef.current?.requestSubmit(), 300);
        }
      } catch {}
    }
  }, [status, photographer]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">{tc("loading")}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100">
            <svg className="h-8 w-8 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{t("success.title")}</h1>
          <p className="mt-2 text-gray-500">
            {t("success.message", { photographer: photographer?.name || "" })}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard/bookings" className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700">
              {t("success.myBookings")}
            </Link>
            <Link href="/photographers" className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              {t("success.browseMore")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500">{error || t("photographerNotFound")}</p>
          <Link href="/photographers" className="mt-4 inline-flex rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700">
            {tc("browsePhotographers")}
          </Link>
        </div>
      </div>
    );
  }

  const selectedPkg = photographer.packages.find((p) => p.id === selectedPackage);

  const sidebarReviews = (photographer.reviews || []).filter((r) => r.text && r.text.length > 40).slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr,320px]">
        <div className="min-w-0">
      <h1 className="font-display text-3xl font-bold text-gray-900">
        {t("title", { photographer: photographer.name })}
      </h1>
      <p className="mt-2 text-gray-500">{t("subtitle")}</p>

      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <p className="text-sm font-semibold text-emerald-900">
          {t("trust.heading")}
        </p>
        <ul className="mt-2 space-y-1 text-[13px] text-emerald-800">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5">✓</span><span>{t("trust.freeRequest")}</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5">✓</span><span>{t("trust.payAfterConfirm")}</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5">✓</span><span>{t("trust.cancelAnytime")}</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5">✓</span><span>{t("trust.stripeSecure")}</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <AuthModal
        open={showAuthModal}
        onClose={() => { setShowAuthModal(false); pendingSubmit.current = false; }}
        onSuccess={() => {
          // session will update via useSession, triggering the useEffect above
        }}
        callbackUrl={typeof window !== "undefined" ? window.location.href : "/dashboard"}
        title={t("signInToBook")}
        subtitle={t("needAccount")}
      />

      <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Package selection */}
        {photographer.packages.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">{t("form.selectPackage")}</label>
            <div className="space-y-3">
              {photographer.packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className={`flex items-center justify-between rounded-xl border-2 p-4 transition cursor-pointer ${
                    selectedPackage === pkg.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="package"
                      value={pkg.id}
                      checked={selectedPackage === pkg.id}
                      onChange={(e) => {
                        setSelectedPackage(e.target.value);
                        const url = new URL(window.location.href);
                        url.searchParams.set("package", e.target.value);
                        window.history.replaceState(null, "", url.toString());
                      }}
                      className="h-4 w-4 text-primary-600"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {pkg.name}
                        {pkg.is_popular && <span className="ml-2 text-xs text-primary-600">{tc("mostPopular")}</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDuration(pkg.duration_minutes, locale)} &middot; {pkg.num_photos} {tc("photos")}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">&euro;{Math.round(Number(pkg.price))}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {photographer.locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("form.preferredLocation")}</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
            >
              {photographer.locations.map((loc: { slug: string; name: string }) => (
                <option key={loc.slug} value={loc.slug}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Specific location / meeting point */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("form.locationDetail")}</label>
          <input
            type="text"
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            placeholder={t("form.locationDetailPlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
          />
        </div>

        {/* Date & Time */}
        <div>
          {!flexibleDate && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatePicker
                label={t("form.preferredDate")}
                value={shootDate}
                onChange={setShootDate}
                min={new Date().toISOString().split("T")[0]}
                required={!flexibleDate}
                unavailableRanges={unavailableRanges}
                placeholder={t("form.selectDate")}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("form.preferredTime")}</label>
                <select
                  value={shootTime}
                  onChange={(e) => setShootTime(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
                >
                  <option value="flexible">{t("time.flexible")}</option>
                  <option value="sunrise">{t("time.sunrise")}</option>
                  <option value="morning">{t("time.morning")}</option>
                  <option value="midday">{t("time.midday")}</option>
                  <option value="afternoon">{t("time.afternoon")}</option>
                  <option value="golden_hour">{t("time.goldenHour")}</option>
                  <option value="sunset">{t("time.sunset")}</option>
                </select>
              </div>
            </div>
          )}
          <label className={`${!flexibleDate ? "mt-3" : ""} flex items-center gap-2 cursor-pointer`}>
            <input
              type="checkbox"
              checked={flexibleDate}
              onChange={(e) => {
                setFlexibleDate(e.target.checked);
                if (e.target.checked) {
                  setShootDate("");
                } else {
                  setFlexibleDateFrom("");
                  setFlexibleDateTo("");
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">{t("form.flexibleDates")}</span>
          </label>
          {flexibleDate && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatePicker
                label={t("form.dateFrom")}
                value={flexibleDateFrom}
                onChange={setFlexibleDateFrom}
                min={new Date().toISOString().split("T")[0]}
                required
                placeholder={t("form.selectDate")}
              />
              <DatePicker
                label={t("form.dateTo")}
                value={flexibleDateTo}
                onChange={setFlexibleDateTo}
                min={flexibleDateFrom || new Date().toISOString().split("T")[0]}
                required
                placeholder={t("form.selectDate")}
              />
            </div>
          )}
        </div>

        {/* Group & Occasion */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("form.groupSize")}</label>
            <select
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
            >
              <option value="1">{t("groupSizes.solo")}</option>
              <option value="2">{t("groupSizes.couple")}</option>
              <option value="3">{t("groupSizes.small")}</option>
              <option value="5">{t("groupSizes.group")}</option>
              <option value="9">{t("groupSizes.large")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("form.occasion")}</label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
            >
              <option value="">{t("occasions.select")}</option>
              <option value="vacation">{t("occasions.vacation")}</option>
              <option value="honeymoon">{t("occasions.honeymoon")}</option>
              <option value="engagement">{t("occasions.engagement")}</option>
              <option value="proposal">{t("occasions.proposal")}</option>
              <option value="anniversary">{t("occasions.anniversary")}</option>
              <option value="birthday">{t("occasions.birthday")}</option>
              <option value="family">{t("occasions.family")}</option>
              <option value="friends">{t("occasions.friends")}</option>
              <option value="solo">{t("occasions.solo")}</option>
              <option value="elopement">{t("occasions.elopement")}</option>
              <option value="maternity">{t("occasions.maternity")}</option>
              <option value="other">{t("occasions.other")}</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("form.messageTo")}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t("form.messagePlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
          />
        </div>

        {/* Summary */}
        {selectedPkg && (
          <div className="rounded-xl border border-warm-200 bg-white p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{selectedPkg.name}</span>
                <span className="text-gray-900">&euro;{Math.round(Number(selectedPkg.price))}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t("summary.serviceFee", { rate: SERVICE_FEE_RATE * 100 })}</span>
                <span className="text-gray-900">&euro;{Math.round(Number(selectedPkg.price) * SERVICE_FEE_RATE)}</span>
              </div>
              <hr className="border-warm-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{t("summary.total")}</span>
                <span className="text-xl font-bold text-gray-900">&euro;{Math.round(Number(selectedPkg.price) * (1 + SERVICE_FEE_RATE))}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">{t("form.paymentNote")}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? t("form.submitting") : t("form.submit")}
        </button>
      </form>
        </div>

        {/* Reviews sidebar */}
        {sidebarReviews.length > 0 && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-warm-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className={`h-4 w-4 ${i < Math.round(photographer.rating || 5) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-900">{Number(photographer.rating || 5).toFixed(1)}</span>
                {photographer.review_count ? (
                  <span className="text-xs text-gray-500">&middot; {photographer.review_count} {photographer.review_count === 1 ? tc("review") : tc("reviews")}</span>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">{tc("whatClientsSayAbout", { name: photographer.name })}</p>
              <div className="mt-4 space-y-4">
                {sidebarReviews.map((r) => (
                  <div key={r.id} className="border-t border-warm-100 pt-4 first:border-t-0 first:pt-0">
                    {r.title && <p className="text-sm font-semibold text-gray-900">{r.title}</p>}
                    {r.text && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-5">
                        {r.text.length > 200 ? r.text.slice(0, 200).replace(/\s\S*$/, "") + "…" : r.text}
                      </p>
                    )}
                    <p className={`mt-2 text-xs ${r.client_name ? "text-gray-500" : "text-gray-400 italic"}`}>
                      — {r.client_name || tc("privateClient")}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href={`/photographers/${photographer.slug}#reviews`}
                className="mt-4 block text-center text-xs font-medium text-primary-600 hover:underline"
              >
                See all reviews →
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
