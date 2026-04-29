"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import imageCompression from "browser-image-compression";
import { WaitingExperience } from "./WaitingExperience";

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
  latest_result?: {
    gen_id: string;
    scene_id: string;
    image_urls: string[];
    scene_ids: string[];
    concierge_loc: string;
  } | null;
}

type Step =
  | { kind: "idle" }
  | { kind: "ready" }                          // photo + scene picked, can generate
  | { kind: "generating" }
  | { kind: "result"; imageUrls: string[]; sceneIds: string[]; conciergeLoc: string; sceneId: string; genId: string }
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
  // Recently-shown scene IDs — Surprise me skips these for diversity.
  const recentSceneIdsRef = useRef<string[]>([]);
  const [expectedSec, setExpectedSec] = useState<number>(90);
  const [waitingLoc, setWaitingLoc] = useState<string>("");

  // Load usage on mount. If the session already has a recent successful
  // generation, restore it so leaving and coming back doesn't lose the slider.
  useEffect(() => {
    fetch("/api/ai-generate/usage")
      .then((r) => r.json())
      .then((u: Usage) => {
        setUsage(u);
        const latest = u.latest_result;
        if (latest && latest.image_urls.length > 0) {
          setStep({
            kind: "result",
            imageUrls: latest.image_urls,
            sceneIds: latest.scene_ids,
            conciergeLoc: latest.concierge_loc,
            sceneId: latest.scene_id,
            genId: latest.gen_id,
          });
          return;
        }
        if (u.blocked) setStep({ kind: "limit" });
      })
      .catch(() => { /* ignore */ });
    // Fetch expected duration so the progress bar can scale itself
    fetch("/api/ai-generate/expected-time")
      .then((r) => r.json())
      .then((d) => { if (d?.expectedSec) setExpectedSec(d.expectedSec); })
      .catch(() => { /* keep default 90s */ });
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

  // When the user taps Generate / Surprise me / completes a generation, the
  // page swaps from the editor (where the CTA was at the bottom) to the
  // waiting/result view. Without scrolling them up, mobile users sit on the
  // old bottom of the page and don't see the new content. Auto-scroll fixes it.
  useEffect(() => {
    if (step.kind === "generating" || step.kind === "result" || step.kind === "limit") {
      // Use rAF so the layout has rendered before we scroll.
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
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

  // Capture the chosen location so WaitingExperience can pull a contextual
  // portfolio reel + concierge handoff while the generation runs.
  function loadPhotographersForLoc(loc: string) {
    setWaitingLoc(loc);
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
      if (d.status === "success") {
        const urls: string[] = (d.image_urls && d.image_urls.length) ? d.image_urls : (d.image_url ? [d.image_url] : []);
        const sceneIds: string[] = (d.scene_ids && d.scene_ids.length) ? d.scene_ids : urls.map(() => sceneIdForResult);
        if (urls.length > 0) {
          setStep({ kind: "result", imageUrls: urls, sceneIds, conciergeLoc, sceneId: sceneIdForResult, genId });
          return;
        }
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
            imageUrls={step.imageUrls}
            sceneIds={step.sceneIds}
            genId={step.genId}
            conciergeHref={conciergeHref(step.conciergeLoc)}
            onTryAnother={tryAnother}
            t={t}
          />
        )}

        {/* Limit reached */}
        {step.kind === "limit" && (
          <LimitReachedView conciergeHref={conciergeHref()} t={t} />
        )}

        {/* Generating: full-focus mode — hide upload+scenes, show WaitingExperience */}
        {step.kind === "generating" && (
          <WaitingExperience
            locale={locale}
            loc={waitingLoc}
            progressPercent={Math.min(95, (generatingSec / expectedSec) * 95)}
          />
        )}

        {/* Editor (idle / ready / error) — single vertical column,
            full-width sections, sticky CTA bar at the bottom on mobile. */}
        {(step.kind === "idle" || step.kind === "ready" || step.kind === "error") && (
          <div className="space-y-8 sm:space-y-10 pb-36 sm:pb-10">
            {/* Photo step — full drop zone before upload, slim bar after */}
            {!photoPreview ? (
              <section>
                <SectionHeader n={1} title={t("stepUpload")} />
                <UploadDropzone
                  photoPreview={null}
                  onSelect={handlePhotoSelect}
                  onClear={() => { setPhoto(null); setPhotoPreview(null); setStep({ kind: "idle" }); }}
                  disabled={false}
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
                  disabled={false}
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
                      disabled={false}
                      className={`group relative aspect-[4/5] overflow-hidden rounded-xl border-2 text-left transition ${
                        selected ? "border-primary-600 ring-2 ring-primary-300 shadow-lg" : "border-warm-200 hover:border-primary-400 hover:shadow-md"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />
                      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/65 to-transparent" />
                      <div className="relative flex h-full flex-col">
                        <div className="px-3 pt-3">
                          <p className="font-display font-bold text-white leading-tight text-base sm:text-lg drop-shadow-md">
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
              <div className="mx-auto w-full max-w-md rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
                {step.msg}
              </div>
            )}

            {/* Sticky CTA bar at bottom on mobile, inline on desktop */}
            <div className="fixed sm:static bottom-0 left-0 right-0 z-30 sm:z-auto bg-white sm:bg-transparent border-t sm:border-0 border-warm-200 px-4 py-3 sm:p-0 sm:pt-4 sm:flex sm:flex-col sm:items-center sm:gap-2">
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
  imageUrls, sceneIds, genId, conciergeHref, onTryAnother, t,
}: {
  imageUrls: string[];
  sceneIds: string[];
  genId: string;
  conciergeHref: string;
  onTryAnother: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const activeSceneId = sceneIds[0];
  const activeSceneName = (id: string) => t(`scenes.${id}.name`);
  const activeSceneSubtitle = (id: string) => t(`scenes.${id}.subtitle`);
  void activeSceneId;
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep activeIdx in sync with the scroll position (native swipe on mobile,
  // arrow click / programmatic scroll on desktop).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setActiveIdx(Math.max(0, Math.min(imageUrls.length - 1, idx)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [imageUrls.length]);

  function go(delta: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(imageUrls.length - 1, activeIdx + delta));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-gray-900">{t("result")}</h2>

      {/* Instagram-style frame */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-xl">
        {/* IG header */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
            <div className="h-full w-full rounded-full bg-white p-[2px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="" className="h-full w-full rounded-full object-cover" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">photoportugal</p>
            <p className="text-[11px] text-gray-500 leading-tight truncate">📍 {activeSceneName(sceneIds[activeIdx] || sceneIds[0])}</p>
          </div>
          <button type="button" className="text-gray-700">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/></svg>
          </button>
        </div>

        {/* Carousel — native scroll-snap on touch, arrows on desktop */}
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ aspectRatio: "1024 / 1536" }}
          >
            {imageUrls.map((url, i) => (
              <div key={i} className="snap-start shrink-0 w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={activeSceneName(sceneIds[i] || sceneIds[0])} className="h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
              </div>
            ))}
          </div>
          {/* Counter pill */}
          {imageUrls.length > 1 && (
            <div className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur">
              {activeIdx + 1} / {imageUrls.length}
            </div>
          )}
          {/* Desktop arrows (hidden on mobile — native swipe is enough) */}
          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous"
                className={`hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md ring-1 ring-black/10 hover:bg-white transition ${activeIdx === 0 ? "opacity-0 pointer-events-none" : "opacity-100"}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next"
                className={`hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md ring-1 ring-black/10 hover:bg-white transition ${activeIdx === imageUrls.length - 1 ? "opacity-0 pointer-events-none" : "opacity-100"}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
        </div>

        {/* IG action bar */}
        <div className="px-3 pt-2.5">
          <div className="flex items-center gap-3 text-gray-900">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 21l1.8-5A8 8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <div className="flex-1" />
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5v14l7-4 7 4V5a2 2 0 00-2-2H7a2 2 0 00-2 2z"/></svg>
          </div>
          {/* dot indicator */}
          {imageUrls.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {imageUrls.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === activeIdx ? "w-4 bg-primary-600" : "w-1.5 bg-gray-300"}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* IG caption — switches per active swipe slide */}
        <div className="px-3 pt-2 pb-3">
          <p className="text-sm text-gray-900">
            <span className="font-semibold">photoportugal</span>{" "}
            <span>{activeSceneSubtitle(sceneIds[activeIdx] || sceneIds[0])}</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-400 uppercase tracking-wide">{t("resultJustNow")}</p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-gray-500 italic">{t("resultDisclaimer")}</p>

      <div className="mt-5 flex flex-col sm:flex-row items-stretch gap-3">
        <a
          href={`/api/ai-generate/${genId}/download?n=${activeIdx}`}
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

