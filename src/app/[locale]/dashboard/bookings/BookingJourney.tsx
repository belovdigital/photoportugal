"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface BookingJourneyProps {
  status: string;
  paymentStatus: string | null;
  deliveryAccepted: boolean;
  isPhotographer: boolean;
  shootDate: string | null;
  deliveryToken: string | null;
}

interface Step {
  label: string;
  hint: string;
  completed: boolean;
  isCurrent: boolean;
  isCancelled: boolean;
}

const STATUS_ORDER = ["inquiry", "pending", "confirmed", "completed", "delivered"];

function statusIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx === -1 ? -1 : idx;
}

export function BookingJourney({
  status,
  paymentStatus,
  deliveryAccepted,
  isPhotographer,
}: BookingJourneyProps) {
  const t = useTranslations("bookingJourney");

  const isCancelled = status === "cancelled";
  const si = statusIndex(status);

  const stepDefs = isPhotographer
    ? [
        { labelKey: "photographer.request", hintKey: "photographer.hintRequest" },
        { labelKey: "photographer.confirmed", hintKey: "photographer.hintConfirmed" },
        { labelKey: "photographer.paid", hintKey: "photographer.hintPaid" },
        { labelKey: "photographer.session", hintKey: "photographer.hintSession" },
        { labelKey: "photographer.upload", hintKey: "photographer.hintUpload" },
        { labelKey: "photographer.accepted", hintKey: "photographer.hintAccepted" },
      ]
    : [
        { labelKey: "client.booked", hintKey: "client.hintBooked" },
        { labelKey: "client.confirmed", hintKey: "client.hintConfirmed" },
        { labelKey: "client.paid", hintKey: "client.hintPaid" },
        { labelKey: "client.session", hintKey: "client.hintSession" },
        { labelKey: "client.photos", hintKey: "client.hintPhotos" },
        { labelKey: "client.accepted", hintKey: "client.hintAccepted" },
      ];

  // Determine completion for each step
  function isStepCompleted(stepIdx: number): boolean {
    switch (stepIdx) {
      case 0: // Booked/Request — always completed if booking exists
        return true;
      case 1: // Confirmed
        return si >= statusIndex("confirmed");
      case 2: // Paid
        return paymentStatus === "paid";
      case 3: // Session
        return si >= statusIndex("completed");
      case 4: // Photos/Upload
        return si >= statusIndex("delivered");
      case 5: // Accepted
        return deliveryAccepted === true;
      default:
        return false;
    }
  }

  // Build steps array
  const steps: Step[] = stepDefs.map((def, i) => {
    const completed = isStepCompleted(i);
    return {
      label: t(def.labelKey),
      hint: t(def.hintKey),
      completed,
      isCurrent: false,
      isCancelled: false,
    };
  });

  // Find current step (first incomplete step)
  if (!isCancelled) {
    const currentIdx = steps.findIndex((s) => !s.completed);
    if (currentIdx !== -1) {
      steps[currentIdx].isCurrent = true;
    }
  } else {
    // For cancelled: mark the first incomplete step as cancelled
    const cancelIdx = steps.findIndex((s) => !s.completed);
    if (cancelIdx !== -1) {
      steps[cancelIdx].isCancelled = true;
    }
  }

  return (
    <div className="mt-3">
      {/* Desktop horizontal layout */}
      <div className="hidden sm:flex items-start justify-between">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center" style={{ flex: "0 0 auto" }}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.isCancelled
                    ? "bg-red-500 text-white"
                    : step.completed
                    ? "bg-green-500 text-white"
                    : step.isCurrent
                    ? "bg-accent-600 text-white ring-2 ring-accent-200 animate-pulse"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step.isCancelled ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : step.completed ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1 text-xs text-center max-w-[72px] ${
                  step.isCancelled
                    ? "font-semibold text-red-600"
                    : step.completed
                    ? "text-green-700 font-medium"
                    : step.isCurrent
                    ? "text-accent-700 font-bold"
                    : "text-gray-400"
                }`}
              >
                {step.isCancelled ? t("cancelled") : step.label}
              </span>
              {step.isCurrent && (
                <span className="text-[11px] text-accent-600 text-center max-w-[90px] mt-0.5">
                  {step.hint}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mt-3.5">
                <div className={`h-0.5 ${step.completed ? "bg-green-400" : "bg-gray-200"}`} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile vertical layout */}
      <div className="flex sm:hidden flex-col">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.isCancelled
                    ? "bg-red-500 text-white"
                    : step.completed
                    ? "bg-green-500 text-white"
                    : step.isCurrent
                    ? "bg-accent-600 text-white ring-2 ring-accent-200 animate-pulse"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step.isCancelled ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : step.completed ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-6 ${step.completed ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
            <div className="pb-4">
              <span
                className={`text-xs ${
                  step.isCancelled
                    ? "font-semibold text-red-600"
                    : step.completed
                    ? "text-green-700 font-medium"
                    : step.isCurrent
                    ? "text-accent-700 font-bold"
                    : "text-gray-400"
                }`}
              >
                {step.isCancelled ? t("cancelled") : step.label}
              </span>
              {step.isCurrent && (
                <p className="text-[11px] text-accent-600 mt-0.5">{step.hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
