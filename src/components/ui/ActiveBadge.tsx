"use client";

import { useTranslations } from "next-intl";

type ActivityLevel = "now" | "today" | "thisWeek" | "thisMonth" | null;

function getActivityLevel(lastSeenAt: string | null | undefined): ActivityLevel {
  if (!lastSeenAt) return null;
  const last = new Date(lastSeenAt).getTime();
  const now = Date.now();
  const diff = now - last;
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return "now";
  if (hours < 24) return "today";
  if (hours < 7 * 24) return "thisWeek";
  if (hours < 30 * 24) return "thisMonth";
  return null;
}

export function ActiveBadge({ lastSeenAt, size = "sm" }: { lastSeenAt?: string | null; size?: "sm" | "md" }) {
  const t = useTranslations("activity");
  const level = getActivityLevel(lastSeenAt);
  if (!level) return null;

  const dotColor = level === "now" || level === "today" ? "bg-green-500" : "bg-green-400";
  const label = t(level);

  if (size === "sm") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${level === "now" ? "animate-pulse" : ""}`} />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
      <span className={`h-2 w-2 rounded-full ${dotColor} ${level === "now" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

export function ResponseTimeBadge({ avgMinutes, compact }: { avgMinutes?: number | null; compact?: boolean }) {
  const t = useTranslations("activity");

  let label: string;
  if (avgMinutes != null && avgMinutes > 0) {
    if (avgMinutes < 15) label = t("respondsMinutes");
    else if (avgMinutes < 60) label = t("respondsUnderHour");
    else if (avgMinutes < 180) label = t("respondsFewHours");
    else if (avgMinutes < 1440) label = t("respondsSameDay");
    else label = t("responseTime");
  } else {
    label = t("responseTime");
  }

  if (compact) {
    return <span className="text-[11px] text-gray-400">{label}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <svg className="h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {label}
    </span>
  );
}
