"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDuration } from "@/lib/package-pricing";

interface PackageProps {
  pkg: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number;
    num_photos: number;
    is_popular: boolean;
    delivery_days?: number;
  };
  photographerSlug: string;
}

function formatDescription(desc: string) {
  // Split by bullet markers: -, or newlines
  const lines = desc
    .split(/(?:\s*[•\-]\s+|\n)/)
    .map((l) => l.trim())
    .filter(Boolean);

  // If splitting produced multiple items, render as list
  if (lines.length > 1) {
    // First line might be a summary sentence
    const firstLine = lines[0];
    const rest = lines.slice(1);
    const isSummary = firstLine.length > 40 || !firstLine.includes(":") && rest.length > 2;

    return (
      <>
        {isSummary && <p className="text-sm text-gray-500">{firstLine}</p>}
        <ul className="mt-2 space-y-1.5">
          {(isSummary ? rest : lines).map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {line}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return <p className="text-sm text-gray-500">{desc}</p>;
}

export function PackageCard({ pkg, photographerSlug }: PackageProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("photographers.package");
  const tc = useTranslations("common");
  const hasDescription = pkg.description && pkg.description.trim().length > 0;

  return (
    <div
      className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
        pkg.is_popular
          ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
          : "border-warm-200 bg-white"
      }`}
    >
      {pkg.is_popular && (
        <span className="mb-2 inline-block rounded-full bg-primary-600 px-3 py-0.5 text-xs font-bold text-white">
          {t("mostPopular")}
        </span>
      )}

      {/* Header: name + price on one line */}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold text-gray-900">{pkg.name}</h3>
        <span className="shrink-0 text-2xl font-bold text-gray-900">&euro;{Math.round(Number(pkg.price))}</span>
      </div>

      {/* Key specs inline */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {formatDuration(pkg.duration_minutes)}
        </span>
        <span className="text-warm-300">|</span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {pkg.num_photos} {tc("photos")}
        </span>
        <span className="text-warm-300">|</span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {tc("dayDelivery", { days: pkg.delivery_days || 7 })}
        </span>
      </div>

      {/* Expandable description */}
      {hasDescription && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition"
          >
            {expanded ? t("hideDetails") : t("viewDetails")}
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded && (
            <div className="mt-2 rounded-lg bg-warm-50 px-3 py-2.5">
              {formatDescription(pkg.description!)}
            </div>
          )}
        </>
      )}

      <Link
        href={`/book/${photographerSlug}?package=${pkg.id}`}
        className={`mt-4 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
          pkg.is_popular
            ? "bg-primary-600 text-white hover:bg-primary-700"
            : "bg-gray-900 text-white hover:bg-gray-800"
        }`}
      >
        {t("bookThisPackage")}
      </Link>
    </div>
  );
}
