"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { trackBookOpen } from "@/lib/track-events";

export function AskQuestionButton({ photographerId, photographerName, photographerSlug, autoOpen, existingBookingId }: { photographerId: string; photographerName: string; /** Enables photographer-stats book_open telemetry on modal open. */ photographerSlug?: string; autoOpen?: boolean; /** SSR-detected existing thread with this photographer — when set, the button deep-links to that chat instead of opening the inquiry modal. */ existingBookingId?: string | null }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  // SSR-safe pathname — window is undefined on the server, so a render-time
  // `window.location.pathname` falls back to "" and the shareable link
  // becomes /auth/signup?callbackUrl=%23message (path lost). usePathname()
  // returns the real path both on SSR and after hydration.
  const pathname = usePathname();
  const t = useTranslations("askQuestion");
  const isPhotographer = (session?.user as { role?: string } | undefined)?.role === "photographer";
  const [open, setOpen] = useState(false);

  // Photographer-stats funnel: inquiry form opened.
  useEffect(() => {
    if (open && photographerSlug) trackBookOpen(photographerSlug, "inquiry_modal");
  }, [open, photographerSlug]);

  // Auto-open when navigating from card with #message hash, AND when the
  // hash later changes to #message (e.g. the mobile StickyBookBar uses
  // href="#message" to scroll-and-open the dialog from the same page).
  useEffect(() => {
    function syncHash() {
      if (window.location.hash !== "#message") return;
      // Existing thread → skip the inquiry modal entirely and route the
      // viewer to the existing chat. Avoids a parallel inquiry row AND
      // an empty modal where the photographer's prior messages are
      // invisible.
      if (existingBookingId && session?.user) {
        // Clear the hash before navigating so a back-button to the
        // profile doesn't re-trigger the navigation in a loop.
        window.history.replaceState(null, "", window.location.pathname);
        router.push(`/dashboard/messages/${existingBookingId}` as never);
        return;
      }
      if (session?.user) {
        setOpen(true);
      } else if (session === null) {
        const returnUrl = window.location.pathname + "#message";
        router.replace(`/auth/signup?callbackUrl=${encodeURIComponent(returnUrl)}`);
      }
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [session, autoOpen, router, existingBookingId]);

  // Keep the URL in sync with the dialog so users can copy a shareable link.
  function openDialog() {
    // Same deep-link short-circuit as the hashchange handler — covers
    // direct button clicks (which don't go through the hash flow).
    if (existingBookingId && session?.user) {
      router.push(`/dashboard/messages/${existingBookingId}` as never);
      return;
    }
    setOpen(true);
    if (typeof window !== "undefined" && window.location.hash !== "#message") {
      window.history.replaceState(null, "", window.location.pathname + "#message");
    }
  }

  function closeDialog() {
    setOpen(false);
    if (typeof window !== "undefined" && window.location.hash === "#message") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!session?.user) {
    const returnUrl = `${pathname}#message`;
    return (
      <Link
        href={`/auth/signup?callbackUrl=${encodeURIComponent(returnUrl)}`}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 whitespace-nowrap"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {t("message")}
      </Link>
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");

    const { getAllAttribution } = await import("@/lib/attribution");
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photographer_id: photographerId, message: message.trim(), ...getAllAttribution() }),
    });

    setSending(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/messages/${data.booking_id}`);
    } else {
      const data = await res.json();
      setError(data.error || t("failedToSend"));
    }
  }

  if (isPhotographer) return null;

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 whitespace-nowrap"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {t("message")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDialog} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">{t("dialogTitle", { name: photographerName })}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("dialogSubtitle")}</p>

            {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleSend} className="mt-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t("placeholder")}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
                autoFocus
              />
              <div className="mt-4 flex gap-3">
                <button type="submit" disabled={sending || !message.trim()}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {sending ? t("sending") : t("sendMessage")}
                </button>
                <button type="button" onClick={closeDialog}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
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
