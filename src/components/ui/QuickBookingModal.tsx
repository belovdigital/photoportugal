"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LocationTreeSelect } from "@/components/ui/LocationTreeSelect";

const OCCASIONS = [
  "couples",
  "family",
  "solo",
  "proposal",
  "engagement",
  "elopement",
  "honeymoon",
  "anniversary",
  "maternity",
  "birthday",
  "vacation",
  "other",
] as const;

interface QuickBookingDrawerContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<QuickBookingDrawerContextValue | null>(null);

export function useQuickBookingModal(): QuickBookingDrawerContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) return { open: false, setOpen: () => {} };
  return ctx;
}

export function QuickBookingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open, setOpen }}>
      {children}
      {open && <QuickBookingModalImpl onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

export function QuickBookingTrigger({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { setOpen } = useQuickBookingModal();
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        setOpen(true);
      }}
      className={className}
    >
      {children}
    </button>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Detect the location/occasion the visitor is currently looking at so
// the modal opens pre-filled. Examples (with /en/, /pt/, etc prefix):
//   /locations/madeira → region=madeira
//   /locations/sintra → region=sintra (a Greater Lisbon city)
//   /locations/lisbon/proposal → region=lisbon, occasion=proposal
//   /photoshoots/couples → occasion=couples
function detectFromPath(pathname: string | null): { slug?: string; occasion?: string } {
  if (!pathname) return {};
  // Strip locale prefix.
  const stripped = pathname.replace(/^\/(en|pt|de|es|fr)(?=\/|$)/, "");
  const locMatch = stripped.match(/^\/locations\/([^/]+)(?:\/([^/]+))?/);
  if (locMatch) {
    return { slug: locMatch[1], occasion: locMatch[2] };
  }
  const shootMatch = stripped.match(/^\/photoshoots\/([^/]+)/);
  if (shootMatch) {
    return { occasion: shootMatch[1] };
  }
  // /photographers?location=foo handled via search params elsewhere.
  return {};
}

interface PricePreview {
  base_eur: number;
  service_fee_eur: number;
  total_eur: number;
}

// Normalize occasion picked from URL (e.g. /photoshoots/proposal) to
// the enum the accept endpoint accepts. Unknown values fall back to
// "couples" so the form always has a valid default.
function normalizeOccasion(raw: string | undefined): string {
  if (!raw) return "couples";
  const map: Record<string, string> = {
    "couples": "couples",
    "family": "family",
    "solo": "solo",
    "solo-portrait": "solo",
    "proposal": "proposal",
    "engagement": "engagement",
    "elopement": "elopement",
    "honeymoon": "honeymoon",
    "anniversary": "anniversary",
    "maternity": "maternity",
    "birthday": "birthday",
    "vacation": "vacation",
    "wedding": "couples", // weddings → couples package for blind MVP
    "fashion": "other",
    "branding": "other",
    "other": "other",
  };
  return map[raw] || "couples";
}

function QuickBookingModalImpl({ onClose }: { onClose: () => void }) {
  const t = useTranslations("quickBooking");
  const locale = useLocale();
  const pathname = usePathname();
  const detected = useMemo(() => detectFromPath(pathname), [pathname]);
  const [region, setRegion] = useState<string>(detected.slug || "greater-lisbon");
  const [occasion, setOccasion] = useState<string>(normalizeOccasion(detected.occasion));
  const [duration, setDuration] = useState<60 | 120 | 180>(60);
  const [date, setDate] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hint, setHint] = useState("");
  const [price, setPrice] = useState<PricePreview | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minDate = todayISO();

  // Infer party size from occasion (mirror Concierge AI's behaviour).
  useEffect(() => {
    if (occasion === "solo") setPartySize(1);
    else if (
      occasion === "couples" ||
      occasion === "proposal" ||
      occasion === "engagement" ||
      occasion === "elopement" ||
      occasion === "honeymoon" ||
      occasion === "anniversary"
    ) {
      setPartySize(2);
    }
  }, [occasion]);

  // Lock body scroll + close on Esc.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Live price preview.
  useEffect(() => {
    let cancelled = false;
    setPriceLoading(true);
    fetch(`/api/blind-booking/price?region=${region}&occasion=${occasion}&duration=${duration}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.total_eur) {
          setPrice({
            base_eur: data.base_eur,
            service_fee_eur: data.service_fee_eur,
            total_eur: data.total_eur,
          });
        } else {
          setPrice(null);
        }
        setPriceLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPrice(null);
          setPriceLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [region, occasion, duration]);

  const validForm = useMemo(() => {
    if (!date) return false;
    if (!name.trim()) return false;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return false;
    if (phone.replace(/\D/g, "").length < 6) return false;
    if (partySize < 1 || partySize > 30) return false;
    return true;
  }, [date, name, email, phone, partySize]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validForm) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/concierge/blind-booking/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          occasion,
          duration_minutes: duration,
          date,
          party_size: partySize,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          meeting_hint: hint.trim(),
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.checkout_url) {
        setError(data?.error || t("error") || "Could not create booking. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError(t("error") || "Could not create booking. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[61] flex items-center justify-center px-4 py-8 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-xl max-h-full overflow-y-auto rounded-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={t("title") || "Quick booking"}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-warm-200 bg-white px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                {t("badge") || "Quick booking"}
              </p>
              <h2 className="text-lg font-bold text-gray-900">
                {t("title") || "We'll book a photographer for you"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            <p className="text-sm text-gray-600">
              {t("intro") ||
                "Tell us what you need and we'll hand-pick your photographer within 24 hours. You're only charged once your photographer is confirmed — full refund otherwise."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  {t("region") || "Region"}
                </label>
                <LocationTreeSelect
                  value={region}
                  onChange={setRegion}
                  placeholder={t("region") || "Region"}
                  searchPlaceholder={t("regionSearch") || "Search regions / cities / islands"}
                  noMatchLabel={t("regionNoMatch") || "No locations found"}
                  className="mt-1"
                  buttonClassName="flex w-full items-center justify-between gap-2 rounded-lg border border-warm-200 bg-white px-3 py-2 text-base text-left"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  {t("occasion") || "Occasion"}
                </label>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                >
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {(t(`occasions.${o}`) as string) ||
                        o.charAt(0).toUpperCase() + o.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  {t("date") || "Date"}
                </label>
                <input
                  type="date"
                  required
                  min={minDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  {t("duration") || "Duration"}
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) as 60 | 120 | 180)}
                  className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                >
                  <option value={60}>1 {t("hour") || "hour"}</option>
                  <option value={120}>2 {t("hours") || "hours"}</option>
                  <option value={180}>3 {t("hours") || "hours"}</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  {t("partySize") || "Number of people"}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={30}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                />
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-700">
                {t("total") || "Total"}
              </p>
              {priceLoading ? (
                <p className="text-base text-gray-500">…</p>
              ) : price ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">€{price.total_eur}</p>
                  <p className="text-[11px] text-gray-500">
                    €{price.base_eur} {t("photographerRate") || "photographer rate"} + €
                    {price.service_fee_eur} {t("platformFee") || "platform fee"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-red-600">
                  {t("noPrice") || "No pricing available for this combination yet."}
                </p>
              )}
              <p className="mt-1 text-[11px] text-gray-500">
                {t("holdNote") ||
                  "Authorised now — charged only when your photographer is confirmed within 24h. Full refund if we can't match."}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <input
                type="text"
                required
                placeholder={t("name") || "Your name"}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
              />
              <input
                type="email"
                required
                placeholder={t("email") || "Email"}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
              />
              <input
                type="tel"
                required
                placeholder={t("phone") || "WhatsApp / phone for the day"}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
              />
              <input
                type="text"
                placeholder={t("hint") || "Meeting hint (optional)"}
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={!validForm || !price || submitting}
              className="w-full rounded-xl bg-amber-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting
                ? t("submitting") || "Processing…"
                : t("submit") || "Continue to secure checkout"}
            </button>

            <p className="text-center text-[11px] text-gray-400">
              {t("trust") ||
                "Payment processed by Stripe. Photo Portugal handpicks your photographer from verified pros."}
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
