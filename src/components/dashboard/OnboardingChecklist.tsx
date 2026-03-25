"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface OnboardingChecks {
  avatar: boolean;
  cover: boolean;
  bio: boolean;
  portfolio: number;
  packages: number;
  locations: number;
  stripeConnected: boolean;
  phone?: boolean;
  bookings?: number;
}

interface Step {
  label: string;
  href: string;
  complete: boolean;
  detail?: string;
  tip?: string;
}

function getPhotographerSteps(
  checks: OnboardingChecks,
  t: (key: string) => string,
): Step[] {
  return [
    {
      label: t("photographer.addProfilePhoto"),
      href: "/dashboard/profile",
      complete: !!checks.avatar,
      tip: t("photographer.addProfilePhotoTip"),
    },
    {
      label: t("photographer.uploadCoverImage"),
      href: "/dashboard/profile",
      complete: !!checks.cover,
      tip: t("photographer.uploadCoverImageTip"),
    },
    {
      label: t("photographer.writeBioTagline"),
      href: "/dashboard/profile",
      complete: !!checks.bio,
      tip: t("photographer.writeBioTaglineTip"),
    },
    {
      label: t("photographer.uploadPortfolioPhotos"),
      href: "/dashboard/portfolio",
      complete: checks.portfolio >= 5,
      detail: `${Math.min(checks.portfolio, 5)}/5`,
      tip: t("photographer.uploadPortfolioPhotosTip"),
    },
    {
      label: t("photographer.createFirstPackage"),
      href: "/dashboard/packages",
      complete: checks.packages >= 1,
      tip: t("photographer.createFirstPackageTip"),
    },
    {
      label: t("photographer.selectLocations"),
      href: "/dashboard/profile",
      complete: checks.locations >= 1,
      tip: t("photographer.selectLocationsTip"),
    },
    {
      label: t("photographer.connectStripe"),
      href: "/dashboard/payouts",
      complete: checks.stripeConnected,
      tip: t("photographer.connectStripeTip"),
    },
    {
      label: t("photographer.addPhoneNumber"),
      href: "/dashboard/profile#profile",
      complete: !!checks.phone,
      tip: t("photographer.addPhoneNumberTip"),
    },
  ];
}

function getClientSteps(
  checks: OnboardingChecks,
  t: (key: string) => string,
): Step[] {
  return [
    {
      label: t("client.addProfilePhoto"),
      href: "/dashboard/settings",
      complete: !!checks.avatar,
    },
    {
      label: t("client.addPhoneNumber"),
      href: "/dashboard/settings",
      complete: !!checks.phone,
      tip: t("client.addPhoneNumberTip"),
    },
    {
      label: t("client.findPhotographer"),
      href: "/photographers",
      complete: (checks.bookings ?? 0) >= 1,
    },
  ];
}

export function OnboardingChecklist({
  role,
  checks,
  userId,
  createdAt,
  isApproved,
}: {
  role: string;
  checks: OnboardingChecks;
  userId?: string;
  createdAt?: string;
  isApproved?: boolean;
}) {
  const DISMISS_KEY = userId ? `onboarding-dismissed-${userId}` : "onboarding-checklist-dismissed";
  const t = useTranslations("onboarding");
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [celebrateVisible, setCelebrateVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const steps =
    role === "photographer"
      ? getPhotographerSteps(checks, t)
      : getClientSteps(checks, t);

  const completedCount = steps.filter((s) => s.complete).length;
  const totalSteps = steps.length;
  const allDone = completedCount === totalSteps;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(DISMISS_KEY);
    // Only respect dismiss if all steps are done — otherwise always show
    if (stored === "true" && allDone) {
      setDismissed(true);
    } else {
      setDismissed(false);
      // Clear stale dismiss if steps are incomplete
      if (stored === "true" && !allDone) {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, [allDone, DISMISS_KEY]);

  // Show celebration when all done, then auto-hide after 4 seconds
  useEffect(() => {
    if (allDone && mounted && !dismissed) {
      setCelebrateVisible(true);
      const timer = setTimeout(() => {
        setDismissed(true);
        localStorage.setItem(DISMISS_KEY, "true");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [allDone, mounted, dismissed, DISMISS_KEY]);

  if (!mounted || dismissed) return null;

  if (celebrateVisible && allDone) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-r from-accent-50 via-white to-accent-50 p-8 text-center shadow-sm"
        style={{ animation: "celebrateFadeIn 0.5s ease-out" }}
      >
        <div className="text-4xl mb-3">
          <span role="img" aria-label="celebration">🎉</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-gray-900">
          {t("allSet")}
        </h2>
        <p className="mt-2 text-gray-500">
          {role === "photographer" ? t("allSetDescriptionPhotographer") : t("allSetDescriptionClient")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-r-2xl border border-warm-200 border-l-0 bg-gradient-to-br from-warm-50 via-white to-primary-50/30 shadow-sm">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-primary-500 to-accent-500" />

      <div className="p-6 pl-7">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-gray-900">
              {t("completeYourProfile")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("stepsProgress", { completed: completedCount, total: totalSteps })}
            </p>
            {role === "photographer" && !allDone && (
              <p className="mt-1 text-xs text-gray-400">
                {t("completeAllForApproval")}
              </p>
            )}
          </div>

          {/* Circular progress */}
          <div className="relative flex items-center justify-center">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-warm-200"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="text-primary-500"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - progressPct / 100)}`}
                style={{
                  transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </svg>
            <span className="absolute text-sm font-bold text-primary-600">
              {progressPct}%
            </span>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => {
              setDismissed(true);
              localStorage.setItem(DISMISS_KEY, "true");
            }}
            className="ml-3 rounded-lg p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-600"
            aria-label={t("dismissChecklist")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-warm-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-500"
            style={{
              width: `${progressPct}%`,
              transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* Deadline countdown */}
        {role === "photographer" && !allDone && !isApproved && createdAt && (() => {
          const deadline = new Date(new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
          const now = new Date();
          const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          if (daysLeft > 7) return null;
          const urgent = daysLeft <= 2;
          return (
            <div className={`mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm ${
              urgent ? "border border-red-200 bg-red-50 text-red-700" : "border border-amber-200 bg-amber-50 text-amber-700"
            }`}>
              <svg className={`h-4 w-4 shrink-0 ${urgent ? "text-red-500" : "text-amber-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {daysLeft === 0
                  ? t("deadlineToday")
                  : daysLeft === 1
                    ? t("deadlineTomorrow")
                    : t("deadlineDays", { days: daysLeft })}
              </span>
            </div>
          );
        })()}

        {/* Steps */}
        <div className="mt-5 space-y-1">
          {steps.map((step, i) => (
            <Link
              key={i}
              href={step.complete ? "#" : step.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                step.complete
                  ? "cursor-default"
                  : "hover:bg-white/80 hover:shadow-sm"
              }`}
              onClick={(e) => step.complete && e.preventDefault()}
            >
              {/* Checkmark or step number */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  step.complete
                    ? "scale-100 bg-accent-500 text-white"
                    : "border-2 border-warm-300 bg-white text-gray-400 group-hover:border-primary-300 group-hover:text-primary-500"
                }`}
                style={
                  step.complete
                    ? { animation: "checkPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }
                    : undefined
                }
              >
                {step.complete ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm transition ${
                    step.complete
                      ? "text-gray-400 line-through decoration-gray-300"
                      : "font-medium text-gray-700 group-hover:text-gray-900"
                  }`}
                >
                  {step.label}
                </span>
                {step.tip && !step.complete && (
                  <p className="text-xs text-gray-400 mt-0.5">{step.tip}</p>
                )}
              </div>

              {/* Detail badge (e.g., "3/5") */}
              {step.detail && !step.complete && (
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">
                  {step.detail}
                </span>
              )}

              {/* Arrow for incomplete items */}
              {!step.complete && (
                <svg
                  className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
