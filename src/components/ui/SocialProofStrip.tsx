"use client";

import { Camera, CheckCircle2, MapPin, ShieldCheck, Star } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Link } from "@/i18n/navigation";
import { GoogleReviewsBadge } from "@/components/ui/GoogleReviewsBadge";

const PRIMARY_DESTINATIONS = [
  "Lisbon",
  "Algarve",
  "Azores",
  "Madeira",
  "Porto",
  "Sintra",
];

const ISLAND_DESTINATIONS = ["Madeira", "Sao Miguel", "Terceira", "Pico", "Faial", "Flores"];

export function SocialProofStrip({
  photographerCount,
  avatars,
  texts,
}: {
  photographerCount: number;
  avatars: { slug: string; avatar_url: string; name: string }[];
  texts: {
    photographers: string;
    portugalWide: string;
    coverage: string;
    verified: string;
    verifiedSub: string;
    realProfiles: string;
    securePayment: string;
    directBooking: string;
    islandsCovered: string;
  };
}) {
  const avatarsVisible = avatars.slice(0, 16);
  const avatarRemaining = Math.max(0, photographerCount - avatarsVisible.length);

  return (
    <section className="border-y border-warm-200 bg-white py-9 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="font-display text-6xl font-bold leading-none text-gray-900 sm:text-7xl">{photographerCount}</p>
              <div className="pb-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  <span>{texts.photographers}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{texts.realProfiles}</p>
              </div>
            </div>

            <div className="mt-6 flex max-w-xl flex-wrap items-center gap-2">
              {avatarsVisible.map((avatar) => (
                <Link
                  key={avatar.slug}
                  href={`/photographers/${avatar.slug}`}
                  className="group relative h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-warm-100 shadow-sm ring-1 ring-warm-200 transition hover:z-10 hover:-translate-y-0.5 hover:shadow-md"
                  aria-label={`View profile of ${avatar.name}`}
                >
                  <OptimizedImage
                    src={avatar.avatar_url}
                    alt={`${avatar.name} photographer in Portugal`}
                    width={120}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </Link>
              ))}
              {avatarRemaining > 0 && (
                <Link
                  href="/photographers"
                  className="flex h-12 min-w-12 items-center justify-center rounded-full bg-primary-600 px-3 text-xs font-bold text-white shadow-sm ring-1 ring-primary-700/10 transition hover:bg-primary-700 hover:shadow-md"
                  aria-label="Browse all photographers"
                >
                  +{avatarRemaining}
                </Link>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
              {[texts.realProfiles, texts.securePayment, texts.directBooking].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/photographers"
              className="group rounded-xl border border-warm-200 bg-warm-50/70 p-5 transition hover:border-primary-200 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-2xl font-bold leading-none text-primary-700">{texts.portugalWide}</p>
                <MapPin className="h-6 w-6 text-primary-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">{texts.coverage}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {PRIMARY_DESTINATIONS.map((destination) => (
                  <span
                    key={destination}
                    className="rounded-full border border-warm-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700"
                  >
                    {destination}
                  </span>
                ))}
              </div>
            </Link>

            <Link
              href="/photographers"
              className="group rounded-xl border border-warm-200 bg-warm-50/70 p-5 transition hover:border-accent-200 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-2xl font-bold leading-none text-gray-900">{texts.verified}</p>
                <ShieldCheck className="h-6 w-6 text-accent-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">{texts.verifiedSub}</p>
              <div className="mt-4 flex gap-1 text-amber-400" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((star) => (
                  <Star key={star} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </Link>

            <Link
              href="/locations/azores"
              className="rounded-xl border border-accent-200 bg-accent-50/80 p-5 transition hover:border-accent-300 hover:bg-accent-50 sm:col-span-2"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-accent-700">{texts.islandsCovered}</p>
                  <p className="mt-1 text-sm font-semibold text-accent-900">{ISLAND_DESTINATIONS.join(" · ")}</p>
                </div>
                <div className="flex -space-x-2">
                  {ISLAND_DESTINATIONS.slice(0, 4).map((destination) => (
                    <span
                      key={destination}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent-50 bg-white text-xs font-bold text-accent-700 shadow-sm"
                      aria-hidden="true"
                    >
                      {destination.charAt(0)}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-6 flex justify-center">
            <GoogleReviewsBadge variant="full" />
          </div>
        </div>
      </div>
    </section>
  );
}
