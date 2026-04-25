"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatPublicName } from "@/lib/format-name";
import { useSwipeNavigation } from "@/lib/use-swipe";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  text: string | null;
  is_verified: boolean;
  created_at: string;
  client_name: string | null;
  client_avatar: string | null;
  photos?: { id: string; url: string }[];
  video_url?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  client_country?: string | null;
}

function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const PAGE_SIZE = 5;

export function ReviewsPaginated({
  reviews,
  reviewCount,
  rating,
  photographerName,
  photographerSlug,
}: {
  reviews: Review[];
  reviewCount: number;
  rating: number;
  photographerName: string;
  photographerSlug: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const t = useTranslations("photographers.profile");
  const tc = useTranslations("common");
  const locale = useLocale();

  const shown = reviews.slice(0, visible);
  const hasMore = visible < reviews.length;

  const displayName = (name: string | null) => (name ? formatPublicName(name) : t("privateClient"));

  // Flat list of ALL review photos across reviews (stable order).
  const allPhotos: { url: string; reviewerName: string }[] = reviews.flatMap((r) =>
    (r.photos || []).map((p) => ({
      url: p.url,
      reviewerName: displayName(r.client_name),
    }))
  );

  const navigate = useCallback((dir: number) => {
    setLightbox((prev) => {
      if (prev === null) return null;
      const next = prev + dir;
      if (next < 0 || next >= allPhotos.length) return prev;
      return next;
    });
  }, [allPhotos.length]);

  useEffect(() => {
    if (lightbox === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") navigate(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") navigate(-1);
      else if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, navigate]);

  useSwipeNavigation({
    enabled: lightbox !== null,
    onPrev: () => navigate(-1),
    onNext: () => navigate(1),
    onDismiss: () => setLightbox(null),
  });

  // Preload adjacent photos
  useEffect(() => {
    if (lightbox === null) return;
    [lightbox - 1, lightbox + 1]
      .filter((i) => i >= 0 && i < allPhotos.length)
      .forEach((i) => {
        const img = new Image();
        img.src = allPhotos[i].url;
      });
  }, [lightbox, allPhotos]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          {t("reviews")} ({reviewCount})
        </h2>
        {rating > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">{rating}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`h-5 w-5 ${i < Math.round(rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
        )}
      </div>

      {allPhotos.length > 0 && (
        <div className="mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
          <div className="flex gap-2">
            {allPhotos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightbox(i)}
                className="relative shrink-0 overflow-hidden rounded-lg border border-warm-200 transition hover:opacity-90 hover:shadow-md"
                aria-label={`Open review photo ${i + 1} of ${allPhotos.length}`}
              >
                <img
                  src={p.url}
                  alt={p.reviewerName ? `Photo from ${p.reviewerName}'s review` : "Client review photo"}
                  loading="lazy"
                  className="h-24 w-24 object-cover sm:h-28 sm:w-28"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {shown.map((review) => {
          const flag = codeToFlag(review.client_country || "");
          const monthYear = new Date(review.created_at).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-US", { month: "long", year: "numeric" });
          const packageHref = review.package_id ? `/book/${photographerSlug}?package=${review.package_id}` : null;
          // Compute photo offset for this review in the flat list
          const reviewPhotoOffset = reviews
            .slice(0, reviews.indexOf(review))
            .reduce((sum, r) => sum + (r.photos?.length || 0), 0);
          return (
          <div key={review.id} className="rounded-xl border border-warm-200 bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                {review.client_name ? (
                  review.client_name.charAt(0)
                ) : (
                  <svg className="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-1.5 text-sm font-semibold ${review.client_name ? "text-gray-900" : "text-gray-500 italic"}`}>
                  {flag && <span aria-hidden className="text-base leading-none">{flag}</span>}
                  <span className="truncate">{displayName(review.client_name)}</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {packageHref && review.package_name ? (
                    <>
                      <a href={packageHref} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        {review.package_name}
                      </a>
                      {" · "}
                    </>
                  ) : null}
                  {monthYear}
                </p>
              </div>
              {review.is_verified && (
                <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  {tc("verifiedBooking")}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className={`h-4 w-4 ${i < review.rating ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              {review.is_verified && (
                <span className="sm:hidden inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  {tc("verifiedBooking")}
                </span>
              )}
            </div>

            {review.title && <h4 className="mt-2 font-semibold text-gray-900">{review.title}</h4>}
            {review.text && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{review.text}</p>}
            {review.video_url && (
              <div className="mt-3">
                <video
                  src={review.video_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-w-sm rounded-xl border border-warm-200"
                />
              </div>
            )}
            {review.photos && review.photos.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {review.photos.map((photo, photoIdx) => {
                  const globalIdx = reviewPhotoOffset + photoIdx;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightbox(globalIdx)}
                      className="block overflow-hidden rounded-lg border border-warm-200 transition hover:opacity-90 hover:shadow-md"
                      aria-label={review.client_name ? `Open photo ${photoIdx + 1} from ${review.client_name}'s review` : `Open review photo ${photoIdx + 1}`}
                    >
                      <img
                        src={photo.url}
                        alt={review.client_name ? `Photo from ${review.client_name}'s review` : "Client review photo"}
                        className="h-20 w-20 object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          );
        })}

        {reviews.length === 0 && (
          <p className="text-gray-400">{t("noReviews")}</p>
        )}

        {hasMore && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="w-full rounded-xl border border-warm-200 py-3 text-sm font-semibold text-gray-600 transition hover:bg-warm-50"
          >
            {t("showMoreReviews", { count: reviews.length - visible })}
          </button>
        )}
      </div>

      {/* Lightbox across ALL review photos */}
      {lightbox !== null && allPhotos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          role="dialog"
          aria-label="Review photo viewer"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {lightbox > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              aria-label="Previous photo"
              className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <img
            key={lightbox}
            src={allPhotos[lightbox].url}
            alt={allPhotos[lightbox].reviewerName ? `Review photo by ${allPhotos[lightbox].reviewerName}` : "Client review photo"}
            className="h-[90vh] w-[90vw] object-contain select-none"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox < allPhotos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              aria-label="Next photo"
              className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-sm">
            <p className="text-white/80">From {allPhotos[lightbox].reviewerName}&apos;s review</p>
            <span className="text-white/50">{lightbox + 1} / {allPhotos.length}</span>
          </div>
        </div>
      )}
    </section>
  );
}
