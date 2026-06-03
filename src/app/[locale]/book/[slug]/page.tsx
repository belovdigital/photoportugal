"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { SERVICE_FEE_RATE, LARGE_GROUP_SURCHARGE_RATE, LARGE_GROUP_THRESHOLD } from "@/lib/stripe";
import { trackBookingSubmitted, trackStartBooking } from "@/lib/analytics";
import DatePicker, { UnavailableRange } from "@/components/ui/DatePicker";
import { formatDuration } from "@/lib/package-pricing";
import { AuthModal } from "@/components/ui/AuthModal";
import { GoogleReviewsBadge } from "@/components/ui/GoogleReviewsBadge";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ActiveBadge, ResponseTimeBadge } from "@/components/ui/ActiveBadge";
import { normalizeName } from "@/lib/format-name";
import { type BusyWindow, hasAvailableBookingStart } from "@/lib/booking-time-windows";

interface Package {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
  is_group_package?: boolean;
  preview_url?: string | null;
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
  coverage_locations?: { slug: string; name: string }[];
  packages: Package[];
  reviews?: BookReview[];
  /** Photographer's minimum advance-notice requirement, in hours.
   *  Used to compute the earliest selectable date in the picker.
   *  0 = no restriction (default). */
  min_lead_time_hours?: number;
  last_seen_at?: string | null;
  avg_response_minutes?: number | null;
  recent_bookings_30d?: number;
  is_verified?: boolean;
}

export default function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const searchParams = useSearchParams();
  // SSR-safe current URL — render-time `window.location.href` falls back to
  // "/dashboard" on the server, so on a deep link like
  // /book/<slug>?package=<id>&proposal=<msg> the auth callback strips the
  // photographer + selected package + proposal context.
  const pathname = usePathname();
  const _searchString = searchParams.toString();
  const currentUrl = _searchString ? `${pathname}?${_searchString}` : pathname;
  const { status } = useSession();
  const t = useTranslations("book");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  // Gift redemption: ?gift=1 in the URL means the recipient came here
  // from the gift-mode photographer profile. Forces tier-pricing and
  // skips the Stripe step in handleSubmit.
  const isGiftRedemption = searchParams.get("gift") === "1";
  // Photographer-initiated fast-track: when the client arrives here via
  // a BOOKING_CARD chat message ("Book Now" button), the URL carries
  // ?proposal=<msg_id>. Server validates this against the actual chat
  // message; if valid, the booking is created with status='confirmed'
  // and we hop straight to Stripe checkout (no photographer-confirm
  // round trip). UI text + button label switch to reflect that.
  const proposalMessageId = searchParams.get("proposal") || null;

  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [shootDate, setShootDate] = useState("");
  // Raw click coordinates from DatePicker (year, 1-indexed month, day).
  // Carried separately so the server can verify the YYYY-MM-DD string
  // matches the actual click position — catches any state corruption
  // between picker and submit.
  const [shootDateCoords, setShootDateCoords] = useState<{ year: number; month: number; day: number } | null>(null);
  const [shootTime, setShootTime] = useState("flexible");
  const [flexibleDate, setFlexibleDate] = useState(false);
  const [flexibleDateFrom, setFlexibleDateFrom] = useState("");
  const [flexibleDateFromCoords, setFlexibleDateFromCoords] = useState<{ year: number; month: number; day: number } | null>(null);
  const [flexibleDateTo, setFlexibleDateTo] = useState("");
  const [flexibleDateToCoords, setFlexibleDateToCoords] = useState<{ year: number; month: number; day: number } | null>(null);
  const [unavailableRanges, setUnavailableRanges] = useState<UnavailableRange[]>([]);
  const [busyWindows, setBusyWindows] = useState<BusyWindow[]>([]);
  const [groupSize, setGroupSize] = useState("2");
  const [largeGroupSize, setLargeGroupSize] = useState("");
  const [occasion, setOccasion] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [message, setMessage] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  // Gift-booking state. Hidden behind a switcher; when on, the buyer
  // enters the gift recipient's contact + chooses when we reveal it.
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState("");
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("");
  const [giftRecipientPhone, setGiftRecipientPhone] = useState("");
  const [giftRevealMode, setGiftRevealMode] = useState<"immediate" | "days_before">("immediate");
  const [giftRevealDaysBefore, setGiftRevealDaysBefore] = useState("3");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingSubmit = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    params.then(({ slug }) => {
      fetch(`/api/photographers/${slug}?locale=${locale}`)
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
            const locationOptions = data.coverage_locations?.length ? data.coverage_locations : data.locations;
            if (locationOptions?.length > 0) {
              setSelectedLocation(locationOptions[0].slug);
            }
            // Fetch photographer unavailability + buffered busy windows.
            // Guard against undefined/missing id (happens when the
            // photographer payload is incomplete — backend returned 200
            // but no id field), which would build the URL as
            // "photographer_id=undefined" and 500 on the API.
            if (!data.id) return;
            fetch(`/api/availability?photographer_id=${data.id}&include_slots=1`)
              .then((r) => r.json())
              .then((availability) => {
                if (Array.isArray(availability)) {
                  setUnavailableRanges(availability);
                  return;
                }
                setUnavailableRanges(availability.ranges || []);
                setBusyWindows(availability.busy_windows || []);
              })
              .catch(() => {});
          }
          setLoading(false);
        })
        .catch(() => {
          setError(t("failedToLoad"));
          setLoading(false);
        });
    });
  }, [params, searchParams, t]);

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
    if (groupSize === "larger") {
      const exactGroupSize = Number(largeGroupSize);
      if (!Number.isFinite(exactGroupSize) || exactGroupSize < 9 || exactGroupSize > 99) {
        setError(t("form.enterExactGroupSize"));
        return;
      }
    }

    // Phone is required so we can reach the client if email goes to spam.
    if (clientPhone.replace(/[^\d]/g, "").length < 6) {
      setError(t("form.phoneRequired"));
      return;
    }

    // Gift booking validation — same fields as backend rejects, surface
    // friendlier errors here.
    if (isGift) {
      if (!giftRecipientName.trim()) { setError(t("form.giftRecipientNameRequired") || "Recipient name is required"); return; }
      const em = giftRecipientEmail.trim().toLowerCase();
      if (!em || !em.includes("@") || !em.includes(".")) { setError(t("form.giftRecipientEmailRequired") || "Recipient email is required"); return; }
      if (giftRecipientPhone.replace(/[^\d]/g, "").length < 6) { setError(t("form.giftRecipientPhoneRequired") || "Recipient WhatsApp number is required"); return; }
    }

    // If not logged in, save form data and show auth modal
    if (status !== "authenticated") {
      pendingSubmit.current = true;
      try {
        sessionStorage.setItem("booking_form", JSON.stringify({
          selectedPackage, selectedLocation, shootDate, shootTime,
          // Picker click-coords have to ride along with the string so
          // the bulletproof server check survives the Google OAuth
          // round-trip. Without these, post-login submits get only the
          // string and the server falls back to legacy trust mode.
          shootDateCoords, flexibleDateFromCoords, flexibleDateToCoords,
          flexibleDate, flexibleDateFrom, flexibleDateTo,
          groupSize, largeGroupSize, occasion, locationDetail, message, clientPhone,
          isGift, giftRecipientName, giftRecipientEmail, giftRecipientPhone,
          giftRevealMode, giftRevealDaysBefore,
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
        // Raw click coordinates (year + 1-indexed month + day) from the
        // DatePicker. Server reconstructs the YYYY-MM-DD from these and
        // uses it as source of truth if it disagrees with the string —
        // this is the bulletproof guard against any state-corruption
        // bug that produces "I picked June but the booking says July".
        shoot_date_coords: flexibleDate ? null : shootDateCoords,
        shoot_time: shootTime || null,
        flexible_date_from: flexibleDate ? flexibleDateFrom : null,
        flexible_date_from_coords: flexibleDate ? flexibleDateFromCoords : null,
        flexible_date_to: flexibleDate ? flexibleDateTo : null,
        flexible_date_to_coords: flexibleDate ? flexibleDateToCoords : null,
        group_size: groupSize === "larger" ? parseInt(largeGroupSize) || 0 : parseInt(groupSize) || 2,
        group_size_is_estimate: false,
        occasion: occasion || null,
        message,
        client_phone: clientPhone.trim() || null,
        is_gift: isGift,
        gift_recipient_name: isGift ? giftRecipientName.trim() : null,
        gift_recipient_email: isGift ? giftRecipientEmail.trim().toLowerCase() : null,
        gift_recipient_phone: isGift ? giftRecipientPhone.trim() : null,
        gift_reveal_mode: isGift ? giftRevealMode : null,
        gift_reveal_days_before: isGift && giftRevealMode === "days_before" ? Number(giftRevealDaysBefore) || 3 : null,
        gift_card_redemption: isGiftRedemption,
        proposal_message_id: proposalMessageId,
        ...attribution,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const pkg = photographer.packages.find((p) => p.id === selectedPackage);
      if (pkg) {
        trackStartBooking(photographer.slug, pkg.name, pkg.price);
        trackBookingSubmitted(photographer.slug, pkg.price);
      }
      // Fast-track: photographer pre-confirmed via chat BOOKING_CARD,
      // server flipped the booking straight to status='confirmed'. Hop
      // to Stripe checkout immediately — no waiting on the photographer
      // to re-confirm what they already proposed.
      if (data.fast_track && data.booking_id) {
        try {
          const ck = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ booking_id: data.booking_id, locale }),
          });
          if (ck.ok) {
            const ckData = await ck.json();
            if (ckData.url) {
              window.location.href = ckData.url;
              return; // stays "submitting" until the redirect lands
            }
          }
          // Checkout creation failed — fall back to the success page
          // so the booking isn't lost. Photographer's dashboard will
          // still see it as confirmed; payment link goes via email.
          console.error("[book] fast-track checkout creation failed");
        } catch (err) {
          console.error("[book] fast-track checkout error:", err);
        }
      }
      setSubmitting(false);
      setSuccess(true);
    } else {
      setSubmitting(false);
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
    if (status === "authenticated") {
      // Prefill phone from saved user profile so they don't retype it
      // every booking. Only fills if the field is still empty (don't
      // clobber sessionStorage-restored value).
      fetch("/api/auth/me").then((r) => r.json()).then((d) => {
        if (d?.phone) setClientPhone((prev) => prev || d.phone);
      }).catch(() => {});
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
          if (data.shootDateCoords) setShootDateCoords(data.shootDateCoords);
          if (data.shootTime) setShootTime(data.shootTime);
          if (data.flexibleDate) setFlexibleDate(data.flexibleDate);
          if (data.flexibleDateFrom) setFlexibleDateFrom(data.flexibleDateFrom);
          if (data.flexibleDateFromCoords) setFlexibleDateFromCoords(data.flexibleDateFromCoords);
          if (data.flexibleDateTo) setFlexibleDateTo(data.flexibleDateTo);
          if (data.flexibleDateToCoords) setFlexibleDateToCoords(data.flexibleDateToCoords);
          if (data.groupSize) {
            const restoredGroupSize = String(data.groupSize);
            if (restoredGroupSize === "larger" || Number(restoredGroupSize) > 8) {
              setGroupSize("larger");
              setLargeGroupSize(data.largeGroupSize || (Number(restoredGroupSize) > 8 ? restoredGroupSize : ""));
            } else {
              setGroupSize(restoredGroupSize);
            }
          }
          if (data.largeGroupSize) setLargeGroupSize(data.largeGroupSize);
          if (data.occasion) setOccasion(data.occasion);
          if (data.locationDetail) setLocationDetail(data.locationDetail);
          if (data.message) setMessage(data.message);
          if (data.clientPhone) setClientPhone(data.clientPhone);
          if (typeof data.isGift === "boolean") setIsGift(data.isGift);
          if (data.giftRecipientName) setGiftRecipientName(data.giftRecipientName);
          if (data.giftRecipientEmail) setGiftRecipientEmail(data.giftRecipientEmail);
          if (data.giftRecipientPhone) setGiftRecipientPhone(data.giftRecipientPhone);
          if (data.giftRevealMode === "immediate" || data.giftRevealMode === "days_before") setGiftRevealMode(data.giftRevealMode);
          if (data.giftRevealDaysBefore) setGiftRevealDaysBefore(String(data.giftRevealDaysBefore));
          // Auto-submit after state updates
          setTimeout(() => formRef.current?.requestSubmit(), 300);
        }
      } catch {}
    }
  }, [status, photographer]);

  const selectedPackageObj = photographer?.packages.find((p) => p.id === selectedPackage) || null;
  const selectedDurationMinutes = selectedPackageObj?.duration_minutes || 120;
  const timeOptions = [
    { value: "flexible", label: t("time.flexible") },
    { value: "sunrise", label: t("time.sunrise") },
    { value: "morning", label: t("time.morning") },
    { value: "midday", label: t("time.midday") },
    { value: "afternoon", label: t("time.afternoon") },
    { value: "golden_hour", label: t("time.goldenHour") },
    { value: "sunset", label: t("time.sunset") },
  ];

  function isTimeOptionUnavailable(value: string) {
    if (!shootDate || flexibleDate || busyWindows.length === 0) return false;
    return !hasAvailableBookingStart(shootDate, value, selectedDurationMinutes, busyWindows);
  }

  useEffect(() => {
    if (!shootDate || flexibleDate || !shootTime || !isTimeOptionUnavailable(shootTime)) return;
    const nextAvailable = timeOptions.find((option) => !isTimeOptionUnavailable(option.value));
    if (nextAvailable) setShootTime(nextAvailable.value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shootDate, flexibleDate, shootTime, selectedDurationMinutes, busyWindows]);

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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
      {/* Photographer header — avatar + name + rating + activity badge.
          Replaces the cold "Book {name}" h1. The avatar makes the
          page feel personal and reassures the visitor they're booking
          a real human. */}
      <div className="flex items-start gap-4">
        <Link href={`/photographers/${photographer.slug}`} className="shrink-0">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary-100 text-lg font-bold text-primary-600 shadow-md">
            {photographer.avatar_url ? (
              <OptimizedImage
                src={photographer.avatar_url}
                alt={normalizeName(photographer.name)}
                width={200}
                className="h-full w-full"
              />
            ) : (
              normalizeName(photographer.name).charAt(0)
            )}
          </div>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            {t("title", { photographer: normalizeName(photographer.name) })}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            {(photographer.review_count || 0) > 0 && (
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-semibold text-gray-900">{Number(photographer.rating || 5).toFixed(1)}</span>
                <span className="text-gray-400">· {photographer.review_count} {photographer.review_count === 1 ? tc("review") : tc("reviews")}</span>
              </span>
            )}
            <ActiveBadge lastSeenAt={photographer.last_seen_at ?? null} />
            <ResponseTimeBadge avgMinutes={photographer.avg_response_minutes ?? null} compact />
          </div>
        </div>
      </div>

      {/* Social proof — recent demand. Only show when there's a real
          number behind it (≥3 paid bookings in last 30 days) so we never
          mislead with "1 person booked this month" on quiet profiles. */}
      {(photographer.recent_bookings_30d ?? 0) >= 3 && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          {t("socialProof.recentBookings", { count: photographer.recent_bookings_30d ?? 0, name: normalizeName(photographer.name) })}
        </div>
      )}

      {/* Trust box — mobile only (desktop has it in sticky sidebar). */}
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 lg:hidden">
        <p className="text-sm font-semibold text-emerald-900">
          {t("trust.heading")}
        </p>
        <ul className="mt-2.5 grid grid-cols-1 gap-1.5 text-[13px] text-emerald-800 sm:grid-cols-2">
          <li className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t("trust.freeRequest")}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t("trust.payAfterConfirm")}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 0118 0m-9-9v3m0 12v3m9-9h-3M6 12H3" />
            </svg>
            <span>{t("trust.cancelAnytime")}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>{t("trust.stripeSecure")}</span>
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
        callbackUrl={currentUrl}
        title={t("signInToBook")}
        subtitle={t("needAccount")}
      />

      <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Package selection — visual cards with a real portfolio thumbnail
            on the left, package details in the middle, price on the right.
            Beats a stack of plain radios for choosing between photographers
            who all bring different visual styles. "Most Popular" lives as
            an amber pill on the corner of the highlighted option. */}
        {photographer.packages.length > 0 && (() => {
          const selected = photographer.packages.find((p) => p.id === selectedPackage);
          const others = photographer.packages.filter((p) => p.id !== selectedPackage);
          const renderPkg = (pkg: typeof photographer.packages[number]) => (
            <label
              key={pkg.id}
              className={`relative flex items-stretch overflow-hidden rounded-xl border-2 transition cursor-pointer ${
                selectedPackage === pkg.id
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="radio"
                    name="package"
                    value={pkg.id}
                    checked={selectedPackage === pkg.id}
                    onChange={(e) => {
                      setSelectedPackage(e.target.value);
                      setShowAllPackages(false);
                      const url = new URL(window.location.href);
                      url.searchParams.set("package", e.target.value);
                      window.history.replaceState(null, "", url.toString());
                    }}
                    className="h-4 w-4 shrink-0 text-primary-600"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{pkg.name}</p>
                      {pkg.is_popular && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          {tc("mostPopular")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatDuration(pkg.duration_minutes, locale)} &middot; {pkg.num_photos} {tc("photos")}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900 shrink-0">&euro;{Math.round(Number(pkg.price))}</span>
              </div>
            </label>
          );
          return (
            <div>
              <div className="space-y-3">
                {selected && renderPkg(selected)}
                {showAllPackages && others.map(renderPkg)}
                {others.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPackages((v) => !v)}
                    className="w-full rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  >
                    {showAllPackages ? `${t("form.hideOtherPackages")} ▴` : `${t("form.morePackages", { count: others.length })} ▾`}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Location + meeting point */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(photographer.coverage_locations?.length || photographer.locations.length) > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("form.preferredLocation")}</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
              >
                {(photographer.coverage_locations?.length ? photographer.coverage_locations : photographer.locations).map((loc: { slug: string; name: string }) => (
                  <option key={loc.slug} value={loc.slug}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("form.locationDetail")}</label>
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder={t("form.locationDetailPlaceholder")}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div>
          {!flexibleDate && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatePicker
                label={t("form.preferredDate")}
                value={shootDate}
                onChange={(v, coords) => {
                  setShootDate(v);
                  setShootDateCoords(coords || null);
                }}
                // Earliest selectable date = today + photographer's notice
                // period (hours rounded up to whole days). 0h → today.
                // Backend re-validates the same window on submit.
                min={(() => {
                  const hours = photographer?.min_lead_time_hours || 0;
                  const days = Math.ceil(hours / 24);
                  const earliest = new Date();
                  earliest.setHours(0, 0, 0, 0);
                  earliest.setDate(earliest.getDate() + days);
                  return earliest.toISOString().split("T")[0];
                })()}
                required={!flexibleDate}
                unavailableRanges={unavailableRanges}
                placeholder={t("form.selectDate")}
              />
              {(photographer?.min_lead_time_hours || 0) > 0 && (
                <p className="-mt-2 sm:col-span-2 text-xs text-amber-600">
                  {t("form.noticeRequiredHint", {
                    days: Math.ceil((photographer?.min_lead_time_hours || 0) / 24),
                  })}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("form.preferredTime")}</label>
                <select
                  value={shootTime}
                  onChange={(e) => setShootTime(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
                >
                  {timeOptions.map((option) => {
                    const unavailable = isTimeOptionUnavailable(option.value);
                    return (
                      <option key={option.value} value={option.value} disabled={unavailable}>
                        {option.label}{unavailable ? ` · ${t("time.unavailable")}` : ""}
                      </option>
                    );
                  })}
                </select>
                {shootDate && isTimeOptionUnavailable(shootTime) && (
                  <p className="mt-1 text-xs text-amber-600">{t("form.timeUnavailableHint")}</p>
                )}
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
                  setShootDateCoords(null);
                } else {
                  setFlexibleDateFrom("");
                  setFlexibleDateFromCoords(null);
                  setFlexibleDateTo("");
                  setFlexibleDateToCoords(null);
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
                onChange={(v, coords) => { setFlexibleDateFrom(v); setFlexibleDateFromCoords(coords || null); }}
                min={new Date().toISOString().split("T")[0]}
                required
                placeholder={t("form.selectDate")}
              />
              <DatePicker
                label={t("form.dateTo")}
                value={flexibleDateTo}
                onChange={(v, coords) => { setFlexibleDateTo(v); setFlexibleDateToCoords(coords || null); }}
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
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
            >
              <option value="1">{t("groupSizes.solo")}</option>
              <option value="2">{t("groupSizes.couple")}</option>
              <option value="3">{t("groupSizes.peopleCount", { count: 3 })}</option>
              <option value="4">{t("groupSizes.peopleCount", { count: 4 })}</option>
              <option value="5">{t("groupSizes.peopleCount", { count: 5 })}</option>
              <option value="6">{t("groupSizes.peopleCount", { count: 6 })}</option>
              <option value="7">{t("groupSizes.peopleCount", { count: 7 })}</option>
              <option value="8">{t("groupSizes.peopleCount", { count: 8 })}</option>
              <option value="larger">{t("groupSizes.large")}</option>
            </select>
            {groupSize === "larger" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500">{t("form.exactGroupSize")}</label>
                <input
                  type="number"
                  min={9}
                  max={99}
                  inputMode="numeric"
                  value={largeGroupSize}
                  onChange={(e) => setLargeGroupSize(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                  placeholder="18"
                  required
                  className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">{t("form.exactGroupSizeHint")}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("form.occasion")}</label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
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

        {/* Phone — required so we can reach the client by SMS / WhatsApp
            if email goes to spam. Prefilled from the user's saved phone
            once they're authenticated. */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("form.phone")}
          </label>
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="+351 912 345 678"
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-400">{t("form.phoneHint")}</p>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("form.messageToNamed", { name: normalizeName(photographer.name) })}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t("form.messagePlaceholderNamed", { name: normalizeName(photographer.name) })}
            className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
          />
        </div>

        {/* Gift-card redemption banner — shown when the recipient came
            here from a gift-mode profile. Replaces the regular price
            summary with a clear "free for you" explanation. The gift
            toggle below is hidden in this mode (you can't gift a gift). */}
        {isGiftRedemption && (
          <div className="rounded-xl border-2 border-primary-300 bg-gradient-to-br from-primary-50 to-rose-50 p-5">
            <p className="text-sm font-bold text-primary-900 mb-1">
              🎁 You&rsquo;re redeeming your gift session
            </p>
            <p className="text-sm text-gray-700">
              Total to pay: <strong>€0</strong> — the entire session is covered by your gift card. Fill in the date, location, and any notes for {photographer && photographer.name.split(" ")[0]}, and submit.
            </p>
          </div>
        )}

        {/* Gift booking — switcher + recipient fields. The recipient gets
            a magic-link email at the reveal time (now or N days before
            shoot) to claim/access the booking. Their WhatsApp goes to the
            photographer for day-of coordination.

            Hidden during gift-card redemption — you can't gift a gift. */}
        {!isGiftRedemption && (
        <div className={`rounded-xl border ${isGift ? "border-primary-300 bg-primary-50/40" : "border-gray-200 bg-white"} p-5 transition`}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isGift}
              onChange={(e) => setIsGift(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="flex-1">
              <span className="block font-semibold text-gray-900">
                🎁 {t("form.giftToggle") || "This booking is a gift"}
              </span>
              <span className="block mt-0.5 text-xs text-gray-500">
                {t("form.giftToggleHint") || "Surprise someone with a session. You pay, they show up."}
              </span>
            </span>
          </label>

          {isGift && (
            <div className="mt-4 space-y-4 border-t border-primary-200 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("form.giftRecipientName") || "Recipient name"}
                  </label>
                  <input
                    type="text"
                    value={giftRecipientName}
                    onChange={(e) => setGiftRecipientName(e.target.value)}
                    placeholder="Maria Silva"
                    required={isGift}
                    className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("form.giftRecipientEmail") || "Recipient email"}
                  </label>
                  <input
                    type="email"
                    value={giftRecipientEmail}
                    onChange={(e) => setGiftRecipientEmail(e.target.value)}
                    placeholder="maria@example.com"
                    required={isGift}
                    className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t("form.giftRecipientPhone") || "Recipient WhatsApp"}
                </label>
                <input
                  type="tel"
                  value={giftRecipientPhone}
                  onChange={(e) => setGiftRecipientPhone(e.target.value)}
                  placeholder="+351 912 345 678"
                  required={isGift}
                  className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  {t("form.giftRecipientPhoneHint") || "Used by the photographer for day-of coordination only — hidden until the reveal date."}
                </p>
              </div>

              <div>
                <p className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
                  {t("form.giftRevealWhen") || "When should we tell them?"}
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-primary-300">
                    <input
                      type="radio"
                      name="giftRevealMode"
                      checked={giftRevealMode === "immediate"}
                      onChange={() => setGiftRevealMode("immediate")}
                      className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      🎁 {t("form.giftRevealNow") || "Send them a gift card now"}
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-primary-300">
                    <input
                      type="radio"
                      name="giftRevealMode"
                      checked={giftRevealMode === "days_before"}
                      onChange={() => setGiftRevealMode("days_before")}
                      className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">
                      ⏰ {t("form.giftRevealBefore") || "Surprise — tell them"}{" "}
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={giftRevealDaysBefore}
                        onChange={(e) => setGiftRevealDaysBefore(e.target.value)}
                        disabled={giftRevealMode !== "days_before"}
                        className="inline-block w-14 rounded border border-gray-300 px-2 py-0.5 text-sm text-center disabled:bg-gray-100"
                      />{" "}
                      {t("form.giftRevealDaysBefore") || "days before the shoot"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Summary — visible on mobile only; desktop has the sticky
            summary card in the right sidebar instead. In gift-card-
            redemption mode we render a fixed €0 summary instead of the
            price-calc one so the buyer doesn't see conflicting totals. */}
        {selectedPkg && isGiftRedemption && (
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-5 lg:hidden">
            <p className="text-sm font-bold text-primary-900">🎁 Gift session</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm text-gray-700">Total to pay</span>
              <span className="text-xl font-bold text-gray-900">€0</span>
            </div>
            <p className="mt-2 text-xs text-gray-600">Your gift card covers the entire session.</p>
          </div>
        )}
        {selectedPkg && !isGiftRedemption && (() => {
          const effectiveGroup = groupSize === "larger" ? (parseInt(largeGroupSize) || 9) : (parseInt(groupSize) || 2);
          const applySurcharge = !selectedPkg.is_group_package && effectiveGroup >= LARGE_GROUP_THRESHOLD;
          const basePrice = Number(selectedPkg.price);
          const surcharge = applySurcharge ? basePrice * LARGE_GROUP_SURCHARGE_RATE : 0;
          const subtotal = basePrice + surcharge;
          const fee = subtotal * SERVICE_FEE_RATE;
          const total = subtotal + fee;
          return (
          <div className="rounded-xl border border-warm-200 bg-white p-5 lg:hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{selectedPkg.name}</span>
                <span className="text-gray-900">&euro;{Math.round(basePrice)}</span>
              </div>
              {applySurcharge && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t("summary.largeGroupSurcharge", { rate: LARGE_GROUP_SURCHARGE_RATE * 100 })}</span>
                  <span className="text-gray-900">&euro;{Math.round(surcharge)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t("summary.serviceFee", { rate: SERVICE_FEE_RATE * 100 })}</span>
                <span className="text-gray-900">&euro;{fee.toFixed(2)}</span>
              </div>
              <hr className="border-warm-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{t("summary.total")}</span>
                <span className="text-xl font-bold text-gray-900">&euro;{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm font-medium text-emerald-900">{t("form.paymentNote")}</p>
            </div>
          </div>
          );
        })()}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting
            ? t("form.submitting")
            : proposalMessageId
              ? (t("form.payAndBook") || "Pay & Book Now")
              : t("form.submit")}
        </button>
        {proposalMessageId && !submitting && (
          <p className="mt-2 text-center text-xs text-gray-500">
            {t("form.proposalHint") || "The photographer already approved this package — payment confirms the booking."}
          </p>
        )}

        <div className="mt-3 flex justify-center">
          <GoogleReviewsBadge variant="compact" />
        </div>
      </form>

      {/* Reviews — moved out of the sidebar so they don't compete with
          the booking summary. Sit under the form, full width of the
          left column. */}
      {sidebarReviews.length > 0 && (
        <div className="mt-8 rounded-2xl border border-warm-200 bg-white p-5">
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
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sidebarReviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-warm-100 bg-warm-50/50 p-4">
                {r.title && <p className="text-sm font-semibold text-gray-900">{r.title}</p>}
                {r.text && (
                  <p className="mt-1 text-sm text-gray-600 line-clamp-6">
                    {r.text.length > 220 ? r.text.slice(0, 220).replace(/\s\S*$/, "") + "…" : r.text}
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
            {tc("seeAllReviews")} →
          </Link>
        </div>
      )}
        </div>

        {/* Sidebar — sticky booking summary on top, reviews below.
            On desktop the visitor always sees who they're booking and
            what it costs while filling the form. Hidden on mobile (the
            inline form summary above the submit button covers it). */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start">
          {/* Trust box — moved into sidebar so it stays in view while
              the photographer fills the form. */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              {t("trust.heading")}
            </p>
            <ul className="mt-2.5 grid grid-cols-1 gap-1.5 text-[13px] text-emerald-800">
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("trust.freeRequest")}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("trust.payAfterConfirm")}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 0118 0m-9-9v3m0 12v3m9-9h-3M6 12H3" />
                </svg>
                <span>{t("trust.cancelAnytime")}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{t("trust.stripeSecure")}</span>
              </li>
            </ul>
          </div>

          {/* Booking summary card */}
          <div className="rounded-2xl border border-warm-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white bg-primary-100 text-sm font-bold text-primary-600 shadow-sm">
                {photographer.avatar_url ? (
                  <OptimizedImage
                    src={photographer.avatar_url}
                    alt={normalizeName(photographer.name)}
                    width={120}
                    className="h-full w-full"
                  />
                ) : (
                  normalizeName(photographer.name).charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{normalizeName(photographer.name)}</p>
                {(photographer.review_count || 0) > 0 && (
                  <p className="text-xs text-gray-500">
                    ★ {Number(photographer.rating || 5).toFixed(1)} · {photographer.review_count} {photographer.review_count === 1 ? tc("review") : tc("reviews")}
                  </p>
                )}
              </div>
            </div>

            {selectedPkg && isGiftRedemption ? (
              <>
                <div className="mt-4 rounded-lg bg-primary-50 border border-primary-200 p-3 space-y-1">
                  <p className="text-sm font-bold text-primary-900">🎁 Gift session</p>
                  <p className="text-xs text-gray-500">
                    {formatDuration(selectedPkg.duration_minutes, locale)}
                    {selectedPkg.num_photos > 0 && ` · ${selectedPkg.num_photos} ${tc("photos")}`}
                  </p>
                </div>
                <hr className="my-3 border-warm-200" />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-900">{t("summary.total")}</span>
                  <span className="text-xl font-bold text-gray-900">€0</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">Your gift card covers the entire session.</p>
              </>
            ) : selectedPkg ? (() => {
              const effectiveGroup = groupSize === "larger" ? (parseInt(largeGroupSize) || 9) : (parseInt(groupSize) || 2);
              const applySurcharge = !selectedPkg.is_group_package && effectiveGroup >= LARGE_GROUP_THRESHOLD;
              const basePrice = Number(selectedPkg.price);
              const surcharge = applySurcharge ? basePrice * LARGE_GROUP_SURCHARGE_RATE : 0;
              const subtotal = basePrice + surcharge;
              const fee = subtotal * SERVICE_FEE_RATE;
              const total = subtotal + fee;
              return (
              <>
                <div className="mt-4 rounded-lg bg-warm-50 p-3 space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{selectedPkg.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDuration(selectedPkg.duration_minutes, locale)}
                    {selectedPkg.num_photos > 0 && ` · ${selectedPkg.num_photos} ${tc("photos")}`}
                  </p>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{selectedPkg.name}</span>
                    <span className="text-gray-900">€{Math.round(basePrice)}</span>
                  </div>
                  {applySurcharge && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t("summary.largeGroupSurcharge", { rate: LARGE_GROUP_SURCHARGE_RATE * 100 })}</span>
                      <span className="text-gray-900">€{Math.round(surcharge)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("summary.serviceFee", { rate: SERVICE_FEE_RATE * 100 })}</span>
                    <span className="text-gray-900">€{fee.toFixed(2)}</span>
                  </div>
                </div>
                <hr className="my-3 border-warm-200" />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-900">{t("summary.total")}</span>
                  <span className="text-xl font-bold text-gray-900">€{total.toFixed(2)}</span>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-2">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-[12px] font-medium text-emerald-900 leading-snug">{t("form.paymentNote")}</p>
                </div>
              </>
              );
            })() : (
              <p className="mt-4 text-xs text-gray-400 italic">
                {t("summary.pickPackagePrompt")}
              </p>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}
