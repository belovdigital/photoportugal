"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const MAX_DURATION = 60;
const MIN_DURATION = 10;

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function VideoReviewRecorder({
  bookingId,
  photographerName,
  onClose,
}: {
  bookingId: string;
  photographerName: string;
  onClose: (submitted?: boolean) => void;
}) {
  const t = useTranslations("reviewForm.video");
  const router = useRouter();

  const [step, setStep] = useState<"intro" | "setup" | "recording" | "preview" | "rating" | "uploading" | "done">("intro");
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [timeLeft, setTimeLeft] = useState(MAX_DURATION);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Device selection
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const mimeTypeRef = useRef("video/webm");

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Attach stream to video when recording
  useEffect(() => {
    if ((step === "setup" || step === "recording") && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [step, selectedCamera, selectedMic]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function loadDevices() {
    setError("");
    try {
      // Request permission first
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}` }));
      const mics = devices.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 4)}` }));

      setCameras(cams);
      setMicrophones(mics);
      if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);

      setStep("setup");
      // Start preview
      await startPreview(cams[0]?.deviceId, mics[0]?.deviceId);
    } catch {
      setError(t("cameraError"));
    }
  }

  async function startPreview(camId?: string, micId?: string) {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 720 }, height: { ideal: 540 } },
        audio: { deviceId: micId ? { exact: micId } : undefined },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setError(t("cameraError"));
    }
  }

  async function handleCameraChange(deviceId: string) {
    setSelectedCamera(deviceId);
    await startPreview(deviceId, selectedMic);
  }

  async function handleMicChange(deviceId: string) {
    setSelectedMic(deviceId);
    await startPreview(selectedCamera, deviceId);
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
      stopStream();
      setStep("preview");
    };

    recorder.start(1000);
    setTimeLeft(MAX_DURATION);
    setStep("recording");

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopRec();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const stopRec = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  function retake() {
    setVideoBlob(null);
    setVideoUrl("");
    setTimeLeft(MAX_DURATION);
    loadDevices();
  }

  async function submitVideoReview() {
    if (!videoBlob) return;
    setStep("uploading");
    setUploadProgress(10);

    try {
      const reviewRes = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, rating, title: "", text: "" }),
      });

      if (!reviewRes.ok) {
        const data = await reviewRes.json().catch(() => null);
        setError(data?.error || t("uploadFailed"));
        setStep("rating");
        return;
      }

      const { id: reviewId } = await reviewRes.json();
      setUploadProgress(30);

      const formData = new FormData();
      formData.append("file", videoBlob, mimeTypeRef.current.includes("mp4") ? "video-review.mp4" : "video-review.webm");
      formData.append("review_id", reviewId);

      const uploadRes = await fetch("/api/reviews/video", { method: "POST", body: formData });
      setUploadProgress(80);

      if (!uploadRes.ok) {
        setError(t("uploadFailed"));
        setStep("rating");
        return;
      }

      setUploadProgress(100);
      setStep("done");
    } catch {
      setError(t("uploadFailed"));
      setStep("rating");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={step === "done" ? () => { onClose(true); router.refresh(); } : undefined} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="font-bold text-gray-900">{t("title")}</h2>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-5">
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {/* Intro */}
          {step === "intro" && (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
                <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{t("introTitle", { name: photographerName })}</h3>
                <p className="mt-2 text-sm text-gray-500">{t("introDescription")}</p>
              </div>
              <div className="rounded-xl bg-accent-50 border border-accent-200 p-3">
                <p className="text-sm font-semibold text-accent-700">{t("discountOffer")}</p>
              </div>
              <div className="rounded-xl bg-warm-50 border border-warm-200 p-4 text-left">
                <p className="text-xs font-semibold text-gray-700 mb-2">{t("requirements")}</p>
                <ul className="space-y-1.5 text-xs text-gray-500">
                  <li className="flex items-start gap-2">
                    <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {t("reqMinDuration")}
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {t("reqOnCamera")}
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {t("reqSpeakNaturally")}
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t("reqModerated")}
                  </li>
                </ul>
              </div>
              <button onClick={loadDevices} className="w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
                {t("startRecording")}
              </button>
            </div>
          )}

          {/* Setup — device selection + preview */}
          {step === "setup" && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
              </div>

              {/* Camera selector */}
              {cameras.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("selectCamera")}</label>
                  <select value={selectedCamera} onChange={(e) => handleCameraChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none">
                    {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                  </select>
                </div>
              )}

              {/* Mic selector */}
              {microphones.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("selectMicrophone")}</label>
                  <select value={selectedMic} onChange={(e) => handleMicChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none">
                    {microphones.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
                  </select>
                </div>
              )}

              <button onClick={startRecording} className="w-full rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 flex items-center justify-center gap-2">
                <span className="h-3 w-3 rounded-full bg-white" />
                {t("startRecording")}
              </button>
            </div>
          )}

          {/* Recording */}
          {step === "recording" && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  {t("recording")} · {timeLeft}s
                </div>
              </div>
              <button onClick={stopRec} className="w-full rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700">
                {t("stopRecording")}
              </button>
            </div>
          )}

          {/* Preview */}
          {step === "preview" && videoUrl && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                <video src={videoUrl} className="h-full w-full object-cover" controls playsInline />
              </div>
              {(MAX_DURATION - timeLeft) < MIN_DURATION && (
                <p className="text-xs text-red-500 text-center">{t("tooShort", { seconds: MIN_DURATION })}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setStep("rating")} disabled={(MAX_DURATION - timeLeft) < MIN_DURATION} className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {t("useThisVideo")}
                </button>
                <button onClick={retake} className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  {t("retake")}
                </button>
              </div>
            </div>
          )}

          {/* Rating only */}
          {step === "rating" && (
            <div className="space-y-4 text-center">
              <label className="block text-sm font-medium text-gray-700">{t("rateExperience")}</label>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}>
                    <svg className={`h-10 w-10 transition ${star <= (hoverRating || rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
              <button onClick={submitVideoReview} className="w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
                {t("submitVideoReview")}
              </button>
            </div>
          )}

          {/* Uploading */}
          {step === "uploading" && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              <p className="text-sm text-gray-500">{t("uploading")}</p>
              <div className="mx-auto w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900">{t("thankYou")}</h3>
              <p className="text-sm text-gray-500">{t("videoSubmitted")}</p>
              <div className="rounded-xl bg-accent-50 border border-accent-200 p-4">
                <p className="text-sm text-accent-700">{t("discountAfterApproval")}</p>
              </div>
              <button onClick={() => { onClose(true); router.refresh(); }} className="w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
                {t("done")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
