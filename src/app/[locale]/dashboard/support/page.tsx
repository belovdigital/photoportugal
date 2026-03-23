"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function SupportPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const t = useTranslations("support");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSending(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/dashboard/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });

      if (res.ok) {
        setStatus("success");
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setSending(false);
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Link href="/auth/signin" className="text-primary-600 hover:underline">{t("signInPrompt")}</Link>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-gray-500">{t("subtitle")}</p>

      {status === "success" && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {t("successMessage")}
        </div>
      )}

      {status === "error" && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {t("errorMessage")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("subject")}</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("subjectPlaceholder")}
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("message")}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            required
            rows={6}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !subject.trim() || !message.trim()}
          className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {sending ? t("sending") : t("sendMessage")}
        </button>
      </form>
    </div>
  );
}
