"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import imageCompression from "browser-image-compression";

interface SceneMeta {
  id: string;
  emoji: string;
  gradient: string;
  conciergeLoc: string;
}

interface PhotographerCard {
  slug: string;
  name: string;
  coverUrl: string | null;
  avatarUrl: string | null;
  rating: number | null;
  reviewCount: number;
  minPrice: number | null;
  tagline: string | null;
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
  | { kind: "result"; imageUrl: string; conciergeLoc: string; sceneId: string; genId: string }
  | { kind: "email_gate" }                     // need email to continue
  | { kind: "limit" }                          // hit hard cap
  | { kind: "error"; msg: string };

const MAX_BYTES = 15 * 1024 * 1024;
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
  const [photographers, setPhotographers] = useState<PhotographerCard[] | null>(null);
  // Recently-shown scene IDs — Surprise me skips these for diversity.
  const recentSceneIdsRef = useRef<string[]>([]);

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
    // Only compress when we have to. The reference image goes to gpt-image-2,
    // which keys off facial detail — over-compressing hurts identity preservation.
    // Hard limit is 8 MB (server-side), so anything bigger gets squeezed down
    // to fit; everything under 8 MB is uploaded as-is.
    if (file.size > MAX_BYTES) {
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 7,                    // stay under the 8 MB hard cap
          maxWidthOrHeight: 2400,          // plenty of detail for face refs
          useWebWorker: false,             // CSP blocks the lib's CDN-hosted worker script
          initialQuality: 0.92,            // light compression, keep faces crisp
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

  // One-tap random: pick a scene + immediately fire generation. We bypass the
  // visible "selected" state so the user never sees which location was chosen
  // until the result lands — that's the whole point of "surprise me".
  async function surpriseMe() {
    if (!photo || scenes.length === 0) return;
    // Avoid the last 3 picks for variety; if we'd run out, drop oldest.
    const blocked = new Set([sceneId, ...recentSceneIdsRef.current].filter(Boolean) as string[]);
    let candidates = scenes.filter((s) => !blocked.has(s.id));
    if (candidates.length === 0) candidates = scenes;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    recentSceneIdsRef.current = [pick.id, ...recentSceneIdsRef.current].slice(0, 3);
    setSceneId(pick.id);
    setStep({ kind: "generating" });
    void loadPhotographersForLoc(pick.conciergeLoc);
    const fd = new FormData();
    fd.append("photo", photo);
    fd.append("scene_id", pick.id);
    if (usage?.email) fd.append("email", usage.email);
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
    setUsage((prev) => prev ? { ...prev, used: data.used, remaining: data.remaining } : prev);
    if (!data.id) { setStep({ kind: "error", msg: t("errorGeneric") }); return; }
    await pollUntilDone(data.id, data.concierge_loc, pick.id);
  }

  // Pre-fetch a few photographers to show during the generation wait. We grab them
  // by the picked scene's location so they're contextually relevant; falls back to
  // top photographers when there are fewer than 4 in that location.
  async function loadPhotographersForLoc(loc: string) {
    try {
      const r = await fetch(`/api/ai-generate/photographers?loc=${encodeURIComponent(loc)}`);
      if (!r.ok) return;
      const d = await r.json();
      setPhotographers(d.photographers || []);
    } catch { /* non-fatal */ }
  }

  async function pollUntilDone(genId: string, conciergeLoc: string, sceneIdForResult: string): Promise<void> {
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
        setStep({ kind: "result", imageUrl: d.image_url, conciergeLoc, sceneId: sceneIdForResult, genId });
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
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene) void loadPhotographersForLoc(scene.conciergeLoc);
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
    await pollUntilDone(data.id, data.concierge_loc, sceneId!);
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
            downloadUrl={`/api/ai-generate/${step.genId}/download`}
            sceneName={t(`scenes.${step.sceneId}.name`)}
            sceneSubtitle={t(`scenes.${step.sceneId}.subtitle`)}
            conciergeHref={conciergeHref(step.conciergeLoc)}
            onTryAnother={tryAnother}
            t={t}
          />
        )}

        {/* Limit reached */}
        {step.kind === "limit" && (
          <LimitReachedView conciergeHref={conciergeHref()} t={t} />
        )}

        {/* Editor (idle / ready / generating / error) — single vertical column,
            full-width sections, sticky CTA bar at the bottom on mobile. */}
        {(step.kind === "idle" || step.kind === "ready" || step.kind === "generating" || step.kind === "error") && (
          <div className="space-y-6 sm:space-y-8 pb-32 sm:pb-10">
            {/* Photo step — full drop zone before upload, slim bar after */}
            {!photoPreview ? (
              <section>
                <SectionHeader n={1} title={t("stepUpload")} />
                <UploadDropzone
                  photoPreview={null}
                  onSelect={handlePhotoSelect}
                  onClear={() => { setPhoto(null); setPhotoPreview(null); setStep({ kind: "idle" }); }}
                  disabled={step.kind === "generating"}
                  fileInputRef={fileInputRef}
                  hint={t("stepUploadHint")}
                  tip={t("photoTip")}
                  privacy={t("privacyNote")}
                />
              </section>
            ) : (
              <section className="flex items-center gap-3 rounded-2xl border border-warm-200 bg-white p-3 shadow-sm">
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-warm-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Selfie preview" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">{t("badge")}</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{t("stepUpload")} ✓</p>
                  <p className="text-xs text-gray-500 truncate">{t("photoTip")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={step.kind === "generating"}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  ✕
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelect(file);
                    e.target.value = "";
                  }}
                />
              </section>
            )}

            {/* Scene picker — full width, 4 cols on desktop, 3 on tablet, 2 on mobile */}
            <section>
              <SectionHeader n={2} title={t("stepScene")} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {scenes.map((s) => {
                  const selected = sceneId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickScene(s.id)}
                      disabled={step.kind === "generating"}
                      className={`group relative aspect-[4/5] overflow-hidden rounded-xl border-2 text-left transition ${
                        selected ? "border-primary-600 ring-2 ring-primary-300 shadow-lg" : "border-warm-200 hover:border-primary-400 hover:shadow-md"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />
                      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/65 to-transparent" />
                      <div className="relative flex h-full flex-col">
                        <div className="px-3 pt-3">
                          <p className="font-display font-bold text-white leading-tight text-sm sm:text-[15px] drop-shadow-md">
                            {t(`scenes.${s.id}.name`)}
                          </p>
                        </div>
                        <div className="flex-1 flex items-center justify-center text-5xl sm:text-6xl drop-shadow-lg transition group-hover:scale-110">
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

            {step.kind === "error" && (
              <div className="mx-auto w-full max-w-md rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {step.msg}
              </div>
            )}

            {/* Generating: show progress hint + waiting panel inline; CTA bar hides */}
            {step.kind === "generating" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-primary-600/30">
                  <Spinner />
                  {generatingMessage(generatingSec, t)} ({generatingSec}s)
                </div>
                <p className="text-xs text-gray-500 max-w-xs text-center">
                  {generatingHint(generatingSec, t)}
                </p>
                {photographers && photographers.length > 0 && (
                  <WaitingPanel locale={locale} photographers={photographers} t={t} />
                )}
              </div>
            ) : (
              /* Sticky CTA bar at bottom on mobile, inline on desktop */
              <div className="fixed sm:static bottom-0 left-0 right-0 z-30 sm:z-auto bg-white sm:bg-transparent border-t sm:border-0 border-warm-200 px-4 py-3 sm:p-0 sm:flex sm:flex-col sm:items-center sm:gap-2">
                <div className="flex items-stretch gap-2 sm:gap-3 max-w-3xl mx-auto">
                  <button
                    type="button"
                    onClick={generate}
                    disabled={!photo || !sceneId}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 sm:px-10 py-3.5 sm:py-4 text-base font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-700 active:scale-[0.99] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.18-4.456A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                    {t("stepGenerate")}
                  </button>
                  <button
                    type="button"
                    onClick={surpriseMe}
                    disabled={!photo}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border-2 border-primary-300 bg-white px-3 sm:px-5 py-3.5 sm:py-4 text-sm sm:text-base font-semibold text-primary-700 hover:border-primary-500 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {t("surpriseMe")}
                  </button>
                </div>
                {usage && !usage.unlimited && (
                  <p className="text-sm text-gray-600 text-center mt-3">
                    {t("remainingFree", { count: usage.remaining })}
                  </p>
                )}
                {usage?.unlimited && (
                  <div className="flex justify-center mt-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 text-primary-700 px-3 py-1 text-xs font-semibold ring-1 ring-primary-200">
                      ✨ Unlimited (staff)
                    </span>
                  </div>
                )}
              </div>
            )}
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
          className={`group flex w-full max-w-2xl mx-auto flex-row items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-white px-6 py-5 sm:py-7 text-left transition ${
            dragOver ? "border-primary-500 bg-primary-50" : "border-warm-300 hover:border-primary-400 hover:shadow-sm"
          } disabled:opacity-50`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 transition group-hover:bg-primary-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5v9" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-base">{hint}</p>
            <p className="mt-0.5 text-xs text-gray-500">{tip}</p>
          </div>
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
      {!photoPreview && (
        <p className="mt-2 text-center text-[11px] text-gray-400 max-w-2xl mx-auto">
          🔒 {privacy}
        </p>
      )}
    </div>
  );
}

function ResultView({
  imageUrl, downloadUrl, sceneName, sceneSubtitle, conciergeHref, onTryAnother, t,
}: {
  imageUrl: string;
  downloadUrl: string;
  sceneName: string;
  sceneSubtitle: string;
  conciergeHref: string;
  onTryAnother: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-gray-900">{t("result")}</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={sceneName} className="w-full h-auto" />
        <div className="px-4 py-3 border-t border-warm-200 bg-warm-50">
          <p className="font-display text-base font-bold text-gray-900">📍 {sceneName}</p>
          <p className="mt-0.5 text-xs text-gray-600">{sceneSubtitle}</p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-gray-500 italic">{t("resultDisclaimer")}</p>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
        {/* Same-origin proxy endpoint sets Content-Disposition: attachment so
            this is a real download even on Safari/iOS, where <a download> is
            otherwise ignored cross-origin. */}
        <a
          href={downloadUrl}
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

      <a
        href={conciergeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-4 text-sm sm:text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
      >
        {t("ctaBookReal")}
      </a>
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
      <a
        href={conciergeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
      >
        {t("limitReachedCta")}
      </a>
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

function WaitingPanel({
  locale, photographers, t,
}: {
  locale: string;
  photographers: PhotographerCard[];
  t: ReturnType<typeof useTranslations>;
}) {
  const photographerHref = (slug: string) =>
    locale === "en" ? `/photographers/${slug}` : `/${locale}/photographers/${slug}`;

  return (
    <div className="w-full max-w-5xl mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-center font-display text-base sm:text-lg font-semibold text-gray-900">
        {t("whileYouWait")}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {photographers.map((p) => (
          <a
            key={p.slug}
            href={photographerHref(p.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-[16/10] sm:aspect-[5/3] overflow-hidden rounded-2xl border border-warm-200 bg-warm-100 transition hover:border-primary-400 hover:shadow-xl"
          >
            {p.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.coverUrl}
                alt={p.name}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary-100 via-warm-100 to-accent-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-display font-bold text-lg leading-tight truncate drop-shadow">{p.name}</p>
              {p.tagline && (
                <p className="mt-0.5 text-sm leading-snug line-clamp-1 opacity-95 drop-shadow">{p.tagline}</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                {p.rating ? (
                  <span className="flex items-center gap-1 font-medium">
                    <span className="text-yellow-300">★</span>
                    {p.rating.toFixed(1)}
                    {p.reviewCount > 0 && <span className="opacity-85">({p.reviewCount})</span>}
                  </span>
                ) : <span />}
                {p.minPrice && (
                  <span className="font-semibold">{t("fromPrice", { price: p.minPrice })}</span>
                )}
              </div>
              <p className="mt-2 text-sm font-bold tracking-wide group-hover:translate-x-1 transition-transform">
                {t("viewProfile")}
              </p>
            </div>
          </a>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-gray-600 pt-2">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          {t("trustSecure")}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          {t("trustRefund")}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          {t("trustVerified")}
        </span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
