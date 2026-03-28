"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

const TOPIC_KEYS = ["clientSupport", "photographerSupport", "sales", "pr", "other"] as const;

// Recipients are resolved server-side from admin settings — not sent from client

export function ContactForm() {
  const t = useTranslations("contact.form");
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") || "";
  const [topic, setTopic] = useState(TOPIC_KEYS.includes(initialTopic as typeof TOPIC_KEYS[number]) ? initialTopic : "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic || !name.trim() || !email.trim() || !message.trim()) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || t("sendFailed"));
      }
    } catch {
      setError(t("sendFailed"));
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-accent-200 bg-accent-50/50 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-100">
          <svg className="h-7 w-7 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-bold text-gray-900">{t("sentTitle")}</h3>
        <p className="mt-2 text-sm text-gray-500">{t("sentDescription")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("topicLabel")}</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          >
            <option value="">{t("topicPlaceholder")}</option>
            {TOPIC_KEYS.map((key) => (
              <option key={key} value={key}>{t(`topics.${key}`)}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t("namePlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("emailLabel")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t("emailPlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("messageLabel")}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            placeholder={t("messagePlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <button
          type="submit"
          disabled={sending || !topic}
          className="w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {sending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}
