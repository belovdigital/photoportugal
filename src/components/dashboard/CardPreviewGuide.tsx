"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { locations as ALL_LOCATIONS } from "@/lib/locations-data";
import type { PhotographerProfile, Package } from "@/types";

/** The dashboard's own package row — description is nullable there. */
interface DashboardPackage {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
  is_public: boolean;
  features: string[];
}

/**
 * "This is your card, this is what a visitor decides on."
 *
 * Photographers see their profile page constantly and their CARD almost
 * never — yet the card is the whole decision. Measured 2026-08-03: the
 * platform's card CTR is 3.5%, and the ten photographers sitting at zero
 * clicks on 50+ impressions were the ones whose cover had no faces, no
 * recognisable Portugal, or marketing text baked into the image, while
 * the clicked ones all showed faces in a place you can name.
 *
 * It renders the REAL catalog card (a hand-built lookalike drifted from
 * it immediately — missing the avatar, badges, chips and CTA), in
 * `preview` mode so it neither navigates nor logs an impression against
 * its own owner. The width switch matters because the cover height is
 * fixed at h-56 while the card width comes from the grid: 1 column on a
 * phone, 3 columns on a desktop, so the same photo is cropped
 * differently in each.
 */
export function CardPreviewGuide({
  profile,
  packages,
  portfolioThumbs,
  quote,
}: {
  profile: {
    id: string;
    user_id?: string;
    slug: string;
    name: string;
    tagline: string | null;
    bio: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    cover_position_y: number;
    languages: string[];
    shoot_types: string[];
    hourly_rate: number | null;
    currency?: string | null;
    experience_years: number;
    plan: string;
    rating: number | string;
    review_count: number;
    session_count: number;
    is_verified?: boolean;
    is_featured?: boolean;
    is_founding?: boolean;
    created_at?: string;
    last_seen_at?: string | null;
    avg_response_minutes?: number | null;
    location_slugs: string[];
  };
  packages: DashboardPackage[];
  portfolioThumbs: string[];
  quote?: { text: string; client_name: string | null };
}) {
  const t = useTranslations("cardPreview");
  const [wide, setWide] = useState(true);
  // Landscape vs portrait is only knowable once the browser has the file.
  const [ratio, setRatio] = useState<number | null>(null);

  const tagline = (profile.tagline || "").trim();
  const publicPackages: Package[] = packages
    .filter((p) => p.is_public)
    .map((p) => ({ ...p, description: p.description || "" }));

  const card: PhotographerProfile = {
    id: profile.id,
    user_id: profile.user_id || "",
    slug: profile.slug,
    name: profile.name,
    tagline,
    bio: profile.bio || "",
    avatar_url: profile.avatar_url,
    cover_url: profile.cover_url,
    cover_position_y: profile.cover_position_y ?? 50,
    languages: profile.languages || [],
    hourly_rate: profile.hourly_rate ?? 0,
    currency: profile.currency || "EUR",
    locations: (profile.location_slugs || [])
      .map((slug) => ALL_LOCATIONS.find((l) => l.slug === slug))
      .filter((l): l is (typeof ALL_LOCATIONS)[number] => Boolean(l)),
    packages: publicPackages,
    shoot_types: profile.shoot_types || [],
    experience_years: profile.experience_years,
    is_verified: Boolean(profile.is_verified),
    is_featured: Boolean(profile.is_featured),
    is_founding: Boolean(profile.is_founding),
    plan: (profile.plan as PhotographerProfile["plan"]) || "free",
    rating: Number(profile.rating) || 0,
    review_count: profile.review_count,
    session_count: profile.session_count,
    created_at: profile.created_at || "",
    last_seen_at: profile.last_seen_at ?? null,
    avg_response_minutes: profile.avg_response_minutes ?? null,
    portfolio_thumbs: portfolioThumbs,
  };

  const checks: { key: string; ok: boolean | null }[] = [
    { key: "cover", ok: Boolean(profile.cover_url) },
    { key: "landscape", ok: ratio === null ? null : ratio >= 1.2 },
    { key: "tagline", ok: tagline.length > 0 },
    { key: "price", ok: publicPackages.length > 0 },
    { key: "reviews", ok: profile.review_count > 0 },
  ];
  const reminders = ["faces", "place", "noText"];

  return (
    <div className="rounded-2xl border border-warm-200 bg-warm-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{t("title")}</h3>
          <p className="mt-1 text-xs text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex rounded-lg border border-warm-200 bg-white p-0.5 text-xs">
          {([true, false] as const).map((w) => (
            <button
              key={String(w)}
              type="button"
              onClick={() => setWide(w)}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                wide === w ? "bg-primary-600 text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {w ? t("viewDesktop") : t("viewMobile")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[auto_1fr]">
        {/* The catalog's own card, at the width the catalog gives it */}
        <div
          className="mx-auto w-full"
          style={{ maxWidth: wide ? 400 : 340 }}
          // A preview must not act as a link — the photographer's own
          // clicks are noise, and "View Profile" here is confusing.
          onClickCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <PhotographerCard photographer={card} quote={quote} preview />
          {profile.cover_url && (
            // Off-screen probe: the card's own <img> is inside a scroller
            // we don't control, so measure the file separately.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.cover_url}
              alt=""
              aria-hidden
              className="hidden"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalHeight > 0) setRatio(img.naturalWidth / img.naturalHeight);
              }}
            />
          )}
        </div>

        {/* The rules, with everything checkable already checked */}
        <div>
          <ul className="space-y-1.5 text-xs">
            {checks.map((c) => (
              <li key={c.key} className="flex gap-2">
                <span className={c.ok === false ? "text-primary-600" : c.ok === null ? "text-gray-300" : "text-accent-600"}>
                  {c.ok === false ? "✗" : c.ok === null ? "•" : "✓"}
                </span>
                <span className={c.ok === false ? "text-gray-900" : "text-gray-500"}>
                  {c.ok === false ? t(`check_${c.key}_bad`) : t(`check_${c.key}`)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-medium text-gray-700">{t("judgementTitle")}</p>
          <ul className="mt-1 space-y-1.5 text-xs text-gray-500">
            {reminders.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-warm-500">•</span>
                <span>{t(`remind_${r}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t("evidence")}</p>
        </div>
      </div>
    </div>
  );
}
