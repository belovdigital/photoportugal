"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OptimizedImage, LightboxImage } from "@/components/ui/OptimizedImage";

interface Photo {
  id: string;
  url: string;
  filename: string;
  file_size: number;
}

export function DeliveryGalleryClient({ photos, deliveryAccepted }: { photos: Photo[]; deliveryAccepted: boolean }) {
  const t = useTranslations("delivery");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function openLightbox(index: number) {
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function navigate(dir: number) {
    if (lightboxIndex === null) return;
    const next = lightboxIndex + dir;
    if (next >= 0 && next < photos.length) {
      setLightboxIndex(next);
    }
  }

  return (
    <>
      {/* Grid */}
      <div className="mt-6 columns-2 gap-3 sm:columns-3 md:columns-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="mb-3 cursor-pointer overflow-hidden rounded-lg bg-warm-100 transition hover:opacity-90"
            onClick={() => openLightbox(index)}
          >
            <OptimizedImage
              src={photo.url}
              alt={photo.filename}
              width={400}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          role="dialog"
          aria-label={t("photoViewer")}
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            aria-label={t("close")}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              aria-label={t("previous")}
              className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image — show full original in lightbox */}
          <img
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].filename}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              aria-label={t("next")}
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Counter + download */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4">
            <span className="text-sm text-white/70">
              {lightboxIndex + 1} / {photos.length}
            </span>
            {deliveryAccepted ? (
              <a
                href={photos[lightboxIndex].url}
                download={photos[lightboxIndex].filename}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("download")}
              </a>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white/50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t("acceptToDownload")}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
