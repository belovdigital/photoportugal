"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

export function GiftCardCheckoutForm() {
  const locale = useLocale();
  const t = useTranslations("giftCardsPage");
  const { data: session } = useSession();
  const me = session?.user as { name?: string; email?: string } | undefined;

  // Default to Full (the "Most popular" tier) — it converts better
  // and the express tier stays one click away.
  const [tier, setTier] = useState<"express" | "full">("full");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [buyerName, setBuyerName] = useState(me?.name || "");
  const [buyerEmail, setBuyerEmail] = useState(me?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!recipientName.trim()) { setError(t("errRecipientName")); return; }
    if (!recipientEmail.includes("@") || !recipientEmail.includes(".")) { setError(t("errRecipientEmail")); return; }
    if (!buyerName.trim()) { setError(t("errBuyerName")); return; }
    if (!buyerEmail.includes("@")) { setError(t("errBuyerEmail")); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          recipient_name: recipientName.trim(),
          recipient_email: recipientEmail.trim().toLowerCase(),
          recipient_phone: recipientPhone.trim() || null,
          personal_message: personalMessage.trim() || null,
          buyer_name: buyerName.trim(),
          buyer_email: buyerEmail.trim().toLowerCase(),
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || t("errCheckout"));
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("errNetwork"));
      setSubmitting(false);
    }
  }

  const TIERS = [
    {
      code: "express" as const,
      label: t("tierExpress"),
      price: 290,
      duration: t("tierExpressDuration"),
      photos: t("tierExpressPhotos"),
      perks: [
        t("perkLocations1"),
        t("perkDelivery"),
        t("perkRecipientPicks"),
        t("perkValid"),
      ],
      popular: false,
    },
    {
      code: "full" as const,
      label: t("tierFull"),
      price: 490,
      duration: t("tierFullDuration"),
      photos: t("tierFullPhotos"),
      perks: [
        t("perkLocations2"),
        t("perkOutfitChange"),
        t("perkDelivery"),
        t("perkRecipientPicks"),
        t("perkValid"),
      ],
      popular: true,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm space-y-5">
      {/* Tier picker — full info cards (no duplicate display above). */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{t("chooseTier")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIERS.map((tt) => {
            const selected = tier === tt.code;
            return (
              <label
                key={tt.code}
                className={`relative cursor-pointer rounded-2xl border-2 p-5 transition ${
                  selected
                    ? "border-primary-600 bg-primary-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {tt.popular && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-accent-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    {t("mostPopular")}
                  </span>
                )}
                {selected && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white" aria-hidden>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
                <input
                  type="radio"
                  name="tier"
                  value={tt.code}
                  checked={selected}
                  onChange={() => setTier(tt.code)}
                  className="sr-only"
                />
                <div className="flex items-baseline justify-between pr-7">
                  <span className="text-lg font-bold text-gray-900">{tt.label}</span>
                  <span className="text-2xl font-bold text-primary-700">€{tt.price}</span>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  {tt.duration} · {tt.photos}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-gray-700">
                  {tt.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </div>

      {/* Recipient block */}
      <div className="border-t border-warm-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{t("recipientHeading")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("recipientName")}</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={t("recipientNamePlaceholder")}
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("recipientEmail")}</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="maria@example.com"
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-primary-500"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">{t("recipientPhone")}</label>
          <input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder={t("recipientPhonePlaceholder")}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-primary-500"
          />
          <p className="mt-1 text-[11px] text-gray-400">{t("recipientPhoneHint")}</p>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">{t("personalMessage")}</label>
          <textarea
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value.slice(0, 500))}
            placeholder={t("personalMessagePlaceholder")}
            rows={3}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary-500"
          />
          <p className="mt-1 text-[11px] text-gray-400 text-right">{personalMessage.length}/500</p>
        </div>
      </div>

      {/* Buyer block */}
      <div className="border-t border-warm-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{t("buyerHeading")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("buyerName")}</label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder={t("buyerNamePlaceholder")}
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("buyerEmail")}</label>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder={t("buyerEmailPlaceholder")}
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-primary-600 text-white py-4 font-semibold text-base hover:bg-primary-700 disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("submit", { price: tier === "express" ? 290 : 490 })}
      </button>
      <p className="text-[11px] text-gray-400 text-center">
        {t("secureNote")}
      </p>
    </form>
  );
}
