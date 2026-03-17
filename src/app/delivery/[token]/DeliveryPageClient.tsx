"use client";

import { useState } from "react";
import { DeliveryGalleryClient } from "./DeliveryGalleryClient";

interface Photo {
  id: string;
  url: string;
  filename: string;
  file_size: number;
}

interface GalleryData {
  photographer_name: string;
  photographer_avatar: string | null;
  client_name: string;
  shoot_date: string | null;
  photos: Photo[];
  photo_count: number;
  expires_at: string;
}

export function DeliveryPageClient({
  token,
  photographerName,
  photographerAvatar,
}: {
  token: string;
  photographerName: string;
  photographerAvatar: string | null;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gallery, setGallery] = useState<GalleryData | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setGallery(data);
      } else if (res.status === 401) {
        setError("Incorrect password. Please check your messages for the correct password.");
      } else if (res.status === 410) {
        setError("This gallery has expired.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  // Password gate
  if (!gallery) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-100">
              {photographerAvatar ? (
                <img src={photographerAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary-600">{photographerName.charAt(0)}</span>
              )}
            </div>
            <h1 className="mt-4 font-display text-xl font-bold text-gray-900">{photographerName}</h1>
            <p className="mt-1 text-sm text-gray-500">has shared photos with you</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Enter gallery password
            </label>
            <p className="mt-0.5 text-xs text-gray-400">
              Check your messages from the photographer for the password
            </p>
            <input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Gallery password"
              autoFocus
              className="mt-3 w-full rounded-xl border border-warm-200 px-4 py-3 text-center text-lg tracking-widest focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="mt-4 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "View Photos"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Photo Portugal — photoportugal.com
          </p>
        </div>
      </div>
    );
  }

  // Gallery view (after password verified)
  const totalSize = gallery.photos.reduce((sum, p) => sum + (p.file_size || 0), 0);
  const expiresDate = new Date(gallery.expires_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-100">
          {photographerAvatar ? (
            <img src={photographerAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary-600">{photographerName.charAt(0)}</span>
          )}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          Your photos are ready!
        </h1>
        <p className="mt-2 text-gray-500">
          {gallery.photographer_name} &middot;{" "}
          {gallery.shoot_date
            ? new Date(gallery.shoot_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "Photo Portugal"}
        </p>
      </div>

      {/* Stats & Download */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-warm-200 bg-white p-5 sm:flex-row">
        <div className="text-sm text-gray-500">
          <strong className="text-gray-900">{gallery.photo_count}</strong> photo{gallery.photo_count !== 1 ? "s" : ""} &middot;{" "}
          {totalSize > 1024 * 1024
            ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
            : `${(totalSize / 1024).toFixed(0)} KB`}
          <span className="ml-3 text-xs text-gray-400">Expires {expiresDate}</span>
        </div>
        <a
          href={`/api/delivery/${token}/download?password=${encodeURIComponent(password)}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white hover:bg-primary-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download All (ZIP)
        </a>
      </div>

      {/* Gallery */}
      <DeliveryGalleryClient photos={gallery.photos} />

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-400">
          Delivered via <a href="https://photoportugal.com" className="text-primary-600 hover:underline">Photo Portugal</a>
        </p>
      </div>
    </div>
  );
}
