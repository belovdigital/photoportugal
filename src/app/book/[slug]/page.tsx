"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Package {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
}

interface Photographer {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  locations: { slug: string; name: string }[];
  packages: Package[];
}

export default function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    params.then(({ slug }) => {
      fetch(`/api/photographers/${slug}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError("Photographer not found");
          } else {
            setPhotographer(data);
            if (data.packages?.length > 0) {
              const popular = data.packages.find((p: Package) => p.is_popular);
              setSelectedPackage(popular?.id || data.packages[0].id);
            }
            if (data.locations?.length > 0) {
              setSelectedLocation(data.locations[0].slug);
            }
          }
          setLoading(false);
        })
        .catch(() => {
          setError("Failed to load photographer");
          setLoading(false);
        });
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photographer) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photographer_id: photographer.id,
        package_id: selectedPackage || null,
        location_slug: selectedLocation || null,
        shoot_date: shootDate || null,
        shoot_time: shootTime || null,
        message,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to send booking request");
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in to book</h1>
          <p className="mt-2 text-gray-500">You need an account to book a photographer.</p>
          <Link href="/auth/signin" className="mt-6 inline-flex rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100">
            <svg className="h-8 w-8 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Booking Request Sent!</h1>
          <p className="mt-2 text-gray-500">
            {photographer?.display_name} will review your request and get back to you soon.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard/client" className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700">
              My Bookings
            </Link>
            <Link href="/photographers" className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">{error || "Photographer not found"}</p>
      </div>
    );
  }

  const selectedPkg = photographer.packages.find((p) => p.id === selectedPackage);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-gray-900">
        Book {photographer.display_name}
      </h1>
      <p className="mt-2 text-gray-500">Fill in the details for your photoshoot request</p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Package selection */}
        {photographer.packages.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select a package</label>
            <div className="space-y-3">
              {photographer.packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className={`flex items-center justify-between rounded-xl border-2 p-4 transition ${
                    selectedPackage === pkg.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="package"
                      value={pkg.id}
                      checked={selectedPackage === pkg.id}
                      onChange={(e) => setSelectedPackage(e.target.value)}
                      className="h-4 w-4 text-primary-600"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {pkg.name}
                        {pkg.is_popular && <span className="ml-2 text-xs text-primary-600">Most Popular</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        {pkg.duration_minutes} min &middot; {pkg.num_photos} photos
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">&euro;{pkg.price}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {photographer.locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
            >
              {photographer.locations.map((loc: { slug: string; name: string }) => (
                <option key={loc.slug} value={loc.slug}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred date</label>
            <input
              type="date"
              value={shootDate}
              onChange={(e) => setShootDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred time</label>
            <select
              value={shootTime}
              onChange={(e) => setShootTime(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Flexible</option>
              <option value="sunrise">Sunrise (6-8 AM)</option>
              <option value="morning">Morning (8-11 AM)</option>
              <option value="midday">Midday (11 AM-2 PM)</option>
              <option value="afternoon">Afternoon (2-5 PM)</option>
              <option value="golden_hour">Golden Hour (5-7 PM)</option>
              <option value="sunset">Sunset (7-9 PM)</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Message to photographer</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Tell them about your occasion, group size, any special requests..."
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
          />
        </div>

        {/* Summary */}
        {selectedPkg && (
          <div className="rounded-xl bg-warm-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">&euro;{selectedPkg.price}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">Payment will be arranged with the photographer after confirmation</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "Sending request..." : "Send Booking Request"}
        </button>
      </form>
    </div>
  );
}
