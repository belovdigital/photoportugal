"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { trackReviewSubmitted } from "@/lib/analytics";
import { VideoReviewRecorder } from "./VideoReviewRecorder";

export function ReviewForm({ bookingId, photographerName }: { bookingId: string; photographerName: string }) {
  const router = useRouter();
  const t = useTranslations("reviewForm");
  const [open, setOpen] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    return () => {
      photoPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    const combined = [...photos, ...validFiles].slice(0, 5);
    setPhotos(combined);
    setPhotoPreviews(combined.map(f => URL.createObjectURL(f)));
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, rating, title, text }),
    });

    if (res.ok) {
      const data = await res.json();
      // Upload photos before showing success — keep submitting state on
      if (photos.length > 0 && data.id) {
        let failedCount = 0;
        for (const photo of photos) {
          try {
            const formData = new FormData();
            formData.append("file", photo);
            formData.append("review_id", data.id);
            const photoRes = await fetch("/api/reviews/photos", { method: "POST", body: formData });
            if (!photoRes.ok) failedCount++;
          } catch {
            failedCount++;
          }
        }
        if (failedCount > 0) {
          setError(t("somePhotosFailed", { count: failedCount }));
        }
      }
      setSubmitting(false);
      trackReviewSubmitted(bookingId, rating);
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1500);
    } else {
      setSubmitting(false);
      const data = await res.json().catch(() => null);
      setError(data?.error || t("failedToSubmit"));
    }
  }

  if (success) {
    return (
      <span className="text-sm font-medium text-accent-600">{t("submitted")}</span>
    );
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-100"
        >
          {t("leaveReview")}
        </button>
        <button
          onClick={() => setShowVideoRecorder(true)}
          className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 flex items-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {t("videoReview")}
        </button>
      </div>

      {showVideoRecorder && (
        <VideoReviewRecorder
          bookingId={bookingId}
          photographerName={photographerName}
          onClose={(submitted) => {
            setShowVideoRecorder(false);
            if (submitted) setSuccess(true);
          }}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label={t("leaveReview")}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">
              {t("dialogTitle", { name: photographerName })}
            </h2>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Star rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("rating")}</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5"
                    >
                      <svg
                        className={`h-8 w-8 transition ${
                          star <= (hoverRating || rating) ? "text-yellow-400" : "text-gray-200"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("titleLabel")}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("titlePlaceholder")}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
                />
              </div>

              {/* Review text */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("reviewLabel")}</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  placeholder={t("reviewPlaceholder")}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("addPhotos")}</label>
                <p className="text-xs text-gray-400 mb-2">{t("addPhotosHint")}</p>
                {photoPreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200">
                        <img src={src} alt="Review photo preview" aria-hidden="true" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 h-7 w-7 rounded-full bg-red-500 text-white text-sm flex items-center justify-center hover:bg-red-600"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                {photos.length < 5 && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 transition hover:border-primary-400 hover:text-primary-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    {t("selectPhotos")}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? t("submitting") : t("submitReview")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
