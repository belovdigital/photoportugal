"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OnboardingChecks {
  avatar: boolean;
  cover: boolean;
  bio: boolean;
  portfolio: number;
  packages: number;
  locations: number;
  stripeConnected: boolean;
  bookings?: number;
}

interface Step {
  label: string;
  href: string;
  complete: boolean;
  detail?: string;
  tip?: string;
}

function getPhotographerSteps(checks: OnboardingChecks): Step[] {
  return [
    {
      label: "Add profile photo",
      href: "/dashboard/profile",
      complete: !!checks.avatar,
      tip: "A friendly headshot helps clients trust you",
    },
    {
      label: "Upload cover image",
      href: "/dashboard/profile",
      complete: !!checks.cover,
      tip: "Use your best wide landscape shot",
    },
    {
      label: "Write your bio & tagline",
      href: "/dashboard/profile",
      complete: !!checks.bio,
      tip: "Mention your experience, style, and what makes you unique",
    },
    {
      label: "Upload at least 5 portfolio photos",
      href: "/dashboard/portfolio",
      complete: checks.portfolio >= 5,
      detail: `${Math.min(checks.portfolio, 5)}/5`,
      tip: "Upload at least 10 diverse photos showing your range",
    },
    {
      label: "Create your first package",
      href: "/dashboard/packages",
      complete: checks.packages >= 1,
      tip: "Start with 2-3 packages at different price points",
    },
    {
      label: "Select your locations",
      href: "/dashboard/profile",
      complete: checks.locations >= 1,
      tip: "Add all areas where you're available to shoot",
    },
    {
      label: "Connect Stripe for payments",
      href: "/dashboard/payouts",
      complete: checks.stripeConnected,
      tip: "Required to receive payments from bookings",
    },
  ];
}

function getClientSteps(checks: OnboardingChecks): Step[] {
  return [
    {
      label: "Add profile photo",
      href: "/dashboard/settings",
      complete: !!checks.avatar,
    },
    {
      label: "Find your photographer",
      href: "/photographers",
      complete: (checks.bookings ?? 0) >= 1,
    },
  ];
}

const DISMISS_KEY = "onboarding-checklist-dismissed";

export function OnboardingChecklist({
  role,
  checks,
}: {
  role: string;
  checks: OnboardingChecks;
}) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [celebrateVisible, setCelebrateVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const steps =
    role === "photographer"
      ? getPhotographerSteps(checks)
      : getClientSteps(checks);

  const completedCount = steps.filter((s) => s.complete).length;
  const totalSteps = steps.length;
  const allDone = completedCount === totalSteps;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored === "true") {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, []);

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
  }, [allDone, mounted, dismissed]);

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
          {"You're all set!"}
        </h2>
        <p className="mt-2 text-gray-500">
          Your profile is complete. You&apos;re ready to{" "}
          {role === "photographer" ? "start receiving bookings" : "find your perfect photographer"}!
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-warm-200 bg-gradient-to-br from-warm-50 via-white to-primary-50/30 shadow-sm">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-primary-500 to-accent-500" />

      <div className="p-6 pl-7">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-gray-900">
              Complete your profile
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {completedCount} of {totalSteps} steps done
            </p>
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
            aria-label="Dismiss checklist"
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
