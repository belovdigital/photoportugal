"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

export function AskQuestionButton({ photographerId, photographerName, autoOpen }: { photographerId: string; photographerName: string; autoOpen?: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("askQuestion");
  const isPhotographer = (session?.user as { role?: string } | undefined)?.role === "photographer";
  const [open, setOpen] = useState(false);

  // Auto-open when navigating from card with #message hash
  useEffect(() => {
    if (window.location.hash === "#message") {
      if (session?.user) {
        setOpen(true);
        window.history.replaceState(null, "", window.location.pathname);
      } else if (session === null) {
        // Not logged in — redirect to sign in with return URL
        const returnUrl = window.location.pathname + "#message";
        router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`);
      }
    }
  }, [session, autoOpen, router]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
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

    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photographer_id: photographerId, message: message.trim() }),
    });

    setSending(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/messages?chat=${data.booking_id}`);
    } else {
      const data = await res.json();
      setError(data.error || t("failedToSend"));
    }
  }

  if (isPhotographer) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 whitespace-nowrap"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {t("message")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
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
                <button type="button" onClick={() => setOpen(false)}
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
