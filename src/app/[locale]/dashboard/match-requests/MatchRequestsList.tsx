"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";

interface Photographer {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  price: number | null;
  bio: string | null;
}

interface MatchRequest {
  id: string;
  location_slug: string;
  location_name: string;
  shoot_date: string | null;
  date_flexible: boolean;
  flexible_date_from: string | null;
  flexible_date_to: string | null;
  shoot_type: string;
  shoot_time: string | null;
  group_size: number;
  budget_range: string;
  message: string | null;
  admin_note: string | null;
  status: string;
  chosen_photographer_id: string | null;
  created_at: string;
  photographers: Photographer[];
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  if (reviewCount === 0) return null;
  const stars = Math.round(Number(rating));
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-primary-500">
        {"★".repeat(stars)}{"☆".repeat(5 - stars)}
      </span>
      <span className="text-warm-500">
        {Number(rating).toFixed(1)} ({reviewCount})
      </span>
    </span>
  );
}

export function MatchRequestsList({ matchRequests }: { matchRequests: MatchRequest[] }) {
  const router = useRouter();
  const t = useTranslations("matchRequests");
  const [choosingId, setChoosingId] = useState<string | null>(null);

  if (matchRequests.length === 0) {
    return (
      <div className="rounded-xl border border-warm-200 bg-white px-8 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warm-100">
          <svg className="h-8 w-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-warm-800">{t("noRequests")}</h3>
        <p className="mb-6 text-sm text-warm-500">
          {t("noRequestsDesc")}
        </p>
        <Link
          href="/find-photographer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          {t("findPhotographer")}
        </Link>
      </div>
    );
  }

  async function handleChoose(matchRequestId: string, photographer: Photographer) {
    setChoosingId(`${matchRequestId}-${photographer.id}`);
    try {
      const res = await fetch(`/api/match-request/${matchRequestId}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photographer_id: photographer.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t("error"));
        return;
      }

      router.push("/dashboard/bookings");
    } catch {
      alert(t("error"));
    } finally {
      setChoosingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {matchRequests.map((mr) => {
        const shootTypeLabel = mr.shoot_type.charAt(0).toUpperCase() + mr.shoot_type.slice(1);
        let dateStr = t("flexibleDates");
        if (mr.date_flexible && mr.flexible_date_from) {
          dateStr = `${formatDate(mr.flexible_date_from)} – ${formatDate(mr.flexible_date_to)}`;
        } else if (mr.shoot_date) {
          dateStr = formatDate(mr.shoot_date);
        }

        return (
          <div key={mr.id} className="rounded-xl border border-warm-200 bg-white shadow-sm">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warm-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-warm-900">
                  {shootTypeLabel} {t("inLocation")} {mr.location_name}
                </h2>
                <p className="mt-0.5 text-sm text-warm-500">
                  {dateStr} · {mr.group_size} {mr.group_size === 1 ? t("person") : t("people")}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  mr.status === "booked"
                    ? "bg-green-100 text-green-700"
                    : mr.status === "matched"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {mr.status === "booked" ? `${t("statusBooked")} \u2713` : mr.status === "matched" ? t("statusAwaiting") : t("statusProcessing")}
              </span>
            </div>

            {/* Admin note */}
            {mr.admin_note && (
              <div className="mx-5 mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-500">{t("teamNote")}</p>
                <p className="text-sm leading-relaxed text-blue-800">{mr.admin_note}</p>
              </div>
            )}

            {/* Photographer cards or processing message */}
            <div className="p-5">
              {mr.photographers.length === 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-5 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-blue-900">{t("processingTitle")}</p>
                  <p className="mt-1 text-sm text-blue-700">{t("processingDesc")}</p>
                </div>
              )}
              <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${mr.photographers.length === 0 ? "hidden" : ""}`}>
                {mr.photographers.map((p) => {
                  const isChosen = mr.status === "booked" && mr.chosen_photographer_id === p.id;
                  const isChoosing = choosingId === `${mr.id}-${p.id}`;

                  return (
                    <div
                      key={p.id}
                      className={`relative rounded-xl border p-4 transition ${
                        isChosen
                          ? "border-green-300 bg-green-50"
                          : "border-warm-200 bg-warm-50 hover:border-warm-300"
                      }`}
                    >
                      {isChosen && (
                        <span className="absolute right-3 top-3 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {t("selected")} ✓
                        </span>
                      )}
                      <div className="mb-3 flex items-start gap-3">
                        <Avatar src={p.avatar_url} fallback={p.name} size="lg" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-warm-900">{p.name}</p>
                          <StarRating rating={p.rating} reviewCount={p.review_count} />
                          {p.price && (
                            <p className="mt-1 text-lg font-bold text-warm-900">€{p.price}</p>
                          )}
                        </div>
                      </div>

                      {p.bio && (
                        <p className="mb-3 text-xs leading-relaxed text-warm-600">
                          {p.bio}{p.bio.length >= 148 ? "..." : ""}
                        </p>
                      )}

                      <div className="flex flex-col gap-2">
                        <a
                          href={`/photographers/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-warm-300 px-3 py-2 text-xs font-medium text-warm-700 transition hover:bg-warm-100"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {t("viewPortfolio")}
                        </a>
                        {mr.status === "matched" && (
                          <button
                            onClick={() => handleChoose(mr.id, p)}
                            disabled={!!choosingId}
                            className="flex items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                          >
                            {isChoosing ? (
                              <span className="flex items-center gap-1.5">
                                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                {t("booking")}
                              </span>
                            ) : (
                              `${t("choose")} ${p.name.split(" ")[0]}`
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
