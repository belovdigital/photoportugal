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

export function ResponseTimeBadge() {
  const t = useTranslations("activity");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <svg className="h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {t("responseTime")}
    </span>
  );
}
