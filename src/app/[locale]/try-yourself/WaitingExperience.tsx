"use client";

import { useEffect, useMemo, useState } from "react";
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
  occasion: [
    { id: "engagement", emoji: "💍" },
    { id: "family", emoji: "👨‍👩‍👧" },
    { id: "honeymoon", emoji: "🌅" },
    { id: "proposal", emoji: "💎" },
    { id: "solo", emoji: "🧳" },
    { id: "branding", emoji: "💼" },
    { id: "birthday", emoji: "🎂" },
  ],
  when: [
    { id: "this-week", emoji: "⚡" },
    { id: "this-month", emoji: "📅" },
    { id: "few-months", emoji: "🗓️" },
    { id: "exploring", emoji: "🔍" },
  ],
  vibe: [
    { id: "candid", emoji: "📸" },
    { id: "dramatic", emoji: "🎬" },
    { id: "romantic", emoji: "💕" },
    { id: "fun", emoji: "🎉" },
  ],
} as const;

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
  const [paused, setPaused] = useState(false);
  const [quiz, setQuiz] = useState<QuizState>({ occasion: null, when: null, vibe: null });

  // Fetch portfolio reel (location-biased) — one photo per photographer
  useEffect(() => {
    fetch(`/api/ai-generate/portfolio-reel?loc=${encodeURIComponent(loc)}`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos || []))
      .catch(() => { /* gracefully silent */ });
  }, [loc]);

  // Auto-advance reel every 7s — slow enough that users can actually look + click
  useEffect(() => {
    if (photos.length < 2 || paused) return;
    const t = window.setInterval(() => setPhotoIdx((i) => (i + 1) % photos.length), 7000);
    return () => window.clearInterval(t);
  }, [photos.length, paused]);

  const photographerHref = (slug: string) =>
    locale === "en" ? `/photographers/${slug}` : `/${locale}/photographers/${slug}`;

  const conciergeHref = useMemo(() => {
    const base = locale === "en" ? "/concierge" : `/${locale}/concierge`;
    const params = new URLSearchParams({ src: "try-yourself" });
    if (loc) params.set("loc", loc);
    if (quiz.occasion) params.set("type", quiz.occasion);
    return `${base}?${params.toString()}`;
  }, [locale, loc, quiz.occasion]);

  const quizDone = quiz.occasion && quiz.when && quiz.vibe;
  const currentPhoto = photos[photoIdx];

  const goPrev = () => { setPhotoIdx((i) => (i - 1 + photos.length) % photos.length); setPaused(true); };
  const goNext = () => { setPhotoIdx((i) => (i + 1) % photos.length); setPaused(true); };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Progress bar */}
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

      {/* Portfolio reel — bigger, slower, with prev/next arrows */}
      {photos.length > 0 && currentPhoto && (
        <div className="relative">
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
              <p className="font-display text-lg sm:text-xl font-bold drop-shadow">{currentPhoto.photographerName}</p>
              <div className="mt-1 flex items-center gap-3 text-sm opacity-95">
                {currentPhoto.photographerRating && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-300">★</span>
                    {currentPhoto.photographerRating.toFixed(1)}
                  </span>
                )}
                <span className="font-semibold tracking-wide opacity-90 group-hover:translate-x-1 transition-transform">
                  {t("viewProfile")}
                </span>
              </div>
            </div>
            {/* Counter pill */}
            <div className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur">
              {photoIdx + 1} / {photos.length}
            </div>
          </a>

          {/* Prev / Next arrows — sit on top of the anchor, stop propagation so they don't
              count as a click on the photographer link */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); goPrev(); }}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md ring-1 ring-black/10 hover:bg-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); goNext(); }}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md ring-1 ring-black/10 hover:bg-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Big stats row — 3 always-visible cards (replaces the rotating ticker) */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          big="30+"
          label={t("statBigPhotographers")}
          icon="📸"
        />
        <StatCard
          big="4.9★"
          label={t("statBigRating")}
          icon="⭐"
        />
        <StatCard
          big="€90"
          label={t("statBigFromPrice")}
          icon="💶"
        />
      </div>

      {/* Mini-quiz — full hero-card treatment, big emoji buttons */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-50 via-white to-accent-50 border-2 border-primary-200 p-5 sm:p-7 shadow-md">
        {!quizDone ? (
          <>
            <div className="text-center">
              <p className="font-display text-xl sm:text-2xl font-bold text-gray-900">
                {t("quizTitle")}
              </p>
              <p className="text-sm text-gray-600 mt-1">{t("quizSubtitle")}</p>
            </div>

            <QuizQuestion
              label={t("quizOccasion")}
              value={quiz.occasion}
              options={QUIZ.occasion}
              optionLabel={(o) => t(`quizOcc_${o}`)}
              onPick={(v) => setQuiz((s) => ({ ...s, occasion: v }))}
            />
            <QuizQuestion
              label={t("quizWhen")}
              value={quiz.when}
              options={QUIZ.when}
              optionLabel={(o) => t(`quizWhen_${o}`)}
              onPick={(v) => setQuiz((s) => ({ ...s, when: v }))}
            />
            <QuizQuestion
              label={t("quizVibe")}
              value={quiz.vibe}
              options={QUIZ.vibe}
              optionLabel={(o) => t(`quizVibe_${o}`)}
              onPick={(v) => setQuiz((s) => ({ ...s, vibe: v }))}
            />
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white text-2xl shadow-lg">
              🎯
            </div>
            <p className="mt-3 font-display text-xl font-bold text-gray-900">{t("quizDoneTitle")}</p>
            <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">{t("quizDoneBody")}</p>
            <a
              href={conciergeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
            >
              {t("quizDoneCta")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizQuestion({
  label, value, options, optionLabel, onPick,
}: {
  label: string;
  value: string | null;
  options: ReadonlyArray<{ id: string; emoji: string }>;
  optionLabel: (id: string) => string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">{label}</p>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition ${
                selected
                  ? "border-primary-600 bg-primary-600 text-white shadow-md"
                  : "border-warm-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50"
              }`}
            >
              <span className="text-2xl leading-none">{o.emoji}</span>
              <span className="text-xs font-medium leading-tight">{optionLabel(o.id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ big, label, icon }: { big: string; label: string; icon: string }) {
  return (
    <div className="rounded-xl bg-white border border-warm-200 p-3 sm:p-4 text-center shadow-sm">
      <p className="text-xs text-gray-500">{icon}</p>
      <p className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-primary-700 tabular-nums leading-none">
        {big}
      </p>
      <p className="mt-1 text-[10px] sm:text-xs text-gray-600 leading-tight">{label}</p>
    </div>
  );
}

function generatingHintByPercent(pct: number, t: ReturnType<typeof useTranslations>): string {
  if (pct < 30) return t("hintEarly");
  if (pct < 70) return t("hintMid");
  return t("hintLong");
}
