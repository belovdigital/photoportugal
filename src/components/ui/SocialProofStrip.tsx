"use client";

import { Camera, CheckCircle2, MapPin, ShieldCheck, Star } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Link } from "@/i18n/navigation";

const PRIMARY_DESTINATIONS = [
  "Lisbon",
  "Porto",
  "Algarve",
  "Madeira",
  "Azores",
  "Sintra",
  "Cascais",
  "Douro",
];

const AZORES_ISLANDS = ["Sao Miguel", "Terceira", "Pico", "Faial", "Flores"];

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
  const avatarsVisible = avatars.slice(0, 11);
  const avatarRemaining = Math.max(0, photographerCount - avatarsVisible.length);

  return (
    <section className="border-y border-warm-200 bg-white py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          <div className="min-w-0">
            <div className="flex items-end gap-3">
              <p className="font-display text-5xl font-bold leading-none text-gray-900 lg:text-6xl">{photographerCount}</p>
              <Camera className="mb-1.5 h-6 w-6 text-primary-600" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-600">{texts.photographers}</p>

            <div className="mt-5 flex max-w-[310px] flex-wrap items-center">
              {avatarsVisible.map((avatar, index) => (
                <Link
                  key={avatar.slug}
                  href={`/photographers/${avatar.slug}`}
                  className={`relative mb-2 mr-[-7px] h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-warm-100 shadow-sm transition hover:z-10 hover:scale-110 hover:shadow-md ${
                    index % 5 === 0 ? "h-14 w-14" : ""
                  }`}
                  aria-label={`View profile of ${avatar.name}`}
                >
                  <OptimizedImage
                    src={avatar.avatar_url}
                    alt={`${avatar.name} photographer in Portugal`}
                    width={120}
                    className="h-full w-full object-cover"
                  />
                </Link>
              ))}
              {avatarRemaining > 0 && (
                <Link
                  href="/photographers"
                  className="mb-2 ml-1 flex h-12 min-w-12 items-center justify-center rounded-full bg-primary-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 hover:shadow-md"
                  aria-label="Browse all photographers"
                >
                  +{avatarRemaining}
                </Link>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-end gap-3">
              <p className="font-display text-3xl font-bold leading-none text-primary-700 lg:text-4xl">{texts.portugalWide}</p>
              <MapPin className="mb-1 h-6 w-6 text-primary-600" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-600">{texts.coverage}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {PRIMARY_DESTINATIONS.map((destination) => (
                <span
                  key={destination}
                  className="rounded-full border border-warm-200 bg-warm-50 px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  {destination}
                </span>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">{texts.islandsCovered}</p>
              <p className="mt-1 text-xs font-medium text-accent-800">{AZORES_ISLANDS.join(" · ")}</p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-end gap-3">
              <p className="font-display text-3xl font-bold leading-none text-gray-900 lg:text-4xl">{texts.verified}</p>
              <ShieldCheck className="mb-1 h-7 w-7 text-accent-600" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-600">{texts.verifiedSub}</p>

            <div className="mt-5 flex gap-1 text-amber-400" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((star) => (
                <Star key={star} className="h-5 w-5 fill-current" />
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {[texts.realProfiles, texts.securePayment, texts.directBooking].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
