"use client";

import { memo, useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import type { DisconnectReason } from "livekit-client";
import "@livekit/components-styles";

interface Props {
  bookingId: string;
  /** Token already minted by the "start" call; recipients pass null and we mint on consent. */
  initialToken: { token: string; url: string } | null;
  onClose: () => void;
}

// The actual room, isolated behind memo with ONLY stable props (two strings
// + one stable callback). The chat page re-renders every few seconds (SSE
// poll, presence) and LiveKitRoom reconnects when its callback props change
// identity — without this barrier the call drops and rejoins in a loop
// (server logs showed CLIENT_REQUEST_LEAVE every ~15s).
const CallRoom = memo(function CallRoom({
  url,
  token,
  onEnd,
}: {
  url: string;
  token: string;
  onEnd: (failed: boolean, message?: string) => void;
}) {
  const everConnected = useRef(false);
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      video
      audio
      onConnected={() => {
        everConnected.current = true;
      }}
      onError={(e) => {
        console.warn("[video-call] error:", e);
        if (!everConnected.current) onEnd(true, e.message);
      }}
      onDisconnected={(reason?: DisconnectReason) => {
        console.warn("[video-call] disconnected, reason:", reason);
        onEnd(!everConnected.current);
      }}
      style={{ height: "100%" }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
});

// Consent screen first (GDPR: both parties must see the transcription notice
// BEFORE connecting), then the embedded LiveKit room. Loaded via next/dynamic
// only when a call is opened — the LiveKit bundle is heavy.
export default function VideoCallModal({ bookingId, initialToken, onClose }: Props) {
  const t = useTranslations("videoCall");
  const [creds, setCreds] = useState<{ token: string; url: string } | null>(initialToken);
  const [consented, setConsented] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable identity for CallRoom's callback — the latest handlers live in
  // refs so CallRoom's props never change and it never re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tRef = useRef(t);
  tRef.current = t;
  const handleEnd = useCallback((failed: boolean, message?: string) => {
    if (failed) {
      // Never managed to connect — bounce back to the consent screen with a
      // VISIBLE error. A modal that flashes open and dies tells the user
      // nothing.
      setError(message || tRef.current("joinFailed"));
      setConsented(false);
    } else {
      onCloseRef.current();
    }
  }, []);

  const handleConsent = async () => {
    setConnecting(true);
    setError(null);
    try {
      let c = creds;
      if (!c) {
        const res = await fetch("/api/video-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: bookingId, action: "join" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        c = await res.json();
        setCreds(c);
      }
      setConsented(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("joinFailed"));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 sm:p-6">
      {!consented ? (
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="text-3xl">📹</div>
          <h2 className="mt-2 text-lg font-bold text-gray-900">{t("consentTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{t("consentText")}</p>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleConsent}
              disabled={connecting}
              className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition disabled:opacity-50"
            >
              {connecting ? t("connecting") : t("agreeJoin")}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : creds ? (
        <div className="h-full w-full max-w-5xl overflow-hidden rounded-2xl" data-lk-theme="default">
          <CallRoom url={creds.url} token={creds.token} onEnd={handleEnd} />
        </div>
      ) : null}
    </div>
  );
}
