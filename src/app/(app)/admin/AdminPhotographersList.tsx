"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { AdminToggleClient, AdminPlanSelectClient, AdminDeactivatePhotographer, AdminReviewsLink } from "./AdminControls";
import { AdminRevisionForm } from "./AdminRevisionForm";
import { normalizeName } from "@/lib/format-name";
import { useConfirmModal } from "@/components/ui/ConfirmModal";

export interface AdminPhotographer {
  id: string;
  user_id: string;
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
  phone: string | null;
  revision_status: string | null;
}

const PAGE_SIZE = 50;

type StatusKey = "all" | "active" | "ready_review" | "needs_revision" | "not_ready" | "deactivated";
type PlanKey = "all" | "free" | "pro" | "premium";
type BadgeKey = "all" | "founding" | "early50";
type AddonKey = "all" | "featured" | "verified" | "any" | "none";

const STATUS_OPTIONS: { key: StatusKey; label: string; dot: string }[] = [
  { key: "all", label: "All statuses", dot: "bg-gray-300" },
  { key: "active", label: "Active", dot: "bg-green-500" },
  { key: "ready_review", label: "Ready for Review", dot: "bg-emerald-500" },
  { key: "needs_revision", label: "Needs Revision", dot: "bg-amber-500" },
  { key: "not_ready", label: "Not Ready", dot: "bg-orange-500" },
  { key: "deactivated", label: "Deactivated", dot: "bg-red-500" },
];

const PLAN_OPTIONS: { key: PlanKey; label: string; dot: string }[] = [
  { key: "all", label: "All plans", dot: "bg-gray-300" },
  { key: "free", label: "Free", dot: "bg-gray-500" },
  { key: "pro", label: "Pro", dot: "bg-blue-500" },
  { key: "premium", label: "Premium", dot: "bg-indigo-500" },
];

const BADGE_OPTIONS: { key: BadgeKey; label: string; dot: string }[] = [
  { key: "all", label: "All badges", dot: "bg-gray-300" },
  { key: "founding", label: "Founding", dot: "bg-purple-500" },
  { key: "early50", label: "Early 25", dot: "bg-amber-500" },
];

const ADDON_OPTIONS: { key: AddonKey; label: string; dot: string }[] = [
  { key: "all", label: "All add-ons", dot: "bg-gray-300" },
  { key: "any", label: "Any (Featured or Verified)", dot: "bg-fuchsia-500" },
  { key: "featured", label: "Featured", dot: "bg-pink-500" },
  { key: "verified", label: "Verified", dot: "bg-sky-500" },
  { key: "none", label: "No add-ons", dot: "bg-gray-400" },
];

function matchesStatus(p: AdminPhotographer, s: StatusKey): boolean {
  switch (s) {
    case "all": return true;
    case "active": return p.is_approved && !p.is_banned;
    case "deactivated": return p.is_banned;
    case "ready_review": return !p.is_approved && p.checklist_complete && !p.is_banned && (!p.revision_status || p.revision_status === "submitted");
    case "needs_revision": return !p.is_approved && !p.is_banned && p.revision_status === "pending";
    case "not_ready": return !p.is_approved && !p.checklist_complete && !p.is_banned && !p.revision_status;
  }
}

function matchesPlan(p: AdminPhotographer, pl: PlanKey): boolean {
  if (pl === "all") return true;
  return p.plan === pl;
}

function matchesBadge(p: AdminPhotographer, b: BadgeKey): boolean {
  if (b === "all") return true;
  if (b === "founding") return p.is_founding;
  if (b === "early50") return p.early_bird_tier === "early50";
  return true;
}

function matchesAddon(p: AdminPhotographer, a: AddonKey): boolean {
  switch (a) {
    case "all": return true;
    case "featured": return p.is_featured;
    case "verified": return p.is_verified;
    case "any": return p.is_featured || p.is_verified;
    case "none": return !p.is_featured && !p.is_verified;
  }
}

export interface BelowMinPackage {
  name: string;
  duration_minutes: number;
  price: number;
}

export function AdminPhotographersList({ photographers, previewSecret, belowMinPackages = {} }: {
  photographers: AdminPhotographer[];
  previewSecret: string;
  belowMinPackages?: Record<string, BelowMinPackage[]>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("active");
  const [planFilter, setPlanFilter] = useState<PlanKey>("all");
  const [badgeFilter, setBadgeFilter] = useState<BadgeKey>("all");
  const [addonFilter, setAddonFilter] = useState<AddonKey>("all");
  const [page, setPage] = useState(0);
  const { modal, confirm } = useConfirmModal();

  const filtered = useMemo(() => {
    let list = photographers
      .filter(p => matchesStatus(p, statusFilter))
      .filter(p => matchesPlan(p, planFilter))
      .filter(p => matchesBadge(p, badgeFilter))
      .filter(p => matchesAddon(p, addonFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.display_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.slug.includes(q)
      );
    }
    return list;
  }, [photographers, search, statusFilter, planFilter, badgeFilter, addonFilter]);

  // Counts per option respecting other active filters (except the one the option belongs to).
  const statusCounts = useMemo(() => {
    const base = photographers
      .filter(p => matchesPlan(p, planFilter))
      .filter(p => matchesBadge(p, badgeFilter))
      .filter(p => matchesAddon(p, addonFilter));
    return Object.fromEntries(STATUS_OPTIONS.map(o => [o.key, base.filter(p => matchesStatus(p, o.key)).length])) as Record<StatusKey, number>;
  }, [photographers, planFilter, badgeFilter, addonFilter]);
  const planCounts = useMemo(() => {
    const base = photographers
      .filter(p => matchesStatus(p, statusFilter))
      .filter(p => matchesBadge(p, badgeFilter))
      .filter(p => matchesAddon(p, addonFilter));
    return Object.fromEntries(PLAN_OPTIONS.map(o => [o.key, base.filter(p => matchesPlan(p, o.key)).length])) as Record<PlanKey, number>;
  }, [photographers, statusFilter, badgeFilter, addonFilter]);
  const badgeCounts = useMemo(() => {
    const base = photographers
      .filter(p => matchesStatus(p, statusFilter))
      .filter(p => matchesPlan(p, planFilter))
      .filter(p => matchesAddon(p, addonFilter));
    return Object.fromEntries(BADGE_OPTIONS.map(o => [o.key, base.filter(p => matchesBadge(p, o.key)).length])) as Record<BadgeKey, number>;
  }, [photographers, statusFilter, planFilter, addonFilter]);
  const addonCounts = useMemo(() => {
    const base = photographers
      .filter(p => matchesStatus(p, statusFilter))
      .filter(p => matchesPlan(p, planFilter))
      .filter(p => matchesBadge(p, badgeFilter));
    return Object.fromEntries(ADDON_OPTIONS.map(o => [o.key, base.filter(p => matchesAddon(p, o.key)).length])) as Record<AddonKey, number>;
  }, [photographers, statusFilter, planFilter, badgeFilter]);

  const hasNonDefault = statusFilter !== "active" || planFilter !== "all" || badgeFilter !== "all" || addonFilter !== "all";

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

      {/* Grouped filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          counts={statusCounts}
          onChange={(v) => { setStatusFilter(v); setPage(0); }}
        />
        <FilterDropdown
          label="Plan"
          options={PLAN_OPTIONS}
          value={planFilter}
          counts={planCounts}
          onChange={(v) => { setPlanFilter(v); setPage(0); }}
        />
        <FilterDropdown
          label="Badge"
          options={BADGE_OPTIONS}
          value={badgeFilter}
          counts={badgeCounts}
          onChange={(v) => { setBadgeFilter(v); setPage(0); }}
        />
        <FilterDropdown
          label="Add-ons"
          options={ADDON_OPTIONS}
          value={addonFilter}
          counts={addonCounts}
          onChange={(v) => { setAddonFilter(v); setPage(0); }}
        />
        {statusCounts.ready_review > 0 && (() => {
          const active = statusFilter === "ready_review";
          return (
            <button
              onClick={() => { setStatusFilter(active ? "active" : "ready_review"); setPage(0); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
              title="Toggle photographers ready for review"
            >
              <span className={`flex h-2 w-2 rounded-full ${active ? "bg-white" : "bg-emerald-500"}`} />
              Ready for Review
              <span className={`ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white/25 text-white" : "bg-emerald-500 text-white"}`}>
                {statusCounts.ready_review}
              </span>
            </button>
          );
        })()}
        {statusCounts.not_ready > 0 && (() => {
          const active = statusFilter === "not_ready";
          return (
            <button
              onClick={() => { setStatusFilter(active ? "active" : "not_ready"); setPage(0); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                  : "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
              title="Toggle photographers with an incomplete profile"
            >
              <span className={`flex h-2 w-2 rounded-full ${active ? "bg-white" : "bg-orange-500"}`} />
              Not Ready
              <span className={`ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white/25 text-white" : "bg-orange-500 text-white"}`}>
                {statusCounts.not_ready}
              </span>
            </button>
          );
        })()}
        {hasNonDefault && (
          <button
            onClick={() => { setStatusFilter("active"); setPlanFilter("all"); setBadgeFilter("all"); setAddonFilter("all"); setPage(0); }}
            className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Reset filters
          </button>
        )}
        <span className="text-xs text-gray-400">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
      {pageItems.map((p) => {
        const isOpen = expandedId === p.id;
        const missingSteps = getMissingSteps(p);

        const checklistDone = [
          p.has_avatar, p.has_cover, p.has_bio,
          p.portfolio_count >= 5, p.package_count >= 1,
          p.location_count >= 1, p.stripe_ready, p.has_phone,
        ].filter(Boolean).length;
        const progressPct = Math.round((checklistDone / 8) * 100);
        const progressColor = progressPct >= 100 ? "#22c55e" : progressPct >= 50 ? "#eab308" : "#ef4444";

        return (
          <div
            key={p.id}
            className={`rounded-xl border bg-white transition-shadow overflow-hidden ${
              !p.is_approved ? "border-warm-300" : "border-warm-200"
            } ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
            style={!p.is_approved ? { borderLeftWidth: 3, borderLeftColor: progressColor } : undefined}
          >
            {/* Progress bar for unapproved */}
            {!p.is_approved && (
              <div className="h-1 w-full bg-warm-100">
                <div className="h-full rounded-r-full transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: progressColor }} />
              </div>
            )}
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
                      {p.early_bird_tier === "early50" ? "Early Bird" : "First 100"}
                    </span>
                  )}
                  {!p.is_approved && !p.is_banned && p.checklist_complete && !p.revision_status && (
                    <span className="shrink-0 animate-pulse rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                      Ready
                    </span>
                  )}
                  {p.revision_status === "pending" && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      Revisions Sent
                    </span>
                  )}
                  {p.revision_status === "submitted" && (
                    <span className="shrink-0 animate-pulse rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                      Fixes Submitted
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
                  {belowMinPackages[p.id] && belowMinPackages[p.id].length > 0 && (
                    <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                      ⚠ {belowMinPackages[p.id].length} pkg below min
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
                {/* Contact & profile */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
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
                  <span className="text-gray-300">|</span>
                  <a href={`mailto:${p.email}`} className="text-xs text-gray-500 hover:text-primary-600">{p.email}</a>
                  {p.phone && (
                    <>
                      <span className="text-gray-300">|</span>
                      <a href={`tel:${p.phone}`} className="text-xs text-gray-500 hover:text-primary-600">{p.phone}</a>
                    </>
                  )}
                </div>

                {/* Grid of controls */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {/* Approved */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Approved</label>
                    <div className="mt-1">
                      {/* Toggle is always visible if the account is currently approved OR banned —
                          admins must be able to reactivate without checklist nags. For never-approved
                          accounts we still gate on checklist_complete to nudge a final review pass. */}
                      {p.checklist_complete || p.is_approved || p.is_banned ? (
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

                {/* Below-minimum packages warning */}
                {belowMinPackages[p.id] && belowMinPackages[p.id].length > 0 && (
                  <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-[11px] font-semibold text-red-700 mb-1.5">⚠ Packages below minimum price:</p>
                    <div className="space-y-1">
                      {belowMinPackages[p.id].map((pkg, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className="font-medium text-red-600">{pkg.name}</span>
                          <span className="text-red-400">
                            {pkg.duration_minutes < 60 ? `${pkg.duration_minutes} min` : `${pkg.duration_minutes / 60}h`} — €{pkg.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>{p.portfolio_count} photos</span>
                  <span>{p.package_count} package{p.package_count !== 1 ? "s" : ""}</span>
                  <span>{p.location_count} location{p.location_count !== 1 ? "s" : ""}</span>
                  <span>{p.session_count} session{p.session_count !== 1 ? "s" : ""}</span>
                  <span>Joined {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>

                {/* Revisions */}
                {(p.checklist_complete || p.revision_status) && (
                  <AdminRevisionForm photographerId={p.id} photographerName={normalizeName(p.display_name)} />
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-warm-100 pt-3">
                  {p.is_banned ? (
                    <>
                      <AdminDeactivatePhotographer id={p.id} name={normalizeName(p.display_name)} isActive={false} label="Reactivate" />
                      <span className="text-[10px] text-red-400">Auto-deactivated: incomplete profile after 7 days</span>
                    </>
                  ) : p.is_approved ? (
                    <AdminDeactivatePhotographer id={p.id} name={normalizeName(p.display_name)} isActive={true} />
                  ) : (
                    // Not-ready limbo (registered, profile incomplete, not approved, not banned).
                    // Admins need an explicit Deactivate so they can clear out ghosts/no-shows
                    // without waiting for the 7-day auto-deactivation cron.
                    <AdminDeactivatePhotographer id={p.id} name={normalizeName(p.display_name)} isActive={true} />
                  )}
                  <button
                    onClick={async () => {
                      const ok = await confirm(
                        "Log in as " + normalizeName(p.display_name),
                        "You will be redirected to their dashboard.",
                        { confirmLabel: "Log in" }
                      );
                      if (!ok) return;
                      const res = await fetch("/api/admin/impersonate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: p.user_id }),
                      });
                      if (res.ok) {
                        window.open("/dashboard", "_blank");
                      } else {
                        alert("Failed to impersonate");
                      }
                    }}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
                  >
                    Log in as
                  </button>
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
      {modal}
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

function FilterDropdown<T extends string>({
  label,
  options,
  value,
  counts,
  onChange,
}: {
  label: string;
  options: { key: T; label: string; dot: string }[];
  value: T;
  counts: Record<T, number>;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const current = options.find((o) => o.key === value) || options[0];
  const isNonDefault = value !== "all";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
          isNonDefault ? "border-primary-300 bg-primary-50 text-primary-700" : "border-warm-200 bg-white text-gray-700 hover:border-primary-300"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${current.dot}`} aria-hidden />
        <span>{label}:</span>
        <span className="font-semibold">{current.label}</span>
        <span className="opacity-60">{counts[value] ?? 0}</span>
        <svg className={`h-3 w-3 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-warm-200 bg-white shadow-lg">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => { onChange(o.key); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition hover:bg-warm-50 ${
                o.key === value ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${o.dot}`} aria-hidden />
                {o.label}
              </span>
              <span className="text-[10px] text-gray-400">{counts[o.key] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
