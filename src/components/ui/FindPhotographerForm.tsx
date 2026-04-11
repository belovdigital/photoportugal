"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations-data";
import DatePicker from "@/components/ui/DatePicker";
import { AuthModal } from "@/components/ui/AuthModal";

const SHOOT_TYPES = ["couples", "family", "proposal", "wedding", "honeymoon", "elopement", "solo", "engagement", "birthday", "friends"] as const;

const BUDGET_OPTIONS = [
  { value: "150-299", key: "budget150" },
  { value: "300-599", key: "budget300" },
  { value: "600+", key: "budget600" },
] as const;

const TIME_OPTIONS = [
  { value: "flexible", label: "I'm flexible" },
  { value: "sunrise", label: "Sunrise (6-8 AM)" },
  { value: "morning", label: "Morning (8-11 AM)" },
  { value: "midday", label: "Midday (11 AM-2 PM)" },
  { value: "afternoon", label: "Afternoon (2-5 PM)" },
  { value: "golden_hour", label: "Golden Hour (5-7 PM)" },
  { value: "sunset", label: "Sunset (7-9 PM)" },
] as const;

export function FindPhotographerForm({ defaultName = "", defaultEmail = "", defaultPhone = "", userId }: { defaultName?: string; defaultEmail?: string; defaultPhone?: string; userId?: string }) {
  const { data: session, status } = useSession();
  const t = useTranslations("findPhotographer");
  const tb = useTranslations("book");
  const searchParams = useSearchParams();

  const [firstName, setFirstName] = useState(defaultName.split(" ")[0] || "");
  const [lastName, setLastName] = useState(defaultName.split(" ").slice(1).join(" ") || "");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingSubmit = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [locationSlug, setLocationSlug] = useState(searchParams.get("location") || "");
  const [shootType, setShootType] = useState(searchParams.get("shootType") || "");
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("flexible");
  const [dateFlexible, setDateFlexible] = useState(false);
  const [flexibleDateFrom, setFlexibleDateFrom] = useState("");
  const [flexibleDateTo, setFlexibleDateTo] = useState("");
  const [groupSize, setGroupSize] = useState(2);
  const [budgetRange, setBudgetRange] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const minDate = new Date().toISOString().split("T")[0];

  // Auto-resubmit after auth
  useEffect(() => {
    if (status === "authenticated" && pendingSubmit.current) {
      pendingSubmit.current = false;
      setShowAuthModal(false);
      formRef.current?.requestSubmit();
    }
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.trim() || !phone.trim() || !locationSlug || !shootType || !budgetRange) return;
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();

    // If not logged in, show auth modal
    if (status !== "authenticated") {
      pendingSubmit.current = true;
      setShowAuthModal(true);
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/match-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          location_slug: locationSlug,
          shoot_type: shootType,
          shoot_date: dateFlexible ? null : shootDate || null,
          shoot_time: shootTime || "flexible",
          date_flexible: dateFlexible,
          flexible_date_from: dateFlexible ? flexibleDateFrom || null : null,
          flexible_date_to: dateFlexible ? flexibleDateTo || null : null,
          group_size: groupSize,
          budget_range: budgetRange,
          message: message.trim() || null,
          user_id: userId || null,
        }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || t("error"));
      }
    } catch {
      setError(t("error"));
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
        <h3 className="mt-4 text-lg font-bold text-gray-900">{t("successTitle")}</h3>
        <p className="mt-2 text-sm text-gray-500">{t("successMessage")}</p>
        <Link
          href="/photographers"
          className="mt-4 inline-block rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          {t("successBrowse")}
        </Link>
      </div>
    );
  }

  const inputCls = "mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200";

  return (
    <>
    <AuthModal
      open={showAuthModal}
      onClose={() => { setShowAuthModal(false); pendingSubmit.current = false; }}
      onSuccess={() => {}}
      callbackUrl={typeof window !== "undefined" ? window.location.href : "/find-photographer"}
      title={t("signInToSubmit")}
      subtitle={t("signInToSubmitDesc")}
      prefillFirstName={firstName}
      prefillLastName={lastName}
      prefillEmail={email}
    />
    <form ref={formRef} onSubmit={handleSubmit} className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm sm:p-8">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-5">
        {/* First Name + Last Name row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("firstNameLabel")} *</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder={t("firstNamePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("lastNameLabel")}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("lastNamePlaceholder")} className={inputCls} />
          </div>
        </div>

        {/* Email + Phone row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("emailLabel")} *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("emailPlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("phoneLabel")} *</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder={t("phonePlaceholder")} className={inputCls} />
          </div>
        </div>

        {/* Location + Shoot Type row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("locationLabel")} *</label>
            <select value={locationSlug} onChange={(e) => setLocationSlug(e.target.value)} required className={inputCls}>
              <option value="">{t("locationPlaceholder")}</option>
              {locations.map((loc) => (
                <option key={loc.slug} value={loc.slug}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("shootTypeLabel")} *</label>
            <select value={shootType} onChange={(e) => setShootType(e.target.value)} required className={inputCls}>
              <option value="">{t("shootTypePlaceholder")}</option>
              {SHOOT_TYPES.map((type) => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date + Time row */}
        {!dateFlexible && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              label={t("dateLabel")}
              value={shootDate}
              onChange={setShootDate}
              min={minDate}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("timeLabel")}</label>
              <select value={shootTime} onChange={(e) => setShootTime(e.target.value)} className={inputCls}>
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{tb(`time.${opt.value === "golden_hour" ? "goldenHour" : opt.value}` as any)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Flexible dates toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dateFlexible}
            onChange={(e) => {
              setDateFlexible(e.target.checked);
              if (e.target.checked) setShootDate("");
              else { setFlexibleDateFrom(""); setFlexibleDateTo(""); }
            }}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">{t("dateFlexible")}</span>
        </label>

        {/* Flexible date range */}
        {dateFlexible && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              label={t("dateFromLabel")}
              value={flexibleDateFrom}
              onChange={setFlexibleDateFrom}
              min={minDate}
            />
            <DatePicker
              label={t("dateToLabel")}
              value={flexibleDateTo}
              onChange={setFlexibleDateTo}
              min={flexibleDateFrom || minDate}
            />
          </div>
        )}

        {/* Group size + Budget row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="max-w-[120px]">
            <label className="block text-sm font-medium text-gray-700">{t("groupSizeLabel")}</label>
            <input type="number" min={1} max={20} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("budgetLabel")} *</label>
            <select value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} required className={inputCls}>
              <option value="">{t("budgetPlaceholder")}</option>
              {BUDGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("messageLabel")}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={t("messagePlaceholder")} className={inputCls} />
        </div>

        <button
          type="submit"
          disabled={sending || !locationSlug || !shootType || !budgetRange}
          className="w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {sending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
    </>
  );
}
