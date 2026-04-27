"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface PortfolioPhoto {
  url: string;
  photographerSlug: string;
  photographerName: string;
  photographerRating: number | null;
  locationSlug: string | null;
}

interface QuizState {
  occasion: string | null;
  when: string | null;
  vibe: string | null;
}

const QUIZ = {
  occasion: ["engagement", "family", "honeymoon", "proposal", "solo", "branding", "birthday"],
  when: ["this-week", "this-month", "few-months", "exploring"],
  vibe: ["candid", "dramatic", "romantic", "fun"],
} as const;

const STAT_KEYS = [
  "stat_photographers", "stat_rating", "stat_response", "stat_refund",
  "stat_secure", "stat_fromPrice", "stat_locations",
] as const;

export function WaitingExperience({
  locale,
  loc,
  progressPercent,
}: {
  locale: string;
  loc: string;
  progressPercent: number;
}) {
  const t = useTranslations("tryYourself");
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [quiz, setQuiz] = useState<QuizState>({ occasion: null, when: null, vibe: null });
  const [statIdx, setStatIdx] = useState(0);

  // Fetch portfolio reel (location-biased)
  useEffect(() => {
    fetch(`/api/ai-generate/portfolio-reel?loc=${encodeURIComponent(loc)}`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos || []))
      .catch(() => { /* gracefully silent */ });
  }, [loc]);

  // Auto-advance reel every 4 s
  useEffect(() => {
    if (photos.length < 2) return;
    const t = window.setInterval(() => setPhotoIdx((i) => (i + 1) % photos.length), 4000);
    return () => window.clearInterval(t);
  }, [photos.length]);

  // Auto-advance stats every 4 s, offset 2 s from photos so they don't change
  // simultaneously
  useEffect(() => {
    const t = window.setTimeout(() => {
      const interval = window.setInterval(() => setStatIdx((i) => (i + 1) % STAT_KEYS.length), 4000);
      // Store on window for cleanup
      (t as unknown as { _interval?: number })._interval = interval;
    }, 2000);
    return () => {
      window.clearTimeout(t);
      const i = (t as unknown as { _interval?: number })._interval;
      if (i) window.clearInterval(i);
    };
  }, []);

  const photographerHref = (slug: string) =>
    locale === "en" ? `/photographers/${slug}` : `/${locale}/photographers/${slug}`;

  // Build a concierge handoff link that pre-loads the quiz answers.
  const conciergeHref = useMemo(() => {
    const base = locale === "en" ? "/concierge" : `/${locale}/concierge`;
    const params = new URLSearchParams({ src: "try-yourself" });
    if (loc) params.set("loc", loc);
    if (quiz.occasion) params.set("type", quiz.occasion);
    return `${base}?${params.toString()}`;
  }, [locale, loc, quiz.occasion]);

  const quizDone = quiz.occasion && quiz.when && quiz.vibe;
  const currentPhoto = photos[photoIdx];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5 sm:space-y-6">
      {/* Progress bar — replaces the secs counter */}
      <div className="rounded-2xl bg-white border border-warm-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">{t("waitingProgress")}</p>
          <span className="text-sm font-mono text-primary-700">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-warm-100">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">{generatingHintByPercent(progressPercent, t)}</p>
      </div>

      {/* Portfolio reel */}
      {photos.length > 0 && currentPhoto && (
        <a
          href={photographerHref(currentPhoto.photographerSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="block group relative aspect-[16/10] overflow-hidden rounded-2xl border border-warm-200 bg-warm-100 shadow-md"
        >
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.url}
              src={p.url}
              alt={p.photographerName}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                i === photoIdx ? "opacity-100" : "opacity-0"
              }`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent pointer-events-none" />
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-primary-700 shadow-sm ring-1 ring-primary-200 backdrop-blur">
            {t("realPhotosBadge")}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
            <p className="font-display text-base sm:text-lg font-bold drop-shadow">{currentPhoto.photographerName}</p>
            <div className="mt-0.5 flex items-center gap-3 text-xs sm:text-sm opacity-95">
              {currentPhoto.photographerRating && (
                <span>★ {currentPhoto.photographerRating.toFixed(1)}</span>
              )}
              <span className="font-semibold tracking-wide opacity-90 group-hover:translate-x-1 transition-transform">
                {t("viewProfile")}
              </span>
            </div>
          </div>
          {/* Dot indicators */}
          <div className="absolute top-3 right-3 flex gap-1">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === photoIdx ? "w-6 bg-white" : "w-1.5 bg-white/45"
                }`}
              />
            ))}
          </div>
        </a>
      )}

      {/* Mini quiz */}
      <div className="rounded-2xl bg-white border border-warm-200 p-4 sm:p-5 shadow-sm">
        {!quizDone ? (
          <>
            <p className="font-display text-base font-bold text-gray-900">{t("quizTitle")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("quizSubtitle")}</p>

            <QuizRow
              label={t("quizOccasion")}
              value={quiz.occasion}
              options={QUIZ.occasion}
              optionLabel={(o) => t(`quizOcc_${o}`)}
              onPick={(v) => setQuiz((s) => ({ ...s, occasion: v }))}
            />
            <QuizRow
              label={t("quizWhen")}
              value={quiz.when}
              options={QUIZ.when}
              optionLabel={(o) => t(`quizWhen_${o}`)}
              onPick={(v) => setQuiz((s) => ({ ...s, when: v }))}
            />
            <QuizRow
              label={t("quizVibe")}
              value={quiz.vibe}
              options={QUIZ.vibe}
              optionLabel={(o) => t(`quizVibe_${o}`)}
              onPick={(v) => setQuiz((s) => ({ ...s, vibe: v }))}
            />
          </>
        ) : (
          <div>
            <p className="font-display text-base font-bold text-gray-900">{t("quizDoneTitle")}</p>
            <p className="text-sm text-gray-600 mt-1">{t("quizDoneBody")}</p>
            <a
              href={conciergeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-primary-700"
            >
              {t("quizDoneCta")}
            </a>
          </div>
        )}
      </div>

      {/* Stats ticker */}
      <div className="flex items-center justify-center min-h-[40px]">
        <p key={statIdx} className="text-sm text-gray-700 text-center animate-in fade-in duration-700">
          {t(STAT_KEYS[statIdx])}
        </p>
      </div>
    </div>
  );
}

function QuizRow({
  label, value, options, optionLabel, onPick,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  optionLabel: (o: string) => string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onPick(o)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? "bg-primary-600 text-white"
                  : "bg-warm-100 text-gray-700 hover:bg-warm-200"
              }`}
            >
              {optionLabel(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function generatingHintByPercent(pct: number, t: ReturnType<typeof useTranslations>): string {
  if (pct < 30) return t("hintEarly");
  if (pct < 70) return t("hintMid");
  return t("hintLong");
}
