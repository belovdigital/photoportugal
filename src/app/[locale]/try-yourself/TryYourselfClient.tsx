"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import imageCompression from "browser-image-compression";

interface SceneMeta {
  id: string;
  emoji: string;
  gradient: string;
  conciergeLoc: string;
}

interface Usage {
  used: number;
  free_no_email: number;
  free_with_email: number;
  remaining: number;
  email: string | null;
  requires_email: boolean;
  blocked: boolean;
  unlimited?: boolean;
}

type Step =
  | { kind: "idle" }
  | { kind: "ready" }                          // photo + scene picked, can generate
  | { kind: "generating" }
  | { kind: "result"; imageUrl: string; conciergeLoc: string }
  | { kind: "email_gate" }                     // need email to continue
  | { kind: "limit" }                          // hit hard cap
  | { kind: "error"; msg: string };

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function TryYourselfClient({ locale, scenes }: { locale: string; scenes: SceneMeta[] }) {
  const t = useTranslations("tryYourself");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [usage, setUsage] = useState<Usage | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generatingTimerRef = useRef<number | null>(null);
  const [generatingSec, setGeneratingSec] = useState(0);

  // Load usage on mount
  useEffect(() => {
    fetch("/api/ai-generate/usage")
      .then((r) => r.json())
      .then((u: Usage) => {
        setUsage(u);
        if (u.blocked) setStep({ kind: "limit" });
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Tick generating seconds for nicer UX
  useEffect(() => {
    if (step.kind !== "generating") {
      if (generatingTimerRef.current) { window.clearInterval(generatingTimerRef.current); generatingTimerRef.current = null; }
      setGeneratingSec(0);
      return;
    }
    setGeneratingSec(0);
    generatingTimerRef.current = window.setInterval(() => setGeneratingSec((s) => s + 1), 1000);
    return () => {
      if (generatingTimerRef.current) { window.clearInterval(generatingTimerRef.current); generatingTimerRef.current = null; }
    };
  }, [step.kind]);

  async function handlePhotoSelect(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStep({ kind: "error", msg: t("errorBadType") });
      return;
    }
    if (file.size > MAX_BYTES) {
      // Try compressing
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 4,
          maxWidthOrHeight: 1600,
          useWebWorker: false, // CSP blocks the lib's CDN-hosted worker script
        });
        if (compressed.size > MAX_BYTES) {
          setStep({ kind: "error", msg: t("errorTooBig") });
          return;
        }
        file = new File([compressed], file.name, { type: compressed.type || file.type });
      } catch {
        setStep({ kind: "error", msg: t("errorTooBig") });
        return;
      }
    } else if (file.size > 1024 * 1024) {
      // Soft-compress to keep upload snappy on mobile
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1600,
          useWebWorker: false, // CSP blocks the lib's CDN-hosted worker script
        });
        file = new File([compressed], file.name, { type: compressed.type || file.type });
      } catch { /* keep original */ }
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    if (sceneId) setStep({ kind: "ready" });
    else setStep({ kind: "idle" });
  }

  function pickScene(id: string) {
    setSceneId(id);
    if (photo) setStep({ kind: "ready" });
  }

  async function pollUntilDone(genId: string, conciergeLoc: string): Promise<void> {
    // With quality="medium" gpt-image-2 typically lands in 30-90s; cap at 3 min
    // so we surface a "try again" failure instead of leaving the user staring
    // at a spinner forever (e.g. when a deploy killed the in-flight promise).
    const startedAt = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;
    while (Date.now() - startedAt < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      let r: Response;
      try { r = await fetch(`/api/ai-generate/${genId}`); }
      catch { continue; }
      if (!r.ok) continue;
      const d = await r.json().catch(() => null);
      if (!d) continue;
      if (d.status === "success" && d.image_url) {
        setStep({ kind: "result", imageUrl: d.image_url, conciergeLoc });
        return;
      }
      if (d.status === "failed") {
        setStep({ kind: "error", msg: t("errorGeneric") });
        return;
      }
    }
    setStep({ kind: "error", msg: t("errorGeneric") });
  }

  async function startGeneration(includeEmail: string | null): Promise<void> {
    if (!photo || !sceneId) return;
    setStep({ kind: "generating" });
    const fd = new FormData();
    fd.append("photo", photo);
    fd.append("scene_id", sceneId);
    if (includeEmail) fd.append("email", includeEmail);
    else if (usage?.email) fd.append("email", usage.email);

    let r: Response;
    try { r = await fetch("/api/ai-generate", { method: "POST", body: fd }); }
    catch { setStep({ kind: "error", msg: t("errorGeneric") }); return; }

    if (r.status === 402) { setStep({ kind: "email_gate" }); return; }
    if (r.status === 429) {
      const d = await r.json().catch(() => null);
      if (d?.reason === "limit_reached") { setStep({ kind: "limit" }); return; }
      setStep({ kind: "error", msg: t("errorRateLimit") });
      return;
    }
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setStep({ kind: "error", msg: d?.error || t("errorGeneric") });
      return;
    }
    const data = await r.json();
    setUsage((prev) => prev ? {
      ...prev,
      used: data.used,
      remaining: data.remaining,
      requires_email: data.requires_email_next,
      email: includeEmail || prev.email,
    } : prev);

    if (!data.id) { setStep({ kind: "error", msg: t("errorGeneric") }); return; }
    await pollUntilDone(data.id, data.concierge_loc);
  }

  function generate() {
    void startGeneration(null);
  }

  function submitEmailAndGenerate() {
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t("errorBadEmail"));
      return;
    }
    setEmailError(null);
    void startGeneration(email);
  }

  function reset() {
    setStep({ kind: "idle" });
  }

  function tryAnother() {
    setSceneId(null);
    setStep({ kind: "idle" });
  }

  const conciergeBase = locale === "en" ? "/concierge" : `/${locale}/concierge`;
  const conciergeHref = (loc?: string) =>
    `${conciergeBase}?src=try-yourself${loc ? `&loc=${encodeURIComponent(loc)}` : ""}`;

  // ===== render helpers =====

  return (
    <div className="bg-warm-50 min-h-screen">
      {/* Hero — tightly compressed; badge inline on the same line as title on desktop */}
      <section className="relative bg-gradient-to-br from-primary-50 via-warm-50 to-accent-50/40 py-3 sm:py-4">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-primary-700 shadow-sm ring-1 ring-primary-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500" />
              </span>
              {t("badge")}
            </span>
            <h1 className="font-display text-xl sm:text-2xl md:text-[28px] font-bold leading-tight text-gray-900">
              {t("title1")} <span className="text-primary-600">{t("title2")}</span>
            </h1>
          </div>
          <p className="mt-1 text-[13px] sm:text-sm text-gray-600 leading-snug max-w-2xl mx-auto">{t("subtitle")}</p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Result view */}
        {step.kind === "result" && (
          <ResultView
            imageUrl={step.imageUrl}
            conciergeHref={conciergeHref(step.conciergeLoc)}
            onTryAnother={tryAnother}
            t={t}
          />
        )}

        {/* Limit reached */}
        {step.kind === "limit" && (
          <LimitReachedView conciergeHref={conciergeHref()} t={t} />
        )}

        {/* Editor (idle / ready / generating) */}
        {(step.kind === "idle" || step.kind === "ready" || step.kind === "generating" || step.kind === "error") && (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Step 1 — Upload */}
            <section>
              <SectionHeader n={1} title={t("stepUpload")} />
              <UploadDropzone
                photoPreview={photoPreview}
                onSelect={handlePhotoSelect}
                onClear={() => { setPhoto(null); setPhotoPreview(null); setStep({ kind: "idle" }); }}
                disabled={step.kind === "generating"}
                fileInputRef={fileInputRef}
                hint={t("stepUploadHint")}
                tip={t("photoTip")}
                privacy={t("privacyNote")}
              />
            </section>

            {/* Step 2 — Pick scene */}
            <section>
              <SectionHeader n={2} title={t("stepScene")} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {scenes.map((s) => {
                  const selected = sceneId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickScene(s.id)}
                      disabled={step.kind === "generating"}
                      className={`group relative aspect-[4/5] overflow-hidden rounded-xl border-2 text-left transition ${
                        selected ? "border-primary-600 ring-2 ring-primary-300" : "border-warm-200 hover:border-primary-400"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />
                      {/* Subtle dark overlays at top and bottom for text legibility, transparent middle keeps emoji vivid */}
                      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/65 to-transparent" />

                      {/* 3-zone layout: title top, emoji centred, subtitle bottom */}
                      <div className="relative flex h-full flex-col">
                        <div className="px-3 pt-3">
                          <p className="font-display font-bold text-white leading-tight text-[15px] sm:text-base drop-shadow-md">
                            {t(`scenes.${s.id}.name`)}
                          </p>
                        </div>
                        <div className="flex-1 flex items-center justify-center text-[64px] sm:text-7xl drop-shadow-lg transition group-hover:scale-110">
                          {s.emoji}
                        </div>
                        <div className="px-3 pb-3">
                          <p className="text-[11px] sm:text-xs text-white/95 leading-snug line-clamp-2 drop-shadow">
                            {t(`scenes.${s.id}.subtitle`)}
                          </p>
                        </div>
                      </div>

                      {selected && (
                        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg ring-2 ring-white/80">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Generate button (full width below the grid) */}
            <div className="lg:col-span-2 flex flex-col items-center gap-4">
              {step.kind === "error" && (
                <div className="w-full max-w-md rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {step.msg}
                </div>
              )}

              <button
                type="button"
                onClick={generate}
                disabled={!photo || !sceneId || step.kind === "generating"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-700 active:scale-[0.99] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {step.kind === "generating" ? (
                  <>
                    <Spinner />
                    {generatingMessage(generatingSec, t)} ({generatingSec}s)
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.18-4.456A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                    {t("stepGenerate")}
                  </>
                )}
              </button>
              {step.kind === "generating" && (
                <p className="text-xs text-gray-500 max-w-xs text-center">
                  {generatingHint(generatingSec, t)}
                </p>
              )}

              {usage && step.kind !== "generating" && !usage.unlimited && (
                <p className="text-xs text-gray-500">
                  {t("remainingFree", { count: usage.remaining })}
                </p>
              )}
              {usage?.unlimited && step.kind !== "generating" && (
                <p className="text-xs text-primary-600 font-semibold">
                  ✨ Unlimited (staff)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Email gate modal */}
        {step.kind === "email_gate" && (
          <EmailGateModal
            value={emailInput}
            error={emailError}
            onChange={(v) => { setEmailInput(v); if (emailError) setEmailError(null); }}
            onSubmit={submitEmailAndGenerate}
            onCancel={reset}
            t={t}
          />
        )}
      </main>
    </div>
  );
}

// ===== sub-components =====

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
        {n}
      </span>
      <h2 className="font-display text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function UploadDropzone({
  photoPreview, onSelect, onClear, disabled, fileInputRef, hint, tip, privacy,
}: {
  photoPreview: string | null;
  onSelect: (f: File) => void;
  onClear: () => void;
  disabled: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  hint: string;
  tip: string;
  privacy: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      {photoPreview ? (
        <div className="relative aspect-square w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="Selfie preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="absolute top-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-white disabled:opacity-50"
          >
            ✕ Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onSelect(file);
          }}
          className={`flex aspect-square w-full max-w-md mx-auto flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white p-6 text-center transition ${
            dragOver ? "border-primary-500 bg-primary-50" : "border-warm-300 hover:border-primary-400"
          } disabled:opacity-50`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5v9" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900">{hint}</p>
          <p className="text-xs text-gray-500">{tip}</p>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
      <p className="mt-3 text-center text-[11px] text-gray-400 max-w-md mx-auto">
        🔒 {privacy}
      </p>
    </div>
  );
}

function ResultView({
  imageUrl, conciergeHref, onTryAnother, t,
}: {
  imageUrl: string;
  conciergeHref: string;
  onTryAnother: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-gray-900">{t("result")}</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="AI generated portrait" className="w-full h-auto" />
      </div>
      <p className="mt-3 text-center text-xs text-gray-500 italic">{t("resultDisclaimer")}</p>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
        <a
          href={imageUrl}
          download="photoportugal-ai-preview.png"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {t("downloadHd")}
        </a>
        <button
          type="button"
          onClick={onTryAnother}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          {t("tryAnother")}
        </button>
      </div>

      <Link
        href={conciergeHref}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-4 text-sm sm:text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
      >
        {t("ctaBookReal")}
      </Link>
    </div>
  );
}

function LimitReachedView({ conciergeHref, t }: { conciergeHref: string; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="max-w-md mx-auto text-center py-10">
      <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
        <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.93-11.412l-4 5A1 1 0 008 13h4a1 1 0 100-2H9.83l2.83-3.535a1 1 0 00-1.73-.877z" clipRule="evenodd" /></svg>
      </div>
      <h2 className="font-display text-2xl font-bold text-gray-900">{t("limitReachedTitle")}</h2>
      <p className="mt-3 text-gray-600">{t("limitReachedBody")}</p>
      <Link
        href={conciergeHref}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
      >
        {t("limitReachedCta")}
      </Link>
    </div>
  );
}

function EmailGateModal({
  value, error, onChange, onSubmit, onCancel, t,
}: {
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-xl font-bold text-gray-900">{t("emailGateTitle")}</h3>
        <p className="mt-2 text-sm text-gray-600">{t("emailGateBody")}</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder={t("emailGatePlaceholder")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              ✕
            </button>
            <button type="submit" className="flex-[2] rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700">
              {t("emailGateSubmit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Phase-shifting button label so the user sees something change every ~30s,
// instead of the same "generating..." for two minutes.
function generatingMessage(sec: number, t: ReturnType<typeof useTranslations>): string {
  if (sec < 30) return t("generating");
  if (sec < 60) return t("generatingMid");
  if (sec < 120) return t("generatingLate");
  return t("generatingLong");
}

// Friendly hint under the button — matches the phase, helps user understand the wait.
function generatingHint(sec: number, t: ReturnType<typeof useTranslations>): string {
  if (sec < 30) return t("hintEarly");
  if (sec < 90) return t("hintMid");
  return t("hintLong");
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
