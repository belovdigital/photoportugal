"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHOOT_TYPES, LANGUAGES } from "@/types";

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
  location_slugs: string[];
}

interface PortfolioItem {
  id: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
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
  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    showMessage("Uploading...");
    const res = await fetch("/api/dashboard/portfolio", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      showMessage("Photo uploaded!");
      router.refresh();
    } else {
      const data = await res.json();
      showMessage(data.error || "Upload failed");
    }
    e.target.value = "";
  }

  async function deletePhoto(id: string) {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch(`/api/dashboard/portfolio?id=${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  // === Packages ===
  function openNewPackage() {
    setEditingPackage(null);
    setPkgName("");
    setPkgDesc("");
    setPkgDuration("60");
    setPkgPhotos("30");
    setPkgPrice("");
    setPkgPopular(false);
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
      showMessage("Error saving package");
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">
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
          <a
            href={`/photographers/${profile.slug}`}
            target="_blank"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            View Public Profile
          </a>
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
      <div className="mt-8 border-b border-warm-200">
        <div className="flex gap-6">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    profile.display_name.charAt(0)
                  )}
                </div>
                <label className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      showMessage("Uploading avatar...");
                      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
                      if (res.ok) {
                        showMessage("Avatar updated!");
                        router.refresh();
                      } else {
                        showMessage("Upload failed");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-2">Locations you cover</label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {allLocations.map((loc) => (
                  <label
                    key={loc.slug}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      selectedLocations.includes(loc.slug) ? "bg-primary-50 text-primary-700" : "hover:bg-warm-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(loc.slug)}
                      onChange={() => toggleItem(selectedLocations, loc.slug, setSelectedLocations)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {loc.name}
                  </label>
                ))}
              </div>
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Upload your best work to attract clients ({portfolioItems.length} photos)
              </p>
              <label className="cursor-pointer rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadPhoto}
                  className="hidden"
                />
              </label>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {portfolioItems.map((item) => (
                <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-warm-100">
                  <img
                    src={item.url}
                    alt={item.caption || "Portfolio photo"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => deletePhoto(item.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {portfolioItems.length === 0 && (
                <div className="col-span-full rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
                  <p className="text-gray-400">No photos yet. Upload your first photo to get started!</p>
                </div>
              )}
            </div>
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
                      min="0"
                      step="5"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
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
                        {pkg.duration_minutes} min &middot; {pkg.num_photos} photos
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
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
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}>
          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </span>
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
