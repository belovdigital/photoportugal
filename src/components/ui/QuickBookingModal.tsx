"use client";

import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LocationTreeSelect } from "@/components/ui/LocationTreeSelect";
import DatePicker from "@/components/ui/DatePicker";

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
      <Suspense fallback={null}>
        <QuickBookingDeepLink />
      </Suspense>
      {open && <QuickBookingModalImpl onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

// Deep link: ?quickbook=1 on ANY page opens the drawer — shareable URL for
// ads/stories via the /quickbook redirect in middleware. The param is
// stripped after opening so closing the modal doesn't leave a URL that
// re-opens it on refresh/share. Separate component so useSearchParams'
// Suspense requirement doesn't bail out the whole provider tree.
function QuickBookingDeepLink() {
  const { setOpen } = useQuickBookingModal();
  const searchParams = useSearchParams();
  const wantsOpen = searchParams.get("quickbook") === "1";
  useEffect(() => {
    if (!wantsOpen) return;
    setOpen(true);
    import("@/lib/analytics").then(({ trackCTAClick }) => trackCTAClick("quick_booking", "deeplink")).catch(() => {});
    const url = new URL(window.location.href);
    url.searchParams.delete("quickbook");
    window.history.replaceState(null, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsOpen]);
  return null;
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

// Today in the visitor's LOCAL timezone (not UTC) — see src/lib/date-utils.ts
// for why. Inlined here to avoid an extra import; behaviour is identical to
// todayLocalISO.
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function detectFromPath(pathname: string | null): { slug?: string; occasion?: string } {
  if (!pathname) return {};
  const stripped = pathname.replace(/^\/(en|pt|de|es|fr)(?=\/|$)/, "");
  // Localized aliases per i18n/routing.ts pathnames (orte/lugares/lieux,
  // fotoshootings/sesiones-de-fotos/seances-photo) so the occasion prefill
  // works on non-EN locales too, not just EN paths.
  const locMatch = stripped.match(/^\/(?:locations|orte|lugares|lieux)\/([^/]+)(?:\/([^/]+))?/);
  if (locMatch) {
    return { slug: locMatch[1], occasion: locMatch[2] };
  }
  const shootMatch = stripped.match(/^\/(?:photoshoots|fotoshootings|sesiones-de-fotos|seances-photo)\/([^/]+)/);
  if (shootMatch) {
    return { occasion: shootMatch[1] };
  }
  // Dedicated wedding landing (/weddings + localized aliases).
  if (/^\/(?:weddings|hochzeiten|bodas|mariages)(?=\/|$)/.test(stripped)) {
    return { occasion: "wedding" };
  }
  return {};
}

interface PricePreview {
  regional_base_eur: number;
  base_eur: number;
  service_fee_eur: number;
  /** All-inclusive summer-offer total the client pays — charged straight. */
  total_eur: number;
  /** Pre-offer all-in total for the strike-through ("was €344"). */
  compare_at_eur: number;
  savings_eur: number;
  savings_pct: number;
  large_group_applied: boolean;
  large_group_surcharge_eur: number;
}

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
    "wedding": "couples",
    "fashion": "other",
    "branding": "other",
    "other": "other",
  };
  return map[raw] || "couples";
}

// Shared inline-token style. The value picks up the primary (coral)
// color so a reader scanning the sentence sees instantly what's
// editable — no amber chips, no rings. Dotted underline reinforces
// "this is interactive prose" without shouting.
const TOKEN =
  "relative inline-block cursor-pointer rounded-sm px-1 py-0 font-semibold text-primary-700 underline decoration-dotted decoration-primary-300 decoration-2 underline-offset-[5px] transition hover:bg-primary-50 hover:decoration-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1";

// Inline-token select. A visible <span> renders the selected label so
// the element sizes exactly to the value (no implicit min-width from
// the longest option), with a transparent native <select> overlaid on
// top to handle the click + open the platform picker. This pattern
// sidesteps the cross-browser fight with `appearance-none` and the
// vendor-specific dropdown arrow.
function InlineSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  ariaLabel: string;
}) {
  const current = options.find((o) => String(o.value) === String(value));
  const label = current?.label ?? String(value);
  return (
    <span className={`${TOKEN} relative`}>
      <span aria-hidden>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

// Compact stepper that lives inside the sentence. The minus / plus
// buttons sit either side of the count with no surrounding box — just
// hover affordance. When the 9+ surcharge triggers, the count itself
// picks up the primary accent color so the reader's eye lands on what
// just changed.
function InlineStepper({
  value,
  onChange,
  largeGroup,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  largeGroup: boolean;
  ariaLabel: string;
}) {
  const stepBtn =
    "inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-primary-600 transition hover:bg-primary-50 hover:text-primary-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-primary-600";
  return (
    <span className="inline-flex items-baseline gap-0.5 align-baseline" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="−"
        className={stepBtn}
      >
        −
      </button>
      <span
        className={`min-w-[1.5rem] text-center font-semibold tabular-nums transition ${largeGroup ? "text-primary-800" : "text-primary-700"}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(30, value + 1))}
        disabled={value >= 30}
        aria-label="+"
        className={stepBtn}
      >
        +
      </button>
    </span>
  );
}

// Persisted form draft — anything the visitor typed before closing
// the modal so they can resume on next open. Cleared only on a
// successful submit (then the booking lives in their dashboard).
const DRAFT_KEY = "qbm_draft_v1";

interface ModalDraft {
  region?: string;
  occasion?: string;
  duration?: 60 | 120 | 180;
  date?: string;
  partySize?: number;
  name?: string;
  email?: string;
  phone?: string;
  hint?: string;
}

function loadDraft(): ModalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ModalDraft;
  } catch {
    return null;
  }
}

function QuickBookingModalImpl({ onClose }: { onClose: () => void }) {
  const t = useTranslations("quickBooking");
  const locale = useLocale();
  const pathname = usePathname();
  const detected = useMemo(() => {
    const fromPath = detectFromPath(pathname);
    if (fromPath.slug) return fromPath;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("location");
      const fromQuery = raw ? raw.split(",")[0]?.trim() : null;
      if (fromQuery) return { slug: fromQuery, occasion: fromPath.occasion };
    }
    return fromPath;
  }, [pathname]);
  // Load any saved draft once at mount; saved values win over URL
  // detection (visitor's explicit prior input > inferred default).
  const draft = useMemo(() => loadDraft(), []);
  const [region, setRegion] = useState<string>(draft?.region || detected.slug || "greater-lisbon");
  const [occasion, setOccasion] = useState<string>(draft?.occasion || normalizeOccasion(detected.occasion));
  const [duration, setDuration] = useState<60 | 120 | 180>(draft?.duration ?? 60);
  const [date, setDate] = useState<string>(draft?.date || "");
  const [partySize, setPartySize] = useState<number>(draft?.partySize ?? 2);
  // If the draft carries an explicit party size, treat it as "touched"
  // so occasion auto-sync doesn't overwrite the visitor's prior pick.
  const partySizeTouched = useRef<boolean>(typeof draft?.partySize === "number");
  const [name, setName] = useState(draft?.name || "");
  const [email, setEmail] = useState(draft?.email || "");
  const [phone, setPhone] = useState(draft?.phone || "");
  const [hint, setHint] = useState(draft?.hint || "");
  const [price, setPrice] = useState<PricePreview | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minDate = todayISO();
  const intlLocale =
    locale === "en" ? "en-GB"
    : locale === "pt" ? "pt-PT"
    : locale === "de" ? "de-DE"
    : locale === "es" ? "es-ES"
    : locale === "fr" ? "fr-FR"
    : locale;

  useEffect(() => {
    if (partySizeTouched.current) return;
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

  // Lock body scroll while the modal is open. We deliberately do NOT
  // wire up Escape-to-close or backdrop-click-to-close — visitors have
  // typed contact info + meeting details into this form and we don't
  // want a misaimed click or stray Esc to make all of it disappear.
  // The X button in the header is the only intentional close path.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Persist every form change as a draft so the visitor can resume if
  // they accidentally hit X or navigate away. Cleared on successful
  // submit (at which point the booking is real, not a draft).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: ModalDraft = {
        region,
        occasion,
        duration,
        date,
        partySize,
        name,
        email,
        phone,
        hint,
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // Storage quota / disabled / SSR — silent; the draft is a
      // nice-to-have, not a correctness requirement.
    }
  }, [region, occasion, duration, date, partySize, name, email, phone, hint]);

  useEffect(() => {
    let cancelled = false;
    setPriceLoading(true);
    fetch(`/api/blind-booking/price?region=${region}&occasion=${occasion}&duration=${duration}&party_size=${partySize}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.total_eur) {
          setPrice({
            regional_base_eur: data.regional_base_eur,
            base_eur: data.base_eur,
            service_fee_eur: data.service_fee_eur,
            total_eur: data.total_eur,
            compare_at_eur: data.compare_at_eur || 0,
            savings_eur: data.savings_eur || 0,
            savings_pct: data.savings_pct || 0,
            large_group_applied: !!data.large_group_applied,
            large_group_surcharge_eur: data.large_group_surcharge_eur || 0,
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
  }, [region, occasion, duration, partySize]);

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
        setError(data?.error || t("error"));
        setSubmitting(false);
        return;
      }
      // Booking is real now — wipe the draft so a future modal open
      // doesn't prefill with the just-submitted shoot's details.
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {}
      window.location.href = data.checkout_url;
    } catch {
      setError(t("error"));
      setSubmitting(false);
    }
  }

  // Snapshot the last good price so the box can keep showing it while
  // a refetch is in flight — prevents the layout-jumping skeleton.
  const displayPrice = price;

  return (
    <>
      {/* Backdrop is visual only — no onClick. Visitors have typed */}
      {/* a lot here and a misclick on the dimmed background should */}
      {/* NOT discard the form. Close path = the X button only.     */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        aria-hidden
      />
      <div className="fixed inset-0 z-[61] flex items-center justify-center px-4 py-8 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-xl max-h-full overflow-y-auto rounded-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={t("title")}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-warm-100 bg-white/95 px-5 py-3.5 backdrop-blur">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-600">
                {t("badge")}
              </p>
              <h2 className="font-display text-lg font-bold text-gray-900">
                {t("title")}
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

          <form onSubmit={submit} className="space-y-7 px-6 py-7 sm:px-8 sm:py-8">
            {/* MadLibs sentence — body type, generous leading, tokens */}
            {/* in primary (coral) so editable values pop. */}
            <p className="text-[17px] leading-[2.1] text-gray-700 sm:text-[18px] [&_*]:align-baseline">
              {t.rich("madlibsSentence", {
                partySize,
                occasion: () => (
                  <InlineSelect
                    value={occasion}
                    onChange={(v) => setOccasion(v)}
                    ariaLabel={t("occasion")}
                    options={OCCASIONS.map((o) => ({ value: o, label: t(`occasions.${o}`) }))}
                  />
                ),
                region: () => (
                  <span className="inline-block">
                    <LocationTreeSelect
                      value={region}
                      onChange={setRegion}
                      placeholder={t("region")}
                      searchPlaceholder={t("regionSearch")}
                      noMatchLabel={t("regionNoMatch")}
                      buttonClassName={`${TOKEN} [&>span]:!text-primary-700 [&>svg]:!hidden`}
                    />
                  </span>
                ),
                date: () => (
                  <span className="inline-block">
                    <DatePicker
                      value={date}
                      onChange={setDate}
                      min={minDate}
                      placeholder={t("pickDate")}
                      hideIcon
                      formatTrigger={(v) => {
                        try {
                          return new Date(v + "T12:00:00").toLocaleDateString(intlLocale, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          });
                        } catch {
                          return v;
                        }
                      }}
                      triggerClassName={`${TOKEN} ${date ? "" : "italic !text-primary-500"}`}
                      portalPopover
                    />
                  </span>
                ),
                party: () => (
                  <InlineStepper
                    value={partySize}
                    onChange={(v) => {
                      partySizeTouched.current = true;
                      setPartySize(v);
                    }}
                    largeGroup={partySize >= 9}
                    ariaLabel={t("partySize")}
                  />
                ),
                duration: () => (
                  <InlineSelect
                    value={duration}
                    onChange={(v) => setDuration(Number(v) as 60 | 120 | 180)}
                    ariaLabel={t("duration")}
                    options={[
                      { value: 60, label: "1h" },
                      { value: 120, label: "2h" },
                      { value: 180, label: "3h" },
                    ]}
                  />
                ),
              })}
            </p>

            {/* Surcharge callout — only when 9+ kicks in. */}
            {displayPrice?.large_group_applied && (
              <p className="-mt-3 text-sm text-primary-700">
                + €{displayPrice.large_group_surcharge_eur} {t("largeGroupSurcharge")}
              </p>
            )}

            {/* Price block — fixed min-height so refetches don't jump.
                Summer super-offer framing: one all-inclusive number, the old
                total struck through, savings + vetted-top-1% line. No
                "rate + fee" breakdown — the price IS the price. */}
            <div className="relative min-h-[7rem] rounded-2xl border border-amber-200 bg-amber-50/40 px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                {t("summerOffer")}
              </p>
              {displayPrice ? (
                <>
                  <p
                    className={`mt-1 font-display text-4xl font-bold tabular-nums tracking-tight text-gray-900 transition-opacity ${priceLoading ? "opacity-60" : "opacity-100"}`}
                  >
                    €{displayPrice.total_eur}
                    {displayPrice.compare_at_eur > displayPrice.total_eur && (
                      <span className="ml-2.5 align-middle text-xl font-medium text-gray-400 line-through">€{displayPrice.compare_at_eur}</span>
                    )}
                  </p>
                  {displayPrice.savings_eur > 0 && (
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      {t("youSave", { amount: displayPrice.savings_eur, pct: displayPrice.savings_pct })}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500">
                    {t("allInclusive")}
                  </p>
                </>
              ) : priceLoading ? (
                <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight text-gray-300">€…</p>
              ) : (
                <p className="mt-1 text-sm text-red-600">{t("noPrice")}</p>
              )}
            </div>

            {/* Reassurance — two short promises about what happens */}
            {/* between now and the shoot. Scannable, not a wall of */}
            {/* fine print. The chat-after-match note is the answer */}
            {/* to "but how do I tell them where to meet?".         */}
            <ul className="space-y-2 text-sm leading-relaxed text-gray-600">
              <li className="flex gap-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("holdNote")}</span>
              </li>
              <li className="flex gap-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
                </svg>
                <span>{t("afterMatchNote")}</span>
              </li>
            </ul>

            <div className="space-y-2.5 pt-2">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  placeholder={t("name")}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-warm-200 bg-white px-3.5 py-3 text-base outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                <input
                  type="email"
                  required
                  placeholder={t("email")}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg border border-warm-200 bg-white px-3.5 py-3 text-base outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <input
                type="tel"
                required
                placeholder={t("phone")}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-warm-200 bg-white px-3.5 py-3 text-base outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <input
                type="text"
                placeholder={t("hint")}
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className="w-full rounded-lg border border-warm-200 bg-white px-3.5 py-3 text-base outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={!validForm || !displayPrice || submitting}
              className="w-full rounded-xl bg-primary-600 px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-warm-300"
            >
              {submitting ? t("submitting") : t("submit")}
            </button>

            <p className="text-center text-xs text-gray-400">
              {t("trust")}
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
