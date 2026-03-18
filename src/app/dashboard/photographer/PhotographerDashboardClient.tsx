"use client";

import { useState, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "next/navigation";
import { SHOOT_TYPES, LANGUAGES } from "@/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Profile {
  id: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  languages: string[];
  shoot_types: string[];
  hourly_rate: number | null;
  experience_years: number;
  plan: string;
  rating: number;
  review_count: number;
  session_count: number;
  is_approved: boolean;
  location_slugs: string[];
}

interface PortfolioItem {
  id: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  location_slug: string | null;
  shoot_type: string | null;
  sort_order: number;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
  delivery_days: number;
}

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  client_avatar: string | null;
  package_name: string | null;
  duration_minutes: number | null;
  num_photos: number | null;
  status: string;
  shoot_date: string | null;
  shoot_time: string | null;
  total_price: number | null;
  message: string | null;
  created_at: string;
  payment_status: string | null;
  delivery_accepted: boolean;
}

interface LocationOption {
  slug: string;
  name: string;
  region: string;
}

type Tab = "profile" | "portfolio" | "packages" | "bookings";

export function PhotographerDashboardClient({
  profile,
  portfolioItems,
  packages,
  bookings,
  allLocations,
  initialTab,
}: {
  profile: Profile;
  portfolioItems: PortfolioItem[];
  packages: Package[];
  bookings: Booking[];
  allLocations: LocationOption[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || "profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(profile.languages);
  const [selectedShootTypes, setSelectedShootTypes] = useState<string[]>(profile.shoot_types);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(profile.location_slugs);
  const [hourlyRate, setHourlyRate] = useState(profile.hourly_rate?.toString() ?? "");
  const [experienceYears, setExperienceYears] = useState(profile.experience_years.toString());

  // Package form state
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgDuration, setPkgDuration] = useState("");
  const [pkgPhotos, setPkgPhotos] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgPopular, setPkgPopular] = useState(false);
  const [pkgDeliveryDays, setPkgDeliveryDays] = useState("7");

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  function toggleItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  // === Profile ===
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/dashboard/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        tagline,
        bio,
        languages: selectedLanguages,
        shoot_types: selectedShootTypes,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        experience_years: parseInt(experienceYears) || 0,
        locations: selectedLocations,
      }),
    });

    setSaving(false);
    if (res.ok) {
      showMessage("Profile saved!");
      router.refresh();
    } else {
      showMessage("Error saving profile");
    }
  }

  // === Portfolio ===
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPortfolio(true);
    const total = files.length;
    let uploaded = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      showMessage(`Uploading ${i + 1} of ${total}...`);
      const formData = new FormData();
      formData.append("file", files[i]);

      try {
        const res = await fetch("/api/dashboard/portfolio", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          uploaded++;
          const data = await res.json();
          if (data.item) {
            setLocalItems((prev) => [...prev, data.item]);
          }
          showMessage(`${uploaded} of ${total} uploaded`);
        } else {
          failed++;
          const data = await res.json();
          console.error(`Upload failed for ${files[i].name}:`, data.error);
        }
      } catch {
        failed++;
        console.error(`Upload error for ${files[i].name}`);
      }
    }

    setUploadingPortfolio(false);
    if (failed === 0) {
      showMessage(`${uploaded} photo${uploaded !== 1 ? "s" : ""} uploaded!`);
    } else {
      showMessage(`${uploaded} uploaded, ${failed} failed`);
    }
    e.target.value = "";
  }

  const [portfolioFilter, setPortfolioFilter] = useState<{ location: string; shootType: string }>({ location: "", shootType: "" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} photo${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    for (const id of selectedIds) {
      await fetch(`/api/dashboard/portfolio?id=${id}`, { method: "DELETE" });
    }
    setLocalItems((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    showMessage(`${selectedIds.size} photo${selectedIds.size !== 1 ? "s" : ""} deleted`);
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  async function deletePhoto(id: string) {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch(`/api/dashboard/portfolio?id=${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function updatePhotoTag(itemId: string, field: "location_slug" | "shoot_type", value: string) {
    const item = portfolioItems.find((p) => p.id === itemId);
    if (!item) return;
    await fetch("/api/dashboard/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: itemId,
        location_slug: field === "location_slug" ? (value || null) : item.location_slug,
        shoot_type: field === "shoot_type" ? (value || null) : item.shoot_type,
      }),
    });
    router.refresh();
  }

  const [localItems, setLocalItems] = useState(portfolioItems);
  // Sync only when items are added/removed (not on reorder)
  const serverIds = portfolioItems.map((p) => p.id).sort().join(",");
  const localIds = localItems.map((p) => p.id).sort().join(",");
  if (serverIds !== localIds) {
    setLocalItems(portfolioItems);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((p) => p.id === active.id);
    const newIndex = localItems.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(reordered);

    // Save in background
    fetch("/api/dashboard/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorder",
        items: reordered.map((item, i) => ({ id: item.id, sort_order: i })),
      }),
    });
  }

  const activeDragItem = activeDragId ? localItems.find((p) => p.id === activeDragId) : null;

  // Portfolio filters: only show tags that exist
  const usedLocations = [...new Set(localItems.map((p) => p.location_slug).filter(Boolean))] as string[];
  const usedShootTypes = [...new Set(localItems.map((p) => p.shoot_type).filter(Boolean))] as string[];

  const filteredPortfolio = localItems.filter((item) => {
    if (portfolioFilter.location && item.location_slug !== portfolioFilter.location) return false;
    if (portfolioFilter.shootType && item.shoot_type !== portfolioFilter.shootType) return false;
    return true;
  });

  // === Packages ===
  function openNewPackage() {
    setEditingPackage(null);
    setPkgName("");
    setPkgDesc("");
    setPkgDuration("60");
    setPkgPhotos("30");
    setPkgPrice("");
    setPkgPopular(false);
    setPkgDeliveryDays("7");
    setShowPackageForm(true);
  }

  function openEditPackage(pkg: Package) {
    setEditingPackage(pkg);
    setPkgName(pkg.name);
    setPkgDesc(pkg.description || "");
    setPkgDuration(pkg.duration_minutes.toString());
    setPkgPhotos(pkg.num_photos.toString());
    setPkgPrice(pkg.price.toString());
    setPkgPopular(pkg.is_popular);
    setPkgDeliveryDays((pkg.delivery_days || 7).toString());
    setShowPackageForm(true);
  }

  async function savePackage(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body = {
      id: editingPackage?.id,
      name: pkgName,
      description: pkgDesc,
      duration_minutes: parseInt(pkgDuration),
      num_photos: parseInt(pkgPhotos),
      price: parseFloat(pkgPrice),
      is_popular: pkgPopular,
      delivery_days: parseInt(pkgDeliveryDays) || 7,
    };

    const res = await fetch("/api/dashboard/packages", {
      method: editingPackage ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      showMessage(editingPackage ? "Package updated!" : "Package created!");
      setShowPackageForm(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      showMessage(data?.error || "Error saving package");
    }
  }

  async function deletePackage(id: string) {
    if (!confirm("Delete this package?")) return;
    const res = await fetch(`/api/dashboard/packages?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showMessage("Package deleted");
      router.refresh();
    }
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "bookings", label: `Bookings${pendingBookings > 0 ? ` (${pendingBookings} new)` : bookings.length > 0 ? ` (${bookings.length})` : ""}` },
    { key: "profile", label: "Profile" },
    { key: "portfolio", label: `Portfolio (${portfolioItems.length})` },
    { key: "packages", label: `Packages (${packages.length})` },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Photographer Dashboard
          </h1>
          <p className="mt-1 text-gray-500">
            Manage your profile, portfolio, and packages
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-600 uppercase">
            {profile.plan} plan
          </span>
          {profile.is_approved && (
            <a
              href={`/photographers/${profile.slug}`}
              target="_blank"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              View Public Profile
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Rating", value: profile.rating ? `${profile.rating}/5` : "—" },
          { label: "Reviews", value: profile.review_count },
          { label: "Sessions", value: profile.session_count },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8 overflow-x-auto border-b border-warm-200">
        <div className="flex gap-6 whitespace-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 pb-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* === PROFILE TAB === */}
      <div className="mt-8">
        {activeTab === "profile" && (
          <form onSubmit={saveProfile} className="max-w-2xl space-y-6">
            {/* Avatar */}
            <AvatarUpload initialUrl={profile.avatar_url} fallbackChar={profile.display_name.charAt(0)} onMessage={showMessage} />

            {/* Cover Image */}
            <CoverUpload initialUrl={profile.cover_url} onMessage={showMessage} />

            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={200}
                placeholder="e.g., Capturing Lisbon's soul through light and emotion"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                placeholder="Tell potential clients about yourself, your style, and your experience..."
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleItem(selectedLanguages, lang, setSelectedLanguages)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedLanguages.includes(lang)
                        ? "bg-primary-600 text-white"
                        : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Shoot Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Shoot Types</label>
              <div className="flex flex-wrap gap-2">
                {SHOOT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleItem(selectedShootTypes, type, setSelectedShootTypes)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedShootTypes.includes(type)
                        ? "bg-primary-600 text-white"
                        : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Locations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locations you cover</label>
              {(() => {
                const maxLocations = profile.plan === "premium" ? Infinity : profile.plan === "pro" ? 5 : 1;
                const atLimit = selectedLocations.length >= maxLocations;
                return (
                  <>
                    <p className="text-xs text-gray-400 mb-2">
                      {selectedLocations.length}/{maxLocations === Infinity ? "unlimited" : maxLocations} locations selected
                      {maxLocations !== Infinity && atLimit && " (limit reached)"}
                      {maxLocations !== Infinity && <> &middot; <a href="/dashboard/subscriptions" className="text-primary-600 hover:underline">Upgrade for more</a></>}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {allLocations.map((loc) => {
                        const isSelected = selectedLocations.includes(loc.slug);
                        const isDisabled = !isSelected && atLimit;
                        return (
                          <label
                            key={loc.slug}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                              isSelected ? "bg-primary-50 text-primary-700" : isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-warm-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => { if (!isDisabled) toggleItem(selectedLocations, loc.slug, setSelectedLocations); }}
                              disabled={isDisabled}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            {loc.name}
                          </label>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
                <input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  min="0"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hourly Rate (EUR)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  min="0"
                  step="10"
                  placeholder="150"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        )}

        {/* === PORTFOLIO TAB === */}
        {activeTab === "portfolio" && (
          <div>
            {/* Header + Upload */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-500">
                {localItems.length} photo{localItems.length !== 1 ? "s" : ""}{!selectMode && " \u00B7 Drag to reorder"}
                {selectMode && selectedIds.size > 0 && ` \u00B7 ${selectedIds.size} selected`}
              </p>
              <div className="flex items-center gap-2">
                {localItems.length > 0 && (
                  selectMode ? (
                    <>
                      <button
                        onClick={() => setSelectedIds(new Set(filteredPortfolio.map((p) => p.id)))}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deleteSelected}
                        disabled={selectedIds.size === 0}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
                      >
                        Delete ({selectedIds.size})
                      </button>
                      <button
                        onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectMode(true)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Select
                    </button>
                  )
                )}
                {!selectMode && (
                  <label className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${uploadingPortfolio ? "cursor-not-allowed bg-primary-400" : "cursor-pointer bg-primary-600 hover:bg-primary-700"}`}>
                    {uploadingPortfolio ? "Uploading..." : "Upload Photos"}
                    <input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" disabled={uploadingPortfolio} />
                  </label>
                )}
              </div>
            </div>

            {/* Filters — only show if there are tagged photos */}
            {(usedLocations.length > 0 || usedShootTypes.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPortfolioFilter({ location: "", shootType: "" })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    !portfolioFilter.location && !portfolioFilter.shootType
                      ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-500 hover:bg-warm-200"
                  }`}
                >
                  All ({localItems.length})
                </button>
                {usedLocations.map((slug) => (
                  <button
                    key={slug}
                    onClick={() => setPortfolioFilter((f) => ({ ...f, location: f.location === slug ? "" : slug }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      portfolioFilter.location === slug
                        ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {allLocations.find((l) => l.slug === slug)?.name || slug}
                  </button>
                ))}
                {usedShootTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setPortfolioFilter((f) => ({ ...f, shootType: f.shootType === type ? "" : type }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      portfolioFilter.shootType === type
                        ? "bg-accent-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}

            {/* Photo grid with drag & drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredPortfolio.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredPortfolio.map((item) => (
                    <SortablePhotoCard
                      key={item.id}
                      item={item}
                      allLocations={allLocations}
                      onDelete={deletePhoto}
                      onUpdateTag={updatePhotoTag}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                  {localItems.length === 0 && (
                    <div className="col-span-full rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
                      <p className="text-gray-400">No photos yet. Upload your first photo to get started!</p>
                    </div>
                  )}
                  {localItems.length > 0 && filteredPortfolio.length === 0 && (
                    <div className="col-span-full py-8 text-center">
                      <p className="text-gray-400">No photos match this filter.</p>
                    </div>
                  )}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragItem && (
                  <div className="rounded-xl border-2 border-primary-400 bg-white shadow-2xl ring-4 ring-primary-200/50" style={{ width: 200 }}>
                    <div className="aspect-square overflow-hidden rounded-t-xl bg-warm-100">
                      <img src={activeDragItem.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* === PACKAGES TAB === */}
        {activeTab === "packages" && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Create packages that clients can book
              </p>
              <button
                onClick={openNewPackage}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                Add Package
              </button>
            </div>

            {/* Package form */}
            {showPackageForm && (
              <form onSubmit={savePackage} className="mt-6 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingPackage ? "Edit Package" : "New Package"}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Package Name</label>
                    <input
                      type="text"
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      required
                      placeholder="e.g., Golden Hour Session"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={pkgDesc}
                      onChange={(e) => setPkgDesc(e.target.value)}
                      rows={2}
                      placeholder="Describe what's included..."
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                    <input
                      type="number"
                      value={pkgDuration}
                      onChange={(e) => setPkgDuration(e.target.value)}
                      required
                      min="15"
                      step="15"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Number of Photos</label>
                    <input
                      type="number"
                      value={pkgPhotos}
                      onChange={(e) => setPkgPhotos(e.target.value)}
                      required
                      min="1"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price (EUR)</label>
                    <input
                      type="number"
                      value={pkgPrice}
                      onChange={(e) => setPkgPrice(e.target.value)}
                      required
                      min="1"
                      step="1"
                      placeholder="e.g. 149"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                    <p className="mt-1 text-xs text-gray-400">Whole euros, any amount</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Time (days)</label>
                    <input
                      type="number"
                      value={pkgDeliveryDays}
                      onChange={(e) => setPkgDeliveryDays(e.target.value)}
                      min="1"
                      max="90"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                    <p className="mt-1 text-xs text-gray-400">How many days to deliver edited photos</p>
                  </div>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3">
                      <input
                        type="checkbox"
                        checked={pkgPopular}
                        onChange={(e) => setPkgPopular(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Mark as most popular</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editingPackage ? "Update Package" : "Create Package"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPackageForm(false)}
                    className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Packages list */}
            <div className="mt-6 space-y-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-xl border border-warm-200 bg-white p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                        {pkg.is_popular && (
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">
                            Most Popular
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="mt-1 text-sm text-gray-500">{pkg.description}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        {pkg.duration_minutes} min &middot; {pkg.num_photos} photos &middot; {pkg.delivery_days || 7} day delivery
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">&euro;{pkg.price}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => openEditPackage(pkg)}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePackage(pkg.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {packages.length === 0 && !showPackageForm && (
                <div className="rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
                  <p className="text-gray-400">No packages yet. Create your first package to start receiving bookings!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === BOOKINGS TAB === */}
        {activeTab === "bookings" && (
          <div>
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onUpdate={() => router.refresh()} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
                <p className="text-gray-400">No booking requests yet. Share your profile to start receiving bookings!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortablePhotoCard({
  item,
  allLocations,
  onDelete,
  onUpdateTag,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: PortfolioItem;
  allLocations: LocationOption[];
  onDelete: (id: string) => void;
  onUpdateTag: (id: string, field: "location_slug" | "shoot_type", value: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: selectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group overflow-hidden rounded-xl border bg-white ${selected ? "border-primary-500 ring-2 ring-primary-300" : "border-warm-200"}`}>
      {/* Image — drag handle or select */}
      <div
        className={`relative aspect-square bg-warm-100 ${selectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
        {...(selectMode ? { onClick: () => onToggleSelect?.(item.id) } : { ...attributes, ...listeners })}
      >
        <img
          src={item.url}
          alt={item.caption || "Portfolio photo"}
          className="h-full w-full object-cover pointer-events-none select-none"
          draggable={false}
          loading="lazy"
        />
        {selectMode ? (
          <div className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 ${selected ? "border-primary-500 bg-primary-500" : "border-white bg-white/70"}`}>
            {selected && (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition group-hover:opacity-100">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          </>
        )}
      </div>
      {/* Tags — not draggable */}
      <div className="flex flex-col gap-1.5 p-2.5">
        <select
          value={item.location_slug || ""}
          onChange={(e) => onUpdateTag(item.id, "location_slug", e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded border border-warm-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-primary-400"
        >
          <option value="">Location</option>
          {allLocations.map((l) => (
            <option key={l.slug} value={l.slug}>{l.name}</option>
          ))}
        </select>
        <select
          value={item.shoot_type || ""}
          onChange={(e) => onUpdateTag(item.id, "shoot_type", e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded border border-warm-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-primary-400"
        >
          <option value="">Shoot type</option>
          {SHOOT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  delivered: "bg-accent-100 text-accent-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const TIME_LABELS: Record<string, string> = {
  sunrise: "Sunrise (6-8 AM)",
  morning: "Morning (8-11 AM)",
  midday: "Midday (11 AM-2 PM)",
  afternoon: "Afternoon (2-5 PM)",
  golden_hour: "Golden Hour (5-7 PM)",
  sunset: "Sunset (7-9 PM)",
};

function BookingCard({ booking, onUpdate }: { booking: Booking; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(false);
    if (res.ok) onUpdate();
  }

  return (
    <div className="rounded-xl border border-warm-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600 overflow-hidden">
            {booking.client_avatar ? (
              <img src={booking.client_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              booking.client_name.charAt(0)
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{booking.client_name}</p>
            <p className="text-sm text-gray-500">{booking.client_email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </span>
          {booking.payment_status === "paid" && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Paid</span>
          )}
          {booking.status !== "cancelled" && booking.total_price && booking.payment_status !== "paid" && booking.status !== "pending" && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">Unpaid</span>
          )}
          {booking.delivery_accepted && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Accepted</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        {booking.package_name && <span>{booking.package_name}</span>}
        {booking.shoot_date && (
          <span>{new Date(booking.shoot_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
        )}
        {booking.shoot_time && <span>{TIME_LABELS[booking.shoot_time] || booking.shoot_time}</span>}
        {booking.total_price && <span>&euro;{booking.total_price}</span>}
      </div>

      {booking.message && (
        <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
      )}

      <div className="mt-4 flex gap-3">
        {booking.status === "pending" && (
          <>
            <button
              onClick={() => updateStatus("confirmed")}
              disabled={updating}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => updateStatus("cancelled")}
              disabled={updating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}

        {booking.status === "confirmed" && (
          <button
            onClick={() => updateStatus("completed")}
            disabled={updating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Mark as Completed
          </button>
        )}
        <a
          href={`/dashboard/messages?chat=${booking.id}`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Message
        </a>
      </div>
    </div>
  );
}

function getCroppedBlob(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error("Canvas is empty")); }, "image/jpeg", 0.92);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

function AvatarUpload({ initialUrl, fallbackChar, onMessage }: { initialUrl: string | null; fallbackChar: string; onMessage: (msg: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => { setPreviewUrl(initialUrl); }, [initialUrl]);

  const onCropComplete = useCallback((_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { onMessage("File too large (max 10MB)"); e.target.value = ""; return; }
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) { onMessage("Only images allowed"); e.target.value = ""; return; }
    setCropSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    e.target.value = "";
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return;
    setUploading(true);
    onMessage("Uploading photo...");
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      setPreviewUrl(URL.createObjectURL(blob));
      setCropSrc(null);
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        onMessage("Photo updated!");
      } else {
        const err = await res.json().catch(() => null);
        setPreviewUrl(initialUrl);
        onMessage(err?.error || "Upload failed");
      }
    } catch {
      setPreviewUrl(initialUrl);
      onMessage("Upload failed — check your connection");
    }
    setUploading(false);
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 overflow-hidden">
            {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : fallbackChar}
          </div>
          <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            {uploading ? "Uploading..." : "Upload Photo"}
            <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFileSelect} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCropSrc(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-warm-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Adjust Your Photo</h3>
              <p className="text-xs text-gray-400 mt-1">Zoom and drag to position your profile photo</p>
            </div>
            <div className="relative h-72 sm:h-80 bg-gray-900">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="px-6 py-3 border-t border-warm-100 bg-warm-50">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-warm-200 px-6 py-4">
              <button type="button" onClick={() => setCropSrc(null)} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleCropConfirm} disabled={uploading} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
                {uploading ? "Uploading..." : "Save Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CoverUpload({ initialUrl, onMessage }: { initialUrl: string | null; onMessage: (msg: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setPreviewUrl(initialUrl); }, [initialUrl]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { onMessage("File too large (max 10MB)"); e.target.value = ""; return; }
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) { onMessage("Only images allowed"); e.target.value = ""; return; }

    setPreviewUrl(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "cover");
    setUploading(true);
    onMessage("Uploading cover...");

    try {
      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        onMessage("Cover updated!");
      } else {
        const err = await res.json().catch(() => null);
        setPreviewUrl(initialUrl);
        onMessage(err?.error || "Upload failed");
      }
    } catch {
      setPreviewUrl(initialUrl);
      onMessage("Upload failed — check your connection");
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
      <p className="text-xs text-gray-400 mb-2">Landscape photo, min 1200px wide. Will be displayed responsively on your public profile.</p>
      <div className="flex items-center gap-4">
        {previewUrl ? (
          <div className="h-20 w-40 overflow-hidden rounded-lg bg-warm-100">
            <img src={previewUrl} alt="Cover" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-20 w-40 items-center justify-center rounded-lg bg-gradient-to-br from-primary-300 to-primary-600 text-xs text-white/60">No cover</div>
        )}
        <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          {uploading ? "Uploading..." : "Upload Cover"}
          <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
