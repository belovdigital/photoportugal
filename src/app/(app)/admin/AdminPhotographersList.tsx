"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AdminToggleClient, AdminPlanSelectClient, AdminDeactivatePhotographer, AdminReviewsLink } from "./AdminControls";
import { normalizeName } from "@/lib/format-name";

export interface AdminPhotographer {
  id: string;
  display_name: string;
  slug: string;
  plan: string;
  rating: number;
  review_count: number;
  session_count: number;
  is_verified: boolean;
  is_featured: boolean;
  is_approved: boolean;
  is_banned: boolean;
  created_at: string;
  email: string;
  is_founding: boolean;
  early_bird_tier: string | null;
  early_bird_expires_at: string | null;
  registration_number: number | null;
  checklist_complete: boolean;
  days_until_deactivation: number | null;
  has_avatar: boolean;
  has_cover: boolean;
  has_bio: boolean;
  portfolio_count: number;
  package_count: number;
  location_count: number;
  stripe_ready: boolean;
  has_phone: boolean;
}

const PAGE_SIZE = 20;

export function AdminPhotographersList({ photographers, previewSecret }: { photographers: AdminPhotographer[]; previewSecret: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return photographers;
    const q = search.toLowerCase();
    return photographers.filter(
      (p) => p.display_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.slug.includes(q)
    );
  }, [photographers, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name or email..."
          className="w-full rounded-xl border border-warm-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="space-y-2">
      {pageItems.map((p) => {
        const isOpen = expandedId === p.id;
        const missingSteps = getMissingSteps(p);

        return (
          <div
            key={p.id}
            className={`rounded-xl border bg-white transition-shadow ${
              !p.is_approved ? "border-red-200 bg-red-50/30" : "border-warm-200"
            } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
          >
            {/* Collapsed row — always visible */}
            <button
              onClick={() => setExpandedId(isOpen ? null : p.id)}
              className="flex w-full items-center gap-3 px-3 py-3 sm:px-4 text-left"
            >
              {/* Status dot */}
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                p.is_approved ? "bg-green-500" : p.checklist_complete ? "bg-yellow-500" : "bg-gray-300"
              }`} />

              {/* Name + email */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">{normalizeName(p.display_name)}</span>
                  {p.is_founding && (
                    <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Founding
                    </span>
                  )}
                  {!p.is_founding && p.early_bird_tier && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      p.early_bird_tier === "early50" ? "bg-primary-100 text-primary-700" : "bg-accent-50 text-accent-700"
                    }`}>
                      {p.early_bird_tier === "early50" ? "Early 25" : "First 50"}
                    </span>
                  )}
                  {!p.is_approved && !p.is_banned && p.checklist_complete && (
                    <span className="shrink-0 animate-pulse rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                      Ready
                    </span>
                  )}
                  {p.is_banned && (
                    <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                      Deactivated
                    </span>
                  )}
                  {!p.is_approved && !p.is_banned && !p.checklist_complete && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      p.days_until_deactivation !== null && p.days_until_deactivation <= 2
                        ? "bg-red-100 text-red-600"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {p.days_until_deactivation !== null ? `${p.days_until_deactivation}d left` : "Pending"}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-400">{p.email}</p>
              </div>

              {/* Quick stats — right side */}
              <div className="hidden sm:flex items-center gap-3 shrink-0">
                {p.rating > 0 && (
                  <span className="text-xs text-gray-500">{p.rating} ({p.review_count})</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  p.plan === "premium" ? "bg-purple-100 text-purple-700" :
                  p.plan === "pro" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {p.plan}
                </span>
              </div>

              {/* Chevron */}
              <svg
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded details */}
            {isOpen && (
              <div className="border-t border-warm-100 px-3 py-3 sm:px-4 sm:py-4">
                {/* Profile link */}
                <div className="mb-4">
                  <Link
                    href={`/photographers/${p.slug}${!p.is_approved ? `?preview=${previewSecret}` : ""}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    View profile
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>

                {/* Grid of controls */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {/* Approved */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Approved</label>
                    <div className="mt-1">
                      {p.checklist_complete || p.is_approved ? (
                        <AdminToggleClient id={p.id} field="is_approved" value={p.is_approved} name={normalizeName(p.display_name)} />
                      ) : (
                        <span className="text-xs text-red-400">Incomplete</span>
                      )}
                    </div>
                  </div>

                  {/* Verified */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Verified</label>
                    <div className="mt-1">
                      <AdminToggleClient id={p.id} field="is_verified" value={p.is_verified} name={normalizeName(p.display_name)} />
                    </div>
                  </div>

                  {/* Featured */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Featured</label>
                    <div className="mt-1">
                      <AdminToggleClient id={p.id} field="is_featured" value={p.is_featured} name={normalizeName(p.display_name)} />
                    </div>
                  </div>

                  {/* Plan */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Plan</label>
                    <div className="mt-1">
                      <AdminPlanSelectClient id={p.id} currentPlan={p.plan} />
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Rating</label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-700">{p.rating || "—"}</span>
                      <AdminReviewsLink photographerId={p.id} count={p.review_count} name={normalizeName(p.display_name)} />
                    </div>
                  </div>

                  {/* Early Bird */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Early Bird</label>
                    <div className="mt-1">
                      {p.registration_number && p.registration_number > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-900">#{p.registration_number}</span>
                          {p.is_founding && <span className="text-[10px] text-amber-600">Forever</span>}
                          {!p.is_founding && p.early_bird_expires_at && (
                            <span className="text-[10px] text-gray-400">
                              exp {new Date(p.early_bird_expires_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checklist — show if not complete */}
                {missingSteps.length > 0 && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3">
                    <p className="text-[11px] font-semibold text-red-700 mb-1.5">Missing steps:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingSteps.map((step) => (
                        <span key={step} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
                          {step}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Profile completeness bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Profile completeness</span>
                    <span className="text-xs font-semibold text-gray-600">{getCompleteness(p)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        getCompleteness(p) === 100 ? "bg-green-500" :
                        getCompleteness(p) >= 75 ? "bg-blue-500" :
                        getCompleteness(p) >= 50 ? "bg-yellow-500" : "bg-red-400"
                      }`}
                      style={{ width: `${getCompleteness(p)}%` }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>{p.portfolio_count} photos</span>
                  <span>{p.package_count} package{p.package_count !== 1 ? "s" : ""}</span>
                  <span>{p.location_count} location{p.location_count !== 1 ? "s" : ""}</span>
                  <span>{p.session_count} session{p.session_count !== 1 ? "s" : ""}</span>
                  <span>Joined {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-warm-100 pt-3">
                  {p.is_banned ? (
                    <>
                      <AdminDeactivatePhotographer id={p.id} name={normalizeName(p.display_name)} isActive={false} label="Reactivate" />
                      <span className="text-[10px] text-red-400">Auto-deactivated: incomplete profile after 7 days</span>
                    </>
                  ) : p.is_approved ? (
                    <AdminDeactivatePhotographer id={p.id} name={normalizeName(p.display_name)} isActive={true} />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-warm-200 bg-white px-4 py-8 text-center text-gray-400">
          {search ? "No photographers match your search" : "No photographers yet"}
        </div>
      )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-400">
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-warm-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-warm-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getMissingSteps(p: AdminPhotographer): string[] {
  const steps: string[] = [];
  if (!p.has_avatar) steps.push("Profile photo");
  if (!p.has_cover) steps.push("Cover image");
  if (!p.has_bio) steps.push("Bio & tagline");
  if (p.portfolio_count < 5) steps.push(`Portfolio (${p.portfolio_count}/5)`);
  if (p.package_count < 1) steps.push("Package");
  if (p.location_count < 1) steps.push("Locations");
  if (!p.stripe_ready) steps.push("Stripe");
  if (!p.has_phone) steps.push("Phone");
  return steps;
}

function getCompleteness(p: AdminPhotographer): number {
  const checks = [p.has_avatar, p.has_cover, p.has_bio, p.portfolio_count >= 5, p.package_count >= 1, p.location_count >= 1, p.stripe_ready, p.has_phone];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
