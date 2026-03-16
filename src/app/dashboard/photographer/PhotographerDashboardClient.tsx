"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  languages: string[];
  hourly_rate: number | null;
  experience_years: number;
  plan: string;
  rating: number;
  review_count: number;
  session_count: number;
}

interface PortfolioItem {
  id: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  order: number;
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

type Tab = "profile" | "portfolio" | "packages";

export function PhotographerDashboardClient({
  profile,
  portfolioItems,
  packages,
}: {
  profile: Profile;
  portfolioItems: PortfolioItem[];
  packages: Package[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [hourlyRate, setHourlyRate] = useState(profile.hourly_rate?.toString() ?? "");
  const [experienceYears, setExperienceYears] = useState(profile.experience_years.toString());

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/dashboard/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        tagline,
        bio,
        languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        experience_years: parseInt(experienceYears) || 0,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setMessage("Profile saved!");
      router.refresh();
    } else {
      setMessage("Error saving profile");
    }
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setMessage("Uploading...");
    const res = await fetch("/api/dashboard/portfolio", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setMessage("Photo uploaded!");
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(data.error || "Upload failed");
    }
    e.target.value = "";
  }

  async function deletePhoto(id: string) {
    const res = await fetch(`/api/dashboard/portfolio?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "portfolio", label: `Portfolio (${portfolioItems.length})` },
    { key: "packages", label: `Packages (${packages.length})` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          { label: "Rating", value: profile.rating || "—" },
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

      {/* Tab content */}
      <div className="mt-8">
        {activeTab === "profile" && (
          <form onSubmit={saveProfile} className="max-w-2xl space-y-6">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Languages (comma-separated)</label>
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="English, Portuguese"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
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
                className="mt-1 block w-48 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
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

        {activeTab === "portfolio" && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Upload your best work to attract clients
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

        {activeTab === "packages" && (
          <div>
            <p className="text-sm text-gray-500">
              Packages can be managed from the packages settings (coming soon).
            </p>
            <div className="mt-6 space-y-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-xl border border-warm-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                    <span className="text-xl font-bold text-gray-900">&euro;{pkg.price}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{pkg.description}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {pkg.duration_minutes} min &middot; {pkg.num_photos} photos
                    {pkg.is_popular && " · Most Popular"}
                  </p>
                </div>
              ))}
              {packages.length === 0 && (
                <p className="text-gray-400">No packages yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
